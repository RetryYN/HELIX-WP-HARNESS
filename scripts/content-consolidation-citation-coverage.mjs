import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const round=(value)=>Number(value.toFixed(6));

export function buildConsolidationCitationCoverage(blueprints){
  const rows=[];
  for(const blueprint of blueprints){
    const draft=blueprint.merged_draft_preview,recommendations=draft.citation_recommendations??[];
    for(const claim of draft.claims.filter((item)=>item.claim_kind!=="editorial_scope")){
      const candidates=recommendations.filter((item)=>item.merged_claim_id===claim.claim_id),coveredSourceClaimIds=[...new Set(candidates.map((item)=>item.source_claim_id))].sort(),missingSourceClaimIds=claim.source_claim_ids.filter((id)=>!coveredSourceClaimIds.includes(id)).sort(),urls=[...new Set(candidates.map((item)=>item.url))].sort(),domains=[...new Set(candidates.map((item)=>item.domain))].sort(),scores=candidates.map((item)=>item.match_score),coverageRatio=claim.source_claim_ids.length?coveredSourceClaimIds.length/claim.source_claim_ids.length:0,coverageState=!candidates.length?"no_citation_candidate":missingSourceClaimIds.length?"partial_source_lineage_coverage":"complete_source_lineage_coverage",domainDiversityState=!domains.length?"no_domain":domains.length===1?"single_domain":"diverse_domains",reasonCodes=[];
      if(!candidates.length)reasonCodes.push("citation_candidate_missing");
      if(missingSourceClaimIds.length)reasonCodes.push("source_claim_citation_coverage_incomplete");
      if(domains.length<2)reasonCodes.push("citation_domain_diversity_insufficient");
      reasonCodes.push("citation_approval_pending");
      const record={left_group_id:blueprint.left_group_id,right_group_id:blueprint.right_group_id,merged_claim_id:claim.claim_id,source_claim_ids:[...claim.source_claim_ids].sort(),covered_source_claim_ids:coveredSourceClaimIds,missing_source_claim_ids:missingSourceClaimIds,source_claim_count:claim.source_claim_ids.length,covered_source_claim_count:coveredSourceClaimIds.length,source_lineage_coverage_ratio:round(coverageRatio),candidate_count:candidates.length,unique_url_count:urls.length,unique_domain_count:domains.length,urls,domains,best_match_score:scores.length?Math.max(...scores):null,worst_match_score:scores.length?Math.min(...scores):null,average_match_score:scores.length?round(scores.reduce((sum,value)=>sum+value,0)/scores.length):null,coverage_state:coverageState,domain_diversity_state:domainDiversityState,reason_codes:reasonCodes,publication_state:"blocked",approval_state:"unreviewed",auto_approval:false,policy:"content-consolidation-citation-coverage.v1"};
      rows.push({...record,audit_digest:digest(record)});
    }
  }
  const sourceClaimCount=rows.reduce((sum,row)=>sum+row.source_claim_count,0),coveredSourceClaimCount=rows.reduce((sum,row)=>sum+row.covered_source_claim_count,0);
  return{policy:"content-consolidation-citation-coverage.v1",rows,summary:{claim_count:rows.length,complete_coverage_count:rows.filter((row)=>row.coverage_state==="complete_source_lineage_coverage").length,partial_coverage_count:rows.filter((row)=>row.coverage_state==="partial_source_lineage_coverage").length,no_candidate_count:rows.filter((row)=>row.coverage_state==="no_citation_candidate").length,diverse_domain_count:rows.filter((row)=>row.domain_diversity_state==="diverse_domains").length,source_claim_count:sourceClaimCount,covered_source_claim_count:coveredSourceClaimCount,missing_source_claim_count:sourceClaimCount-coveredSourceClaimCount,source_claim_coverage_ratio:sourceClaimCount?round(coveredSourceClaimCount/sourceClaimCount):0,publication_blocked_count:rows.filter((row)=>row.publication_state==="blocked").length,auto_approval:false}};
}
