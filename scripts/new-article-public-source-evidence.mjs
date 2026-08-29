import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const allowedResultStates=new Set(["qualifying_candidate_observed","no_qualifying_result"]);
const allowedSupportStates=new Set(["directly_supported","contextual_only","not_supported"]);

export function buildNewArticlePublicSourceEvidence(manifest,observations){
  const candidates=new Map((manifest.rows??[]).flatMap((article)=>article.queries).map((row)=>[row.claim_id,row]));
  const seen=new Set();
  const rows=(observations.rows??[]).map((observation)=>{
    const candidate=candidates.get(observation.claim_id);
    if(!candidate)throw new Error(`unknown public-source claim: ${observation.claim_id}`);
    if(seen.has(observation.claim_id))throw new Error(`duplicate public-source claim: ${observation.claim_id}`);
    seen.add(observation.claim_id);
    if(candidate.candidate_digest!==observation.candidate_digest)throw new Error(`candidate digest mismatch: ${observation.claim_id}`);
    if(candidate.selected_query!==observation.query)throw new Error(`query mismatch: ${observation.claim_id}`);
    if(!allowedResultStates.has(observation.result_state)||!allowedSupportStates.has(observation.direct_support_state))throw new Error(`invalid evidence state: ${observation.claim_id}`);
    if(observation.direct_support_state==="directly_supported"&&(!observation.url||!candidate.preferred_source_classes.includes(observation.source_class)))throw new Error(`direct support lacks a qualifying source: ${observation.claim_id}`);
    if(observation.result_state==="no_qualifying_result"&&(observation.url||observation.direct_support_state!=="not_supported"))throw new Error(`no-result evidence must fail closed: ${observation.claim_id}`);
    const sourceTextDigest=digest({title:observation.title,observed_facts:observation.observed_facts});
    const base={...observation,group_id:observation.claim_id.split(":section:")[0],priority_band:candidate.priority_band,source_requirement:candidate.source_requirement,preferred_source_classes:candidate.preferred_source_classes,observed_at:observations.observed_at,capture_method:observations.capture_method,acquisition_cost_usd:0,source_text_digest:sourceTextDigest,requirement_satisfied:observation.direct_support_state==="directly_supported",approval_state:"unreviewed",auto_approval:false,auto_publication:false,policy:"new-article-public-source-evidence.v1"};
    return{...base,evidence_digest:digest(base)};
  });
  const summary={checked_claim_count:rows.length,qualifying_candidate_count:rows.filter((row)=>row.result_state==="qualifying_candidate_observed").length,no_qualifying_result_count:rows.filter((row)=>row.result_state==="no_qualifying_result").length,directly_supported_count:rows.filter((row)=>row.direct_support_state==="directly_supported").length,contextual_only_count:rows.filter((row)=>row.direct_support_state==="contextual_only").length,not_supported_count:rows.filter((row)=>row.direct_support_state==="not_supported").length,requirement_satisfied_count:rows.filter((row)=>row.requirement_satisfied).length,acquisition_cost_usd:0,external_public_review_executed_count:rows.length,auto_approval_count:0,auto_publication_count:0};
  return{rows,summary,evidence_set_digest:digest({rows,summary})};
}
