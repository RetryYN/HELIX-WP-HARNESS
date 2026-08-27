import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const dashboard={...projectDashboard(db),serp_field_lineage:JSON.parse(readFileSync("docs/prototypes/wp-ops-dashboard/serp-data-coverage-audit.json","utf8"))};
  const url=new URL("http://localhost/api/v1/serp-field-lineage?projection_state=projected&decision_state=decision_connected&limit=100"),response=routeResearchApi(url.pathname,url,dashboard,db);
  assert.equal(response.status,200);assert.equal(response.body.summary.field_count,179);assert.equal(response.body.summary.projected_field_count,179);assert.equal(response.body.summary.raw_only_field_count,0);assert.equal(response.body.meta.total,52);assert.ok(response.body.data.every((row)=>row.projection_state==="projected"&&row.decision_state==="decision_connected"));assert.equal(response.body.provenance.external_acquisition_triggered,false);
  const nestedUrl=new URL("http://localhost/api/v1/serp-field-lineage?q=organic.links&limit=100"),nested=routeResearchApi(nestedUrl.pathname,nestedUrl,dashboard,db);assert.equal(nested.body.meta.total,5);assert.ok(nested.body.data.some((row)=>row.field==="organic.links[].description"&&row.projection_ancestor==="organic.links"&&row.storage_kind==="ancestor_json"));
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"audit_serp_field_lineage",arguments:{projection_state:"raw_only",limit:100}}},dashboard);assert.equal(mcp.result.structuredContent.meta.total,0);assert.equal(mcp.result.structuredContent.summary.raw_only_field_count,0);
  console.log("SERP field lineage API/MCP: OK (179 primitive paths, projection/use filters, raw-only zero)");
}finally{db.close()}
