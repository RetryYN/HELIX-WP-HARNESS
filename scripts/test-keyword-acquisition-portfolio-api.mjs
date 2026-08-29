import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const close=(left,right)=>assert.ok(Math.abs(left-right)<1e-9,`${left} != ${right}`);
const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],portfolio=site.keyword_acquisition_portfolio,expected=portfolio.summary;
  const url=new URL(`/api/v1/keyword-acquisition-portfolio?site_id=${site.site_id}&limit=100`,"http://localhost");
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_count,...retainedSummary}=summary;
  assert.equal(api.body.meta.total,portfolio.candidates.length);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(filtered_count,portfolio.candidates.length);
  assert.equal(Object.values(summary.tier_counts).reduce((sum,count)=>sum+count,0),portfolio.candidates.length);
  close(summary.estimated_total_cost_usd,summary.planned_count*summary.estimated_unit_cost_usd);
  assert.equal(summary.submitted_count,0);
  assert.equal(api.body.auto_submission,false);
  assert.equal(api.body.external_acquisition_triggered,false);
  const batchUrl=new URL(`/api/v1/keyword-acquisition-portfolio?site_id=${site.site_id}&view=batches&limit=100`,"http://localhost"),batches=routeResearchApi(batchUrl.pathname,batchUrl,data,db);
  assert.equal(batches.body.meta.total,portfolio.batches.length);
  assert(batches.body.data.every((row)=>row.lifecycle_state==="planned_not_submitted"));
  const expectedBoundary=summary.tier_counts.boundary_review_blocker??0;
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"plan_keyword_acquisition",arguments:{site_id:site.site_id,tier:"boundary_review_blocker",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,expectedBoundary);
  console.log(`keyword acquisition API/MCP: OK (${portfolio.candidates.length} candidates, ${portfolio.batches.length} batches, ${summary.avoided_task_count} avoided tasks, zero submission)`);
} finally { db.close(); }
