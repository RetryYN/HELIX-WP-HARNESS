import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {auditAcquisitionLifetimeBudget} from "./acquisition-lifetime-budget.mjs";

const API="https://api.data-provider-b.example/v3";
const dashboardUrl=process.env.WP_DASHBOARD_URL??"http://127.0.0.1:4173";
const outputDir=path.resolve(process.env.WP_ACQUISITION_OUTPUT??`.helix/evidence/acquisition-remediation/${new Date().toISOString().replaceAll(":","-")}`);
const approvedCap=Number(process.env.WP_APPROVED_BUDGET_USD);
const lifetimeCap=Number(process.env.WP_LIFETIME_TEST_BUDGET_USD??5);
const evidenceRoot=path.resolve(process.env.WP_ACQUISITION_EVIDENCE_ROOT??path.dirname(outputDir));
const legacyCostEvidencePath=path.resolve(process.env.WP_LEGACY_ACQUISITION_COST_EVIDENCE??"artifacts/poc/keyword-workbook-100-live/result.json");
const login=process.env.DATA_PROVIDER_B_LOGIN,password=process.env.DATA_PROVIDER_B_PASSWORD;
if(!login||!password)throw new Error("DATA_PROVIDER_B_LOGIN and DATA_PROVIDER_B_PASSWORD are required");
if(!Number.isFinite(approvedCap)||approvedCap<=0)throw new Error("WP_APPROVED_BUDGET_USD must be a positive number");
if(!Number.isFinite(lifetimeCap)||lifetimeCap<=0||lifetimeCap>5)throw new Error("WP_LIFETIME_TEST_BUDGET_USD must be positive and no greater than the user-approved lifetime cap of USD 5");
const sha=(value)=>createHash("sha256").update(typeof value==="string"?value:JSON.stringify(value)).digest("hex");
const getJson=async(url)=>{const response=await fetch(url);if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);return response.json()};
const request=async(endpoint,init={})=>{const response=await fetch(`${API}${endpoint}`,{...init,headers:{Authorization:`Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,"Content-Type":"application/json"}});if(!response.ok)throw new Error(`${endpoint}: HTTP ${response.status}`);const body=await response.json();if(body.status_code!==20000)throw new Error(`${endpoint}: API ${body.status_code} ${body.status_message}`);return body};

const [portfolioResponse,batchesResponse,readinessResponse,approvalResponse]=await Promise.all([
  getJson(`${dashboardUrl}/api/v1/acquisition-remediation-portfolio?site_id=site-a.example&limit=100`),
  getJson(`${dashboardUrl}/api/v1/acquisition-remediation-portfolio?site_id=site-a.example&view=batches&limit=100`),
  getJson(`${dashboardUrl}/api/v1/acquisition-execution-readiness?site_id=site-a.example`),
  getJson(`${dashboardUrl}/api/v1/acquisition-approval-manifest?site_id=site-a.example`),
]);
const portfolio={candidates:portfolioResponse.data,batches:batchesResponse.data,summary:portfolioResponse.summary},readiness=readinessResponse.data,approval=approvalResponse.data;
if(!readiness?.technical_ready)throw new Error(`technical readiness failed: ${(readiness?.blockers??[]).join(", ")}`);
if(approval?.price_expired)throw new Error("price snapshot expired");
if(portfolio?.summary?.remediation_task_count!==98||portfolio?.summary?.batch_count!==1)throw new Error("approved scope must be exactly 98 tasks in one batch");
if(Number(portfolio.summary.maximum_cost_usd)>approvedCap)throw new Error(`plan maximum ${portfolio.summary.maximum_cost_usd} exceeds approved cap ${approvedCap}`);
if(approval.candidate_count!==98||approval.batch_count!==1||approval.maximum_cost?.amount!==portfolio.summary.maximum_cost_usd)throw new Error("approval manifest does not match portfolio");
let legacyCostEvidence;try{legacyCostEvidence=JSON.parse(await readFile(legacyCostEvidencePath,"utf8"))}catch(error){throw new Error(`lifetime cost evidence is required and unreadable: ${legacyCostEvidencePath}: ${error.message}`)}
if(!Array.isArray(legacyCostEvidence.tasks)||!legacyCostEvidence.tasks.length)throw new Error(`lifetime cost evidence has no task ledger: ${legacyCostEvidencePath}`);
const legacyCommittedEntries=legacyCostEvidence.tasks.map((row)=>({source_id:row.task_id,cost:row.cost,observed_at:row.observed_at,source_digest:row.response_digest}));
const lifetimeBudget=auditAcquisitionLifetimeBudget(evidenceRoot,{lifetimeCapUsd:lifetimeCap,plannedMaximumCostUsd:Number(portfolio.summary.maximum_cost_usd),candidateSetDigest:approval.candidate_set_digest,excludeRunPath:outputDir,legacyCommittedEntries});
if(!lifetimeBudget.within_lifetime_cap)throw new Error(`lifetime test budget exceeded: committed ${lifetimeBudget.committed_cost_usd} + planned ${lifetimeBudget.planned_maximum_cost_usd} > ${lifetimeBudget.lifetime_cap_usd} USD`);
if(lifetimeBudget.duplicate_candidate_set_submitted)throw new Error("candidate set was already submitted; duplicate paid execution is forbidden");
const candidates=portfolio.candidates;
const payload=candidates.map((row)=>({...row.request,method:undefined,endpoint:undefined,tag:`helix-remediation:${row.source_task_id}`}));
if(payload.some((row)=>row.priority!=null))throw new Error("priority/live execution is forbidden");
const runBase={schema_version:"helix-acquisition-run.v1",created_at:new Date().toISOString(),approval:{source:"user_explicit_conversation_approval",currency:"USD",hard_cap:approvedCap,lifetime_test_cap:lifetimeCap,plan_maximum:portfolio.summary.maximum_cost_usd,manifest_digest:approval.manifest_digest,readiness_digest:readiness.readiness_digest},lifetime_budget:lifetimeBudget,scope:{task_count:candidates.length,batch_count:1,candidate_set_digest:approval.candidate_set_digest,batch_digests:approval.batch_digests},request:{method:"POST",endpoint:"/v3/serp/google/organic/task_post",queue:"standard",payload_digest:sha(payload)},retry_policy:{post_attempts:1,automatic_resubmission:false}};
await mkdir(path.join(outputDir,"raw"),{recursive:true});
await writeFile(path.join(outputDir,"run-manifest.json"),`${JSON.stringify({...runBase,state:"validated_not_submitted"},null,2)}\n`);
const posted=await request("/serp/google/organic/task_post",{method:"POST",body:JSON.stringify(payload)});
await writeFile(path.join(outputDir,"task-post.json"),`${JSON.stringify(posted,null,2)}\n`);
const rejected=(posted.tasks??[]).filter((task)=>task.status_code!==20100);
if((posted.tasks??[]).length!==98)throw new Error(`POST response count mismatch: ${(posted.tasks??[]).length}/98`);
const sourceByTag=new Map(candidates.map((row)=>[`helix-remediation:${row.source_task_id}`,row]));
const tasks=posted.tasks.filter((task)=>task.status_code===20100).map((task)=>{const source=sourceByTag.get(task.data?.tag);if(!source)throw new Error(`unknown response tag for ${task.id}`);return{acquisition_task_id:task.id,source_task_id:source.source_task_id,candidate_id:source.candidate_id,batch_id:source.batch_id,keyword:source.keyword,remediation_types:source.remediation_types,post_status_code:task.status_code,estimated_maximum_cost_usd:source.unit_cost_usd}});if(!tasks.length)throw new Error("POST accepted zero tasks");
const acceptedAt=new Date().toISOString(),postedCost=Number(posted.cost??0);
if(postedCost>approvedCap)throw new Error(`reported POST cost ${postedCost} exceeds approved cap ${approvedCap}`);
await writeFile(path.join(outputDir,"task-map.json"),`${JSON.stringify(tasks,null,2)}\n`);
await writeFile(path.join(outputDir,"run-manifest.json"),`${JSON.stringify({...runBase,state:rejected.length?"submitted_with_rejections":"submitted",accepted_at:acceptedAt,accepted_task_count:tasks.length,rejected_task_count:rejected.length,rejections:rejected.map((task)=>({status_code:task.status_code,status_message:task.status_message,source_task_id:sourceByTag.get(task.data?.tag)?.source_task_id??null})),provider_reported_post_cost_usd:postedCost,task_map_digest:sha(tasks)},null,2)}\n`);
console.log(JSON.stringify({output_dir:outputDir,state:rejected.length?"submitted_with_rejections":"submitted",accepted_task_count:tasks.length,rejected_task_count:rejected.length,approved_cap_usd:approvedCap,plan_maximum_cost_usd:portfolio.summary.maximum_cost_usd,provider_reported_post_cost_usd:postedCost,manifest_digest:approval.manifest_digest},null,2));
