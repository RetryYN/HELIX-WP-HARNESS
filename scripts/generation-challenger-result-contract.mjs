import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const outputKeys={ai_title:"variants",ai_heading:"headings",ai_questions:"questions",ai_related_keywords:"keywords",ai_keyword_proposal:"proposals"};
const bounds={ai_title:[2,5],ai_heading:[3,50],ai_questions:[0,12],ai_related_keywords:[0,20],ai_keyword_proposal:[0,20]};

function requireString(value,label,maxLength=Infinity){if(typeof value!=="string"||!value.trim()||value.length>maxLength)throw new Error(`${label} must be a non-empty string within ${maxLength} characters`)}
function requireIdArray(value,label,allowed){if(!Array.isArray(value)||!value.length||value.some((item)=>typeof item!=="string"||!allowed.has(item)))throw new Error(`${label} must contain only allowed retained IDs`)}

export function validateGenerationChallengerOutput(request,envelope){
  if(!request?.request_digest||envelope?.request_digest!==request.request_digest)throw new Error("request digest mismatch");
  if(envelope.capability!==request.capability)throw new Error("capability mismatch");
  if(request.execution_authorized!==true)throw new Error("request execution was not authorized");
  if(request.maximum_cost_usd==null)throw new Error("request maximum cost is unknown");
  if(!envelope.model||envelope.model!==request.model_selection?.model)throw new Error("executed model does not match manifest");
  if(!Number.isFinite(envelope.cost_usd)||envelope.cost_usd<0||envelope.cost_usd>request.maximum_cost_usd)throw new Error("reported cost exceeds request maximum");
  if(!Number.isInteger(envelope.usage?.input_tokens)||envelope.usage.input_tokens<0||envelope.usage.input_tokens>request.input_contract.estimated_maximum_input_tokens)throw new Error("input token ceiling exceeded");
  if(!Number.isInteger(envelope.usage?.output_tokens)||envelope.usage.output_tokens<0||envelope.usage.output_tokens>request.token_ceiling.maximum_output_tokens)throw new Error("output token ceiling exceeded");
  const key=outputKeys[request.capability],items=envelope.output?.[key],[minimum,maximum]=bounds[request.capability]??[];
  if(!key||!Array.isArray(items)||items.length<minimum||items.length>maximum)throw new Error("output does not satisfy capability item bounds");
  const evidenceAllowed=new Set(request.input.evidence_ids),baselineAllowed=new Set(request.input.baseline_artifact_ids);
  for(const [index,item] of items.entries()){
    if(request.capability==="ai_title"){requireString(item.text,`${key}[${index}].text`,80);requireIdArray(item.evidence_ids,`${key}[${index}].evidence_ids`,evidenceAllowed)}
    if(request.capability==="ai_heading"){if(![2,3].includes(item.level))throw new Error(`${key}[${index}].level is invalid`);requireString(item.text,`${key}[${index}].text`,200);if(item.parent_index!=null&&(!Number.isInteger(item.parent_index)||item.parent_index<0||item.parent_index>=index))throw new Error(`${key}[${index}].parent_index is invalid`);requireIdArray(item.evidence_ids,`${key}[${index}].evidence_ids`,evidenceAllowed)}
    if(request.capability==="ai_questions"){requireString(item.text,`${key}[${index}].text`,100);requireIdArray(item.evidence_ids,`${key}[${index}].evidence_ids`,evidenceAllowed)}
    if(request.capability==="ai_related_keywords"){requireString(item.keyword,`${key}[${index}].keyword`);requireIdArray(item.source_keyword_ids,`${key}[${index}].source_keyword_ids`,baselineAllowed)}
    if(request.capability==="ai_keyword_proposal"){requireString(item.keyword,`${key}[${index}].keyword`);requireString(item.intent,`${key}[${index}].intent`);requireIdArray(item.source_keyword_ids,`${key}[${index}].source_keyword_ids`,baselineAllowed)}
  }
  const record={request_id:request.request_id,request_digest:request.request_digest,capability:request.capability,model:envelope.model,usage:envelope.usage,cost_usd:envelope.cost_usd,output:envelope.output,completed_at:envelope.completed_at,validation_state:"validated_not_selected",human_review_state:"not_started",auto_selection:false,auto_content_mutation:false};
  return{...record,result_digest:digest(record)};
}

export function buildBlindedChallengerReviewPacket(request,validatedResult){
  if(validatedResult.request_digest!==request.request_digest)throw new Error("validated result does not match request");
  const challengerFirst=parseInt(validatedResult.result_digest.slice(0,2),16)%2===0,base={schema_version:"generation-challenger-review-packet.v1",request_id:request.request_id,capability:request.capability,rubric:request.evaluation_contract.rubric,minimum_reviewers:request.evaluation_contract.minimum_reviewers,option_a:challengerFirst?validatedResult.output:request.input.baseline_payload,option_b:challengerFirst?request.input.baseline_payload:validatedResult.output,origin_labels_hidden:true,source_scores_hidden:true,resolution_exposed:false,automatic_winner_selection:false,auto_content_mutation:false};
  const resolution={challenger_option:challengerFirst?"a":"b",baseline_option:challengerFirst?"b":"a",request_digest:request.request_digest,result_digest:validatedResult.result_digest};
  return{packet:{...base,packet_digest:digest(base)},resolution:{...resolution,resolution_digest:digest(resolution)}};
}
