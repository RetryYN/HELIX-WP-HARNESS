import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],oracle=site.question_lineage_oracle,expected=oracle.summary;
  const url=new URL(`/api/v1/question-lineage?site_id=${site.site_id}&limit=100`,"http://localhost");
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_question_count,...retainedSummary}=summary;
  assert.equal(api.status,200);
  assert.equal(api.body.meta.total,oracle.rows.length);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(filtered_question_count,oracle.rows.length);
  assert.equal(summary.question_candidate_count,summary.observed_question_count+summary.derived_question_count);
  assert.equal(summary.question_candidate_count,summary.paa_source_count+summary.related_search_source_count);
  assert.equal(summary.question_candidate_count,summary.covered_content_count+summary.missing_content_count+summary.unassigned_content_count);
  assert.equal(summary.resolved_answer_evidence_count,summary.resolved_answer_linked_count+summary.resolved_answer_unlinked_count);
  assert.equal(summary.lineage_anomaly_count,0);

  const reviewUrl=new URL(`/api/v1/question-lineage?site_id=${site.site_id}&view=unlinked_answers&limit=100`,"http://localhost");
  const review=routeResearchApi(reviewUrl.pathname,reviewUrl,data,db);
  assert.equal(review.body.view,"unlinked_answers");
  assert.equal(review.body.meta.total,oracle.unlinked_resolved_answers.length);
  assert.ok(review.body.data.every((row)=>row.review_required&&row.answer_count>0&&row.evidence_digest.length===64));

  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"audit_question_lineage",arguments:{site_id:site.site_id,kind:"observed_question",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,summary.observed_question_count);
  const reviewMcp=handleMcpMessage({jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"audit_question_lineage",arguments:{site_id:site.site_id,view:"unlinked_answers",limit:100}}},data);
  assert.equal(reviewMcp.result.structuredContent.meta.total,summary.resolved_answer_unlinked_count);
  console.log(`question lineage API/MCP: OK (${summary.question_candidate_count} retained candidates, ${summary.resolved_answer_unlinked_count} unlinked resolved-answer reviews, zero anomalies)`);
} finally {
  db.close();
}
