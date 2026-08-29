import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],oracle=site.semantic_candidate_review,expected=oracle.summary;
  const url=new URL(`/api/v1/semantic-candidate-reviews?site_id=${site.site_id}&limit=100`,"http://localhost");
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_candidate_pair_count,...retainedSummary}=summary;
  assert.equal(api.body.meta.total,oracle.rows.length);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(filtered_candidate_pair_count,oracle.rows.length);
  assert.equal(summary.candidate_pair_count,summary.possible_compound_count+summary.contextual_relation_count+summary.distinct_context_count+summary.insufficient_context_count);
  assert.equal(summary.editor_decided_count,0);
  assert.equal(api.body.semantic_equivalence_inferred,false);
  assert.equal(api.body.editor_decision_required,true);
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"review_semantic_candidates",arguments:{site_id:site.site_id,state:"contextual_relation_review",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,summary.contextual_relation_count);
  console.log(`semantic candidate API/MCP: OK (${summary.candidate_pair_count} relation candidates, editor review required, no synonym assertion)`);
} finally { db.close(); }
