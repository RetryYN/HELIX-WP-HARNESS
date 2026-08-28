import {createHash} from "node:crypto";
import {buildClaimCitationRecommendations} from "./content-claim-citations.mjs";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildConsolidationCitationBackfill(blueprints,structures,citations,{minimumScore=.25,maximumPerClaim=3}={}){
  const revisionByGroup=new Map(structures.map((row)=>[row.group_id,row.draft_package?.draft_revision]).filter(([,revision])=>revision)),citationById=new Map(citations.map((row)=>[row.citation_id,row])),rows=[];
  for(const blueprint of blueprints){
    const draft=blueprint.merged_draft_preview,missing=new Set(draft.gate.missing_citation_source_claim_ids??[]),mergedBySource=new Map(draft.claims.flatMap((claim)=>claim.source_claim_ids.map((id)=>[id,claim.claim_id]))),existingByMerged=Map.groupBy(draft.citation_recommendations??[],(row)=>row.merged_claim_id);
    for(const group of [blueprint.left_group_id,blueprint.right_group_id]){
      const revision=revisionByGroup.get(group);if(!revision)continue;
      const queue=buildClaimCitationRecommendations(revision,citations,{minimumScore,maximumPerClaim});
      for(const item of queue.recommendations.filter((row)=>missing.has(row.claim_id))){const mergedClaimId=mergedBySource.get(item.claim_id),sourceGroupIds=[...new Set(item.citation_ids.map((id)=>citationById.get(id)?.group_id).filter(Boolean))].sort(),existingMergedUrls=new Set((existingByMerged.get(mergedClaimId)??[]).map((row)=>row.url)),record={left_group_id:blueprint.left_group_id,right_group_id:blueprint.right_group_id,target_source_group_id:group,target_source_claim_id:item.claim_id,merged_claim_id:mergedClaimId,rank:item.rank,url:item.url,domain:item.domain,title:item.title,source:item.source,source_text:item.source_text,match_score:item.match_score,score_components:item.score_components,citation_ids:item.citation_ids,source_keywords:item.source_keywords,citation_source_group_ids:sourceGroupIds,occurrence_count:item.occurrence_count,duplicates_existing_merged_url:existingMergedUrls.has(item.url),candidate_origin:"cross_group_retained_corpus",backfill_state:"proposed_unreviewed",approval_state:"unreviewed",selection_state:"review_only_not_applied",auto_approval:false,minimum_score:minimumScore,policy:"content-consolidation-citation-backfill.v1"};rows.push({...record,backfill_digest:digest(record)})}
    }
  }
  const targetClaims=new Set(rows.map((row)=>row.target_source_claim_id)),urls=new Set(rows.map((row)=>row.url));return{policy:"content-consolidation-citation-backfill.v1",rows,summary:{backfill_candidate_count:rows.length,target_source_claim_count:targetClaims.size,unique_url_count:urls.size,cross_group_candidate_count:rows.filter((row)=>row.candidate_origin==="cross_group_retained_corpus").length,duplicate_existing_merged_url_count:rows.filter((row)=>row.duplicates_existing_merged_url).length,unreviewed_count:rows.filter((row)=>row.approval_state==="unreviewed").length,minimum_score:minimumScore,maximum_per_claim:maximumPerClaim,selection_state:"review_only_not_applied",auto_approval:false}};
}
