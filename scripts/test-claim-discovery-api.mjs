import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],portfolio=site.claim_discovery_portfolio,expected=portfolio.summary;
  const url=new URL(`/api/v1/claim-discovery-portfolio?site_id=${site.site_id}&limit=100`,"http://localhost");
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_count,...retainedSummary}=summary;
  assert.equal(api.status,200);
  assert.equal(api.body.meta.total,portfolio.candidates.length);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(filtered_count,portfolio.candidates.length);
  assert.equal(summary.selected_query_count,portfolio.candidates.length);
  assert.equal(summary.selected_query_count,summary.retained_citation_candidate_count+summary.missing_citation_candidate_count);
  assert.equal(summary.external_discovery_executed_count,0);
  assert.equal(api.body.estimated_cost_usd,null);
  assert(api.body.data.every((row)=>!row.external_discovery_executed&&!row.auto_approval));
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"plan_claim_discovery",arguments:{site_id:site.site_id,view:"batches",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,portfolio.batches.length);
  console.log(`claim discovery API/MCP: OK (${summary.selected_query_count} selected queries, ${summary.avoided_initial_query_count} alternatives deferred, ${summary.batch_count} batches, zero execution)`);
} finally { db.close(); }
