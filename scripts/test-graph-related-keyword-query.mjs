import assert from "node:assert/strict";
import {openDashboardDb} from "./keyword-dashboard-db.mjs";
import {queryGraphRelatedKeywords} from "./graph-related-keyword-query.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const result=queryGraphRelatedKeywords(db,{siteId:"site-a.example",query:"企業",depth:1});assert.equal(result.summary.inventory_row_count,10694);assert.equal(result.summary.candidate_count,482);assert.equal(result.summary.lexical_supported_count,120);assert.equal(result.summary.semantic_path_candidate_count,365);assert.equal(result.summary.lexical_and_semantic_path_count,3);assert.equal(result.summary.external_market_coverage_count,0);assert.equal(result.summary.auto_group_assignment_count,0);assert.equal(result.summary.auto_content_mutation_count,0);assert(result.query.semantic_queries[0].seed_senses.every((row)=>row.sense_id.length===64&&row.synset&&row.definition));const candidate=result.rows.find((row)=>row.raw_keyword==="新卒 大企業");assert(candidate);assert.equal(candidate.match_state,"lexical_and_semantic_path");assert(candidate.semantic_paths.some((row)=>row.query_token==="企業"&&row.matched_term==="大企業"&&row.traversal_relation_type==="hypo"));assert.equal(candidate.group_boundary.state,"no_group_candidate");assert.equal(candidate.group_boundary.review_required,true);assert(result.rows.every((row)=>row.source_keyword_id&&row.evidence_digest.length===64&&!row.synonymy_inferred&&!row.search_demand_inferred&&!row.ranking_effect_inferred&&!row.auto_group_assignment&&!row.auto_content_mutation));
  const empty=queryGraphRelatedKeywords(db,{siteId:"site-a.example",query:""});assert.equal(empty.rows.length,0);assert.equal(empty.summary.auto_group_assignment_count??0,0);
  console.log("graph related keyword query: OK (10,694 retained rows, lexical/semantic paths separated, group boundaries fail closed)");
}finally{db.close()}
