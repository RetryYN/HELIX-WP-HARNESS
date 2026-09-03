import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalize=(value)=>String(value??"").normalize("NFKC").trim().replace(/\s+/gu," ").toLocaleLowerCase("ja-JP");
const asArray=(value)=>Array.isArray(value)?value:[];

function payloadOf(row){
  if(row?.payload&&typeof row.payload==="object")return row.payload;
  if(typeof row?.payload_json!=="string")return null;
  try{return JSON.parse(row.payload_json)}catch{return null}
}

function featureTypeFor(demandType){return demandType==="paa"?"people_also_ask":demandType==="related_search"?"related_searches":null}

function itemValue(item){return typeof item==="string"?item:item?.title??item?.value??null}

function answerState(item){
  const expanded=asArray(item?.expanded_element);
  const hasAnswer=expanded.some((entry)=>{
    const items=entry?.items,references=entry?.references;
    return asArray(items).length>0||asArray(references).length>0||Boolean(entry?.table&&typeof entry.table==="object");
  });
  if(hasAnswer)return "resolved";
  if(expanded.some((entry)=>entry?.asynchronous_ai_overview===true))return "async_pending";
  if(expanded.length)return "empty";
  return "not_returned";
}

function inspectOccurrence(row,featureByTask){
  const expectedType=featureTypeFor(row.demand_type),features=(featureByTask.get(row.task_id)??[]).filter((feature)=>feature.feature_type===expectedType),needle=normalize(row.value??row.normalized_value);
  let match=null;
  for(const feature of features){
    const payload=payloadOf(feature),items=asArray(payload?.items),itemOrder=items.findIndex((item)=>normalize(itemValue(item))===needle);
    if(itemOrder<0)continue;
    const item=items[itemOrder];
    match={feature_id:feature.feature_id??null,feature_item_order:itemOrder,payload_digest:digest(payload),answer_state:row.demand_type==="paa"?answerState(item):"not_applicable"};
    break;
  }
  const snapshotProvenanceRetained=typeof row.snapshot_digest==="string"&&/^[a-f0-9]{64}$/u.test(row.snapshot_digest)&&Boolean(row.snapshot_path);
  return {occurrence_id:row.occurrence_id??null,demand_type:row.demand_type??null,feature_payload_linked:Boolean(match),feature_id:match?.feature_id??null,feature_item_order:match?.feature_item_order??null,payload_digest:match?.payload_digest??null,answer_state:match?.answer_state??(row.demand_type==="paa"?"not_returned":"not_applicable"),snapshot_provenance_retained:snapshotProvenanceRetained};
}

const stateCounts=(rows)=>Object.fromEntries(["resolved","async_pending","empty","not_returned","not_applicable"].map((state)=>[state,rows.filter((row)=>row.answer_state===state).length]));

/**
 * Reconstruct demand aggregates and explicitly account for the boundary between
 * the semantic occurrence projection and its retained SERP feature payload.
 * A missing answer is reported as provider_not_returned; it is never silently
 * labelled as a post-acquisition discard.
 */
export function buildDemandOccurrenceIntegrity(aggregates,occurrences,featureOccurrences=[]){
  const byKey=Map.groupBy(occurrences,(row)=>`${row.demand_type}\0${row.normalized_value}`),featureByTask=Map.groupBy(featureOccurrences,(row)=>row.task_id),payloadEvidenceEvaluated=featureOccurrences.length>0;
  const rows=aggregates.map((aggregate)=>{
    const evidence=byKey.get(`${aggregate.demand_type}\0${aggregate.normalized_value}`)??[],taskIds=[...new Set(evidence.map((row)=>row.task_id))].sort(),groupIds=[...new Set(evidence.map((row)=>row.group_id))].sort(),sourceKeywords=[...new Set(evidence.map((row)=>row.source_keyword))].sort(),observed=evidence.map((row)=>row.observed_at).sort(),anomalies=[];
    if(evidence.length!==aggregate.occurrence_count)anomalies.push("occurrence_count_mismatch");
    if(taskIds.length!==aggregate.task_count)anomalies.push("task_count_mismatch");
    if(groupIds.length!==aggregate.group_count)anomalies.push("group_count_mismatch");
    if(JSON.stringify(taskIds)!==JSON.stringify([...aggregate.task_ids].sort()))anomalies.push("task_identity_mismatch");
    if(JSON.stringify(groupIds)!==JSON.stringify([...aggregate.group_ids].sort()))anomalies.push("group_identity_mismatch");
    if(JSON.stringify(sourceKeywords)!==JSON.stringify([...aggregate.source_keywords].sort()))anomalies.push("source_keyword_mismatch");
    if(observed[0]!==aggregate.first_observed_at||observed.at(-1)!==aggregate.last_observed_at)anomalies.push("observation_window_mismatch");
    if(evidence.some((row)=>!row.snapshot_digest||row.snapshot_digest.length!==64))anomalies.push("snapshot_digest_missing");
    const occurrenceEvidence=evidence.map((row)=>inspectOccurrence(row,featureByTask)),linked=occurrenceEvidence.filter((row)=>row.feature_payload_linked),unlinked=occurrenceEvidence.filter((row)=>!row.feature_payload_linked),answerPayloadRetained=occurrenceEvidence.filter((row)=>row.answer_state==="resolved"),answerNotReturned=occurrenceEvidence.filter((row)=>row.demand_type==="paa"&&row.answer_state!=="resolved");
    const featurePayloadLinkState=!payloadEvidenceEvaluated?"not_evaluated":unlinked.length===0?"all_occurrences_linked":linked.length===0?"no_occurrences_linked":"partial_occurrences_linked";
    const scope=groupIds.length>1?"cross_group_repeated":taskIds.length>1?"within_group_repeated":"single_task_observation",days=new Set(observed.map((value)=>value.slice(0,10)));
    const retention_evidence={schema_version:"demand-payload-retention.v1",payload_evidence_evaluated:payloadEvidenceEvaluated,feature_payload_link_state:featurePayloadLinkState,occurrence_count:evidence.length,feature_payload_linked_occurrence_count:linked.length,feature_payload_unlinked_occurrence_count:unlinked.length,feature_payload_unlinked_occurrence_ids:unlinked.map((row)=>row.occurrence_id),snapshot_provenance_retained_occurrence_count:occurrenceEvidence.filter((row)=>row.snapshot_provenance_retained).length,paa_answer_state_counts:stateCounts(occurrenceEvidence),paa_answer_payload_retained_occurrence_count:answerPayloadRetained.length,paa_answer_not_returned_occurrence_count:answerNotReturned.length,feature_payload_ids:[...new Set(linked.map((row)=>row.feature_id).filter(Boolean))].sort(),feature_payload_digests:[...new Set(linked.map((row)=>row.payload_digest).filter(Boolean))].sort(),provider_answer_boundary:answerNotReturned.length?"provider_payload_not_returned":"no_missing_answer_payload",automatic_content_mutation:false};
    const base={demand_type:aggregate.demand_type,normalized_value:aggregate.normalized_value,representative_value:aggregate.representative_value,occurrence_count:evidence.length,task_count:taskIds.length,group_count:groupIds.length,source_keyword_count:sourceKeywords.length,best_serp_rank:aggregate.best_serp_rank,max_recursion_depth:Math.max(0,...evidence.map((row)=>row.recursion_depth)),importance_score:aggregate.importance_score,scope_state:scope,appearance_history_state:days.size>1?"multi_day_observed":"single_day_snapshot_only",observed_day_count:days.size,first_observed_at:observed[0]??null,last_observed_at:observed.at(-1)??null,occurrence_ids:evidence.map((row)=>row.occurrence_id),task_ids:taskIds,group_ids:groupIds,integrity_state:anomalies.length?"review_required":"verified",anomalies,retention_evidence,absolute_search_volume_inferred:false,auto_mutation:false,policy:"demand-occurrence-integrity.v2"};
    return {...base,evidence_digest:digest(base)};
  });
  const orphanOccurrenceCount=[...byKey].filter(([key])=>!aggregates.some((row)=>`${row.demand_type}\0${row.normalized_value}`===key)).reduce((sum,[,items])=>sum+items.length,0),retentionRows=rows.map((row)=>row.retention_evidence),sumEvidence=(field)=>retentionRows.reduce((sum,row)=>sum+Number(row[field]??0),0),paaAnswerStates=Object.fromEntries(["resolved","async_pending","empty","not_returned","not_applicable"].map((state)=>[state,retentionRows.reduce((sum,row)=>sum+Number(row.paa_answer_state_counts?.[state]??0),0)]));
  return{rows,summary:{demand_count:rows.length,occurrence_count:occurrences.length,paa_demand_count:rows.filter((row)=>row.demand_type==="paa").length,related_search_demand_count:rows.filter((row)=>row.demand_type==="related_search").length,cross_group_repeated_count:rows.filter((row)=>row.scope_state==="cross_group_repeated").length,within_group_repeated_count:rows.filter((row)=>row.scope_state==="within_group_repeated").length,single_task_count:rows.filter((row)=>row.scope_state==="single_task_observation").length,multi_day_history_count:rows.filter((row)=>row.appearance_history_state==="multi_day_observed").length,single_day_snapshot_count:rows.filter((row)=>row.appearance_history_state==="single_day_snapshot_only").length,review_required_count:rows.filter((row)=>row.integrity_state==="review_required").length,orphan_occurrence_count:orphanOccurrenceCount,payload_evidence_evaluated:payloadEvidenceEvaluated,feature_payload_linked_occurrence_count:sumEvidence("feature_payload_linked_occurrence_count"),feature_payload_unlinked_occurrence_count:sumEvidence("feature_payload_unlinked_occurrence_count"),feature_payload_unlinked_demand_count:rows.filter((row)=>row.retention_evidence.feature_payload_unlinked_occurrence_count>0).length,snapshot_provenance_retained_occurrence_count:sumEvidence("snapshot_provenance_retained_occurrence_count"),paa_answer_state_counts:paaAnswerStates,paa_answer_payload_retained_occurrence_count:sumEvidence("paa_answer_payload_retained_occurrence_count"),paa_answer_not_returned_occurrence_count:sumEvidence("paa_answer_not_returned_occurrence_count")},importance_policy:"relative_within_retained_corpus_not_absolute_demand",appearance_policy:"snapshot_observation_not_continuous_history",retention_policy:"semantic_projection_plus_feature_payload_lineage",provider_answer_boundary:"not_returned_is_not_discarded",auto_mutation:false,policy:"demand-occurrence-integrity.v2"};
}
