import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const close=(left,right)=>assert.ok(Math.abs(left-right)<1e-9,`${left} != ${right}`);
const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],portfolio=site.acquisition_remediation_portfolio,expected=portfolio.summary;
  const api=routeResearchApi("/api/v1/acquisition-remediation-portfolio",new URL(`http://localhost/api/v1/acquisition-remediation-portfolio?site_id=${site.site_id}&limit=100`),data,db),summary=api.body.summary,{filtered_count,...retainedSummary}=summary;
  assert.equal(api.status,200);
  assert.equal(api.body.meta.total,portfolio.candidates.length);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(filtered_count,portfolio.candidates.length);
  assert.equal(summary.remediation_task_count,summary.aio_remediation_count+summary.paa_remediation_count-summary.combined_remediation_count);
  assert.equal(summary.separate_plan_task_count,summary.aio_remediation_count+summary.paa_remediation_count);
  assert.equal(summary.avoided_duplicate_task_count,summary.combined_remediation_count);
  close(summary.consolidation_savings_usd,summary.separate_plan_maximum_cost_usd-summary.maximum_cost_usd);
  assert.equal(summary.submitted_count,0);
  assert.equal(summary.external_acquisition_triggered_count,0);
  assert(api.body.data.every((row)=>!row.external_acquisition_triggered&&!row.auto_submission));
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"plan_acquisition_remediation",arguments:{site_id:site.site_id,view:"batches",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,portfolio.batches.length);
  console.log(`acquisition remediation API/MCP: OK (${summary.remediation_task_count} unified tasks, ${summary.avoided_duplicate_task_count} avoided, $${summary.consolidation_savings_usd} saved, zero submission)`);
} finally {
  db.close();
}
