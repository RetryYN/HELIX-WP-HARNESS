import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const dashboard=projectDashboard(db),site=dashboard.sites[0],rows=dashboard.aio_element_source_lineage.filter((row)=>row.site_id===site.site_id),references=rows.reduce((sum,row)=>sum+row.reference_count,0),reviewRequired=rows.filter((row)=>row.review_required).length,mismatches=rows.reduce((sum,row)=>sum+row.global_reference_mismatch_count,0);
  assert(rows.every((row)=>["referenced","unreferenced","link_only"].includes(row.source_state)&&row.evidence_digest.length===64&&!row.auto_mutation));const url=new URL(`http://localhost/api/v1/aio-element-lineage?site_id=${site.site_id}&limit=100`),api=routeResearchApi(url.pathname,url,dashboard,db);assert.equal(api.status,200);assert.equal(api.body.summary.element_count,rows.length);assert.equal(api.body.summary.review_required_count,reviewRequired);assert.equal(api.body.summary.element_only_reference_count,mismatches);const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"audit_aio_element_sources",arguments:{site_id:site.site_id,review:"required",limit:100}}},dashboard);assert.equal(mcp.result.structuredContent.meta.total,reviewRequired);assert.equal(mcp.result.structuredContent.summary.element_only_reference_count,mismatches);console.log(`AIO element lineage API/MCP: OK (${rows.length} elements, ${references} references, ${mismatches} element-only omissions)`);
} finally { db.close(); }
