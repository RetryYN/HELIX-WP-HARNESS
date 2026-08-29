import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],contract=site.acquisition_contract_fulfillment,expected=contract.summary;
  const url=new URL(`http://localhost/api/v1/acquisition-contract-fulfillment?site_id=${site.site_id}&state=expansion_required&limit=100`);
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_count,...retainedSummary}=summary;
  assert.equal(api.status,200);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(summary.task_count,summary.expansion_required_count+summary.fulfilled_or_not_applicable_count);
  assert.equal(api.body.meta.total,summary.expansion_required_count);
  assert.equal(filtered_count,summary.expansion_required_count);
  assert.ok(summary.recorded_cost_usd>=0);
  assert.equal(summary.auto_retrieval_count,0);
  assert(api.body.data.every((row)=>row.fulfillment_state==="expansion_required"&&!row.auto_retrieval));
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"audit_acquisition_contracts",arguments:{site_id:site.site_id,state:"expansion_required",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,summary.expansion_required_count);
  console.log(`acquisition contract API/MCP: OK (${summary.task_count} tasks, ${summary.expansion_required_count} expansion reviews, zero retrieval)`);
} finally {
  db.close();
}
