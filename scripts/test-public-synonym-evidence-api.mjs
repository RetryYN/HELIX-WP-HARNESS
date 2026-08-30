import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi,researchOpenApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  assert.equal(Number(db.prepare("SELECT COUNT(*) count FROM public_lexical_sources").get().count),1);
  assert.equal(Number(db.prepare("SELECT COUNT(*) count FROM public_synonym_pairs").get().count),11753);
  assert.equal(Number(db.prepare("SELECT COUNT(*) count FROM public_synonym_pairs WHERE context_review_required=1 AND auto_replacement=0").get().count),11753);
  const data=projectDashboard(db),site=data.sites.find((row)=>row.public_synonym_evidence?.rows.length);
  assert(site);assert.equal(site.public_synonym_evidence.summary.pair_count,11753);assert.equal(site.public_synonym_evidence.summary.unique_term_count,9487);assert.equal(site.public_synonym_evidence.summary.site_corpus_matched_pair_count,840);assert.equal(site.public_synonym_evidence.summary.site_corpus_matched_term_count,206);
  const url=new URL(`/api/v1/public-synonyms?site_id=${site.site_id}&q=${encodeURIComponent("トラブル")}&limit=100`,"http://localhost"),response=routeResearchApi(url.pathname,url,data,db);
  assert.equal(researchOpenApi.info.version,"2.106.0");assert.equal(response.status,200);assert(response.body.meta.total>0);assert(response.body.data.some((row)=>row.left_term==="トラブル"||row.right_term==="トラブル"));assert(response.body.data.every((row)=>row.context_review_required&&!row.auto_replacement&&row.evidence_digest.length===64));assert.equal(response.body.source.pair_file_sha256,"d8a017df64945559aa3c8f713efba96c52cada3055558135762f76c482339a9e");assert.equal(response.body.provenance.external_acquisition_triggered,false);
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"search_public_synonyms",arguments:{site_id:site.site_id,query:"トラブル",limit:100}}},data).result;
  assert.equal(mcp.isError,false);assert.equal(mcp.structuredContent.meta.total,response.body.meta.total);assert.equal(mcp.structuredContent.automatic_replacement,false);
  console.log(`public synonym evidence API/MCP: OK (11,753 pairs, 9,487 terms, ${site.public_synonym_evidence.summary.site_corpus_matched_pair_count} corpus matches, $0)`);
}finally{db.close()}
