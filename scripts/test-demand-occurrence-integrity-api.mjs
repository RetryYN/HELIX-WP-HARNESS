import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],oracle=site.demand_occurrence_integrity,expected=oracle.summary;
  const url=new URL(`/api/v1/demand-occurrence-integrity?site_id=${site.site_id}&limit=100`,"http://localhost");
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_demand_count,filtered_occurrence_count,...retainedSummary}=summary;
  assert.equal(api.status,200);
  assert.equal(api.body.meta.total,oracle.rows.length);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(filtered_demand_count,oracle.rows.length);
  assert.equal(filtered_occurrence_count,summary.occurrence_count);
  assert.equal(summary.demand_count,summary.paa_demand_count+summary.related_search_demand_count);
  assert.equal(summary.demand_count,summary.multi_day_history_count+summary.single_day_snapshot_count);
  assert.ok(summary.review_required_count>=summary.orphan_occurrence_count);
  assert.equal(summary.orphan_occurrence_count,0);
  assert.equal(api.body.absolute_search_volume_inferred,false);
  assert.equal(summary.payload_evidence_evaluated,true);
  assert.equal(summary.feature_payload_linked_occurrence_count,summary.occurrence_count);
  assert.equal(summary.feature_payload_unlinked_occurrence_count,0);
  assert.equal(summary.feature_payload_unlinked_demand_count,0);
  assert.equal(summary.snapshot_provenance_retained_occurrence_count,summary.occurrence_count);
  const paaOccurrenceCount=oracle.rows.filter((row)=>row.demand_type==="paa").reduce((sum,row)=>sum+row.occurrence_count,0);
  assert.equal(summary.paa_answer_state_counts.resolved+summary.paa_answer_state_counts.async_pending+summary.paa_answer_state_counts.empty+summary.paa_answer_state_counts.not_returned,paaOccurrenceCount);
  assert.equal(summary.paa_answer_not_returned_occurrence_count,summary.paa_answer_state_counts.async_pending+summary.paa_answer_state_counts.empty+summary.paa_answer_state_counts.not_returned);
  assert.equal(api.body.policy,"demand-occurrence-integrity.v2");

  const expectedCrossGroup=oracle.rows.filter((row)=>row.scope_state==="cross_group_repeated").length;
  assert.equal(summary.cross_group_repeated_count,expectedCrossGroup);
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"audit_demand_occurrences",arguments:{site_id:site.site_id,scope:"cross_group_repeated",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,expectedCrossGroup);
  console.log(`demand occurrence API/MCP: OK (${summary.demand_count} demands, ${summary.occurrence_count} occurrences, zero integrity gaps)`);
} finally {
  db.close();
}
