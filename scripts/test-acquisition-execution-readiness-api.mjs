import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],expected=site.acquisition_execution_readiness;
  const api=routeResearchApi("/api/v1/acquisition-execution-readiness",new URL(`http://localhost/api/v1/acquisition-execution-readiness?site_id=${site.site_id}`),data,db),readiness=api.body.data;
  assert.equal(api.status,200);
  assert.deepEqual(readiness,expected);
  assert.equal(readiness.candidate_count,readiness.unique_source_task_count);
  assert.ok(readiness.candidate_count>0);
  assert.ok(readiness.maximum_cost_usd>0);
  assert.deepEqual(readiness.missing_request_fields,[]);
  assert.deepEqual(readiness.candidate_digest_mismatch_ids,[]);
  assert.deepEqual(readiness.batch_digest_mismatch_ids,[]);
  assert.deepEqual(readiness.request_contract_mismatch_ids,[]);
  const priceCurrent=readiness.price_age_days<=readiness.maximum_price_age_days;
  assert.equal(readiness.technical_ready,priceCurrent);
  assert.equal(readiness.authorization_ready,false);
  assert.equal(readiness.execution_ready,false);
  assert.equal(readiness.execution_state,priceCurrent?"blocked_approval_required":"blocked_technical_review");
  assert.deepEqual(readiness.blockers,priceCurrent?["explicit_paid_execution_approval_required"]:["price_snapshot_stale_or_invalid","explicit_paid_execution_approval_required"]);
  assert.equal(readiness.external_acquisition_triggered,false);
  assert.equal(readiness.auto_submission,false);
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"review_acquisition_execution_readiness",arguments:{site_id:site.site_id}}},data);
  assert.deepEqual(mcp.result.structuredContent.data,readiness);
  console.log(`acquisition readiness API/MCP: OK (${readiness.candidate_count} candidates, price ${priceCurrent?"current":"stale and blocked"}, explicit paid approval blocked, zero submission)`);
} finally {
  db.close();
}
