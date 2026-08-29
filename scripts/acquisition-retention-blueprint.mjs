import {createHash} from "node:crypto";
const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const rawTargets=["acquisition_raw_payloads.payload_json","acquisition_field_occurrences.value_json"];
function futureTargets(row){
  if(row.disposition==="provider_execution_metadata_not_acquired"){
    if(row.field_path.endsWith("consumedCredit"))return ["acquisition_operation_runs.consumed_credit",...rawTargets];
    if(row.field_path.endsWith("entryNo"))return ["acquisition_operation_entries.entry_no",...rawTargets];
    return ["acquisition_operation_runs.provider_request_id","acquisition_operation_entries.provider_request_id",...rawTargets];
  }
  if(row.disposition==="provider_metric_not_acquired"){
    const kind=row.field_path.endsWith("rankingKeywordCount")?"ranking_keyword_count":row.field_path.endsWith("keywordCount")?"keyword_count":row.field_path.endsWith("trafficValue")?"traffic_value":row.field_path.endsWith("estimatedTraffic")?"estimated_traffic":null;
    return kind?[`traffic_metric_observations.metric_kind:${kind}`,"traffic_metric_observations.metric_value",...rawTargets]:rawTargets;
  }
  if(row.disposition==="provider_history_not_acquired")return ["appearance_history_observations.first_seen_range_json",...rawTargets];
  return [...new Set([...row.helix_targets,...rawTargets])];
}
export function buildAcquisitionRetentionBlueprint(fieldAudit){
  const rows=fieldAudit.rows.map((row)=>{const record={field_id:row.field_id,schema:row.schema,occurrence:row.occurrence,field_path:row.field_path,roles:row.roles,operations:row.operations,disposition:row.disposition,current_targets:row.helix_targets,future_lossless_targets:futureTargets(row),acquisition_state:row.disposition.includes("not_acquired")?"not_acquired":"retained_or_contract_only",external_request_executed:false};return{...record,row_digest:digest(record)}});
  const dispositions=Object.fromEntries(Object.keys(fieldAudit.disposition_counts).map((state)=>[state,rows.filter((row)=>row.disposition===state).length]));
  const base={schema_version:"acquisition-retention-blueprint.v1",source_field_audit_digest:fieldAudit.audit_digest,field_occurrence_count:rows.length,future_covered_count:rows.filter((row)=>row.future_lossless_targets.length>0).length,future_uncovered_count:rows.filter((row)=>!row.future_lossless_targets.length).length,not_acquired_field_count:rows.filter((row)=>row.acquisition_state==="not_acquired").length,disposition_counts:dispositions,raw_payload_retention:"lossless_json_plus_leaf_occurrences",semantic_projection_policy:"explicit_audited_projection",credentials_retained:false,external_request_executed:false,rows};
  return {...base,blueprint_digest:digest(base)};
}

