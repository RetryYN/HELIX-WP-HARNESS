import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildNewArticleSourceDiscoveryManifest(briefQueue,claimPortfolio,lifetimeAllocation){
  const groups=new Set((briefQueue.rows??[]).filter((row)=>row.source_preparation_state==="source_discovery_required").map((row)=>row.group_id));
  const candidates=(claimPortfolio.candidates??[]).filter((row)=>groups.has(row.group_id));
  const byGroup=Map.groupBy(candidates,(row)=>row.group_id);
  const remaining=lifetimeAllocation?.summary?.remaining_after_selected_plan_usd??null;
  const rows=[...byGroup.entries()].map(([groupId,claims])=>{
    const base={group_id:groupId,claim_count:claims.length,p0_claim_count:claims.filter((row)=>row.priority_band==="P0").length,selected_query_count:claims.length,unique_selected_query_count:new Set(claims.map((row)=>row.selected_query)).size,source_requirement_counts:Object.fromEntries(Object.entries(Object.groupBy(claims,(row)=>row.source_requirement)).map(([key,items])=>[key,items.length])),queries:claims.map((row)=>({claim_id:row.claim_id,priority_band:row.priority_band,source_requirement:row.source_requirement,selected_query:row.selected_query,preferred_source_classes:row.preferred_source_classes,candidate_digest:row.candidate_digest})),estimated_cost_usd:null,price_verification_required:true,lifetime_remaining_after_selected_plan_usd:remaining,budget_allocation_state:"unpriced_unallocated",explicit_approval_required:true,execution_authorized:false,external_discovery_executed:false,auto_approval:false,auto_publication:false,policy:"new-article-source-discovery-manifest.v1"};
    return{...base,manifest_digest:digest(base)};
  }).sort((a,b)=>b.p0_claim_count-a.p0_claim_count||b.claim_count-a.claim_count||a.group_id.localeCompare(b.group_id));
  const allQueries=rows.flatMap((row)=>row.queries);
  const summary={brief_count:rows.length,claim_count:allQueries.length,p0_claim_count:allQueries.filter((row)=>row.priority_band==="P0").length,selected_query_count:allQueries.length,unique_selected_query_count:new Set(allQueries.map((row)=>row.selected_query)).size,duplicate_query_suppressed_count:allQueries.length-new Set(allQueries.map((row)=>row.selected_query)).size,source_requirement_counts:Object.fromEntries(Object.entries(Object.groupBy(allQueries,(row)=>row.source_requirement)).map(([key,items])=>[key,items.length])),estimated_cost_usd:null,price_verification_required:true,lifetime_remaining_after_selected_plan_usd:remaining,budget_allocated_count:0,execution_authorized_count:0,external_discovery_executed_count:0,auto_approval_count:0,auto_publication_count:0};
  return{rows,summary,manifest_digest:digest({rows,summary})};
}
