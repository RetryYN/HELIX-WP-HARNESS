import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildConsolidationCitationObservationLineage(recommendations,backfillCandidates,citationReferences,snapshotInventory){
  const referenceById=new Map(citationReferences.map((row)=>[row.citation_id,row]));
  const snapshotByTask=new Map(snapshotInventory.map((row)=>[row.task_id,row]));
  const inputs=[
    ...recommendations.map((row)=>({candidate_kind:"merged_recommendation",candidate_digest:row.recommendation_digest,left_group_id:row.left_group_id,right_group_id:row.right_group_id,merged_claim_id:row.merged_claim_id,citation_ids:row.citation_ids})),
    ...backfillCandidates.map((row)=>({candidate_kind:"cross_group_backfill",candidate_digest:row.backfill_digest,left_group_id:row.left_group_id,right_group_id:row.right_group_id,merged_claim_id:row.merged_claim_id,citation_ids:row.citation_ids}))
  ];
  const rows=[];
  for(const candidate of inputs)for(const citationId of candidate.citation_ids){
    const reference=referenceById.get(citationId),snapshot=reference&&snapshotByTask.get(reference.task_id);
    const record={candidate_kind:candidate.candidate_kind,candidate_digest:candidate.candidate_digest,left_group_id:candidate.left_group_id,right_group_id:candidate.right_group_id,merged_claim_id:candidate.merged_claim_id,citation_id:citationId,resolution_state:reference&&snapshot?"resolved":"unresolved",task_id:reference?.task_id??null,source_group_id:reference?.group_id??null,source_keyword:reference?.source_keyword??null,reference_order:reference?.reference_order??null,observed_at:snapshot?.observed_at??null,snapshot_digest:snapshot?.snapshot_digest??null,artifact_dataset:snapshot?.artifact_dataset??null,policy:"content-consolidation-citation-observation-lineage.v1"};
    rows.push({...record,lineage_digest:digest(record)});
  }
  return{policy:"content-consolidation-citation-observation-lineage.v1",rows,summary:{association_count:rows.length,recommendation_association_count:rows.filter((row)=>row.candidate_kind==="merged_recommendation").length,backfill_association_count:rows.filter((row)=>row.candidate_kind==="cross_group_backfill").length,resolved_count:rows.filter((row)=>row.resolution_state==="resolved").length,unresolved_count:rows.filter((row)=>row.resolution_state==="unresolved").length,unique_citation_count:new Set(rows.map((row)=>row.citation_id)).size,unique_task_count:new Set(rows.map((row)=>row.task_id).filter(Boolean)).size,oldest_observed_at:rows.map((row)=>row.observed_at).filter(Boolean).sort()[0]??null,newest_observed_at:rows.map((row)=>row.observed_at).filter(Boolean).sort().at(-1)??null}};
}
