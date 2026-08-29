import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],portfolio=site.paa_answer_completion_portfolio,expected=portfolio.summary;
  const url=new URL(`/api/v1/paa-answer-completion?site_id=${site.site_id}&limit=100`,"http://localhost");
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_count,...retainedSummary}=summary;
  assert.equal(api.status,200);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(api.body.meta.total,portfolio.candidates.length);
  assert.equal(filtered_count,portfolio.candidates.length);
  assert.equal(summary.observed_question_count,summary.resolved_question_count+summary.pending_question_count);
  assert.equal(summary.completion_task_count,portfolio.candidates.length);
  assert.equal(summary.submitted_count,0);
  assert(api.body.data.every((row)=>!row.external_acquisition_triggered&&!row.auto_submission));
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"plan_paa_answer_completion",arguments:{site_id:site.site_id,view:"batches",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,portfolio.batches.length);
  console.log(`PAA completion API/MCP: OK (${summary.pending_question_count} pending questions, ${summary.completion_task_count} tasks, $${summary.maximum_cost_usd} maximum, zero submission)`);
} finally { db.close(); }
