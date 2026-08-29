import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],portfolio=site.aio_completion_portfolio,expected=portfolio.summary;
  const api=routeResearchApi("/api/v1/aio-completion",new URL(`http://localhost/api/v1/aio-completion?site_id=${site.site_id}&limit=100`),data,db),summary=api.body.summary,{filtered_count,...retainedSummary}=summary;
  assert.equal(api.status,200);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(api.body.meta.total,portfolio.candidates.length);
  assert.equal(filtered_count,portfolio.candidates.length);
  assert.equal(summary.observed_container_count,summary.resolved_count+summary.async_pending_count);
  assert.equal(summary.repost_required_count,portfolio.candidates.length);
  assert.equal(summary.submitted_count,0);
  assert(api.body.data.every((row)=>row.request.method==="POST"&&row.request.load_async_ai_overview&&row.maximum_cost_usd>=0&&!row.external_acquisition_triggered));
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"plan_aio_completion",arguments:{site_id:site.site_id,view:"batches",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,portfolio.batches.length);
  console.log(`AIO completion API/MCP: OK (${summary.repost_required_count} repost plans, $${summary.maximum_cost_usd} maximum, zero submission)`);
} finally { db.close(); }
