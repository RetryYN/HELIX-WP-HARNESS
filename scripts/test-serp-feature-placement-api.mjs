import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const dashboard=projectDashboard(db),site=dashboard.sites[0],rows=dashboard.serp_feature_placements.filter((row)=>row.site_id===site.site_id),top3=rows.filter((row)=>row.prominence_state==="top3").length,review=rows.filter((row)=>row.placement_state!=="verified").length,xpaths=new Set(rows.map((row)=>row.xpath)).size;
  assert.equal(rows.length,top3+rows.filter((row)=>row.prominence_state==="observed_below_top3").length);assert(rows.every((row)=>row.evidence_digest.length===64&&!row.auto_mutation));const url=new URL(`http://localhost/api/v1/feature-placements?site_id=${site.site_id}&limit=100`),api=routeResearchApi(url.pathname,url,dashboard,db);assert.equal(api.status,200);assert.equal(api.body.summary.occurrence_count,rows.length);assert.equal(api.body.summary.top3_count,top3);assert.equal(api.body.summary.review_required_count,review);assert.equal(api.body.interpretation_policy,"observed_placement_only_no_click_or_demand_inference");const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"audit_serp_feature_placements",arguments:{site_id:site.site_id,prominence:"top3",limit:100}}},dashboard);assert.equal(mcp.result.structuredContent.meta.total,top3);assert.equal(mcp.result.structuredContent.summary.top3_count,top3);console.log(`SERP feature placement API/MCP: OK (${rows.length} occurrences, ${top3} top3, ${xpaths} XPath variants, ${review} anomalies)`);
} finally { db.close(); }
