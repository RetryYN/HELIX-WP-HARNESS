import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const data=projectDashboard(db),site=data.sites[0],manifest=site.generation_challenger_manifest;
  assert.equal(manifest.summary.request_count,303);
  assert.deepEqual(manifest.summary.capability_counts,{ai_heading:63,ai_keyword_proposal:60,ai_questions:57,ai_related_keywords:60,ai_title:63});
  assert.equal(manifest.summary.baseline_payload_count,303);
  assert(manifest.requests.every((row)=>row.input.baseline_artifact_ids.length&&row.input.evidence_ids.length&&row.input.baseline_payload&&row.input.baseline_digest===createHash("sha256").update(JSON.stringify(row.input.baseline_payload)).digest("hex")&&row.prompt_contract.natural_language_prompt_recorded&&row.prompt_contract.system_instruction&&row.prompt_contract.output_schema&&row.prompt_contract.output_schema_digest.length===64&&row.input_contract.estimated_maximum_input_tokens>0&&row.token_ceiling.maximum_output_tokens>0&&row.maximum_cost_usd==null&&!row.execution_authorized&&!row.external_generation_triggered));
  const url=new URL(`/api/v1/generation-challenger-manifest?site_id=${site.site_id}&capability=ai_title&limit=100`,"http://localhost"),api=routeResearchApi(url.pathname,url,data,db);
  assert.equal(api.status,200);assert.equal(api.body.meta.total,63);assert.equal(api.body.external_generation_triggered,false);assert.equal(api.body.paid_execution_triggered,false);
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"inspect_generation_challenger_manifest",arguments:{site_id:site.site_id,capability:"ai_questions",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,57);assert.equal(mcp.result.structuredContent.execution_authorized,false);
  assert(site.paid_test_budget_scenarios.rows.every((row)=>row.generation_request_count===366));
  console.log("generation challenger manifest API/MCP: OK (303 canonical baselines, five capabilities, cumulative $5 gate, zero execution)");
}finally{db.close()}
