import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const dashboard={sites:[],serp_field_lineage:JSON.parse(readFileSync("docs/prototypes/wp-ops-dashboard/serp-data-coverage-audit.json","utf8"))};
{
  const url=new URL("http://localhost/api/v1/serp-field-lineage?projection_state=projected&decision_state=decision_connected&limit=100"),response=routeResearchApi(url.pathname,url,dashboard);
  assert.equal(response.status,200);assert.equal(response.body.summary.field_count,179);assert.equal(response.body.summary.projected_field_count,179);assert.equal(response.body.summary.raw_only_field_count,0);assert.equal(response.body.summary.consumer_verified_field_count,98);assert.equal(response.body.summary.consumer_missing_field_count,0);assert.equal(response.body.meta.total,98);assert.ok(response.body.data.every((row)=>row.projection_state==="projected"&&row.decision_state==="decision_connected"&&row.consumer?.verification_state==="verified_source_reference"));assert.equal(response.body.provenance.external_acquisition_triggered,false);
  const nestedUrl=new URL("http://localhost/api/v1/serp-field-lineage?q=organic.links&limit=100"),nested=routeResearchApi(nestedUrl.pathname,nestedUrl,dashboard);assert.equal(nested.body.meta.total,5);assert.ok(nested.body.data.some((row)=>row.field==="organic.links[].description"&&row.projection_ancestor==="organic.links"&&row.storage_kind==="ancestor_json"&&row.consumer?.file==="scripts/keyword-dashboard-api.mjs"));
  const timestampUrl=new URL("http://localhost/api/v1/serp-field-lineage?q=organic.timestamp&decision_state=decision_connected"),timestamp=routeResearchApi(timestampUrl.pathname,timestampUrl,dashboard);assert.equal(timestamp.body.meta.total,1);assert.equal(timestamp.body.data[0].consumer.file,"scripts/serp-freshness-signals.mjs");
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"audit_serp_field_lineage",arguments:{decision_state:"decision_connected",limit:100}}},dashboard);assert.equal(mcp.result.structuredContent.meta.total,98);assert.ok(mcp.result.structuredContent.data.every((row)=>row.consumer?.verification_state==="verified_source_reference"));
  console.log("SERP field lineage API/MCP: OK (179 primitive paths, 98 source-verified consumers, raw-only zero)");
}
