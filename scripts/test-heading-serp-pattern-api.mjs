import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(process.env.WP_DASHBOARD_DB??".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],url=new URL(`/api/v1/heading-patterns?site_id=${encodeURIComponent(site.site_id)}&limit=100`,"http://localhost"),api=routeResearchApi(url.pathname,url,data,db);
  assert.equal(api.status,200);assert.equal(api.body.meta.total,580);assert.equal(api.body.summary.filtered_candidate_count,580);assert.equal(api.body.summary.candidate_count,580);assert.equal(api.body.summary.supported_count,400);assert.equal(api.body.summary.needs_review_count,180);assert.equal(api.body.summary.outside_length_count,175);assert.equal(api.body.summary.unobserved_pattern_count,8);assert.equal(api.body.summary.missing_level_evidence_count,0);assert.equal(api.body.ranking_effect_inferred,false);assert.equal(api.body.interpretation_policy,"observed_serp_heading_patterns_no_ranking_causality");assert(api.body.data.every((row)=>row.evidence_digest.length===64&&!row.auto_approval));
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"review_heading_patterns",arguments:{site_id:site.site_id,state:"observed_pattern_supported",level:2,limit:100}}},data);assert(mcp.result.structuredContent.meta.total>0);assert(mcp.result.structuredContent.data.every((row)=>row.review_state==="observed_pattern_supported"&&row.heading_level===2));
  console.log("heading pattern API/MCP: OK (580 candidates, 400 supported, 180 review, no ranking causality)");
} finally {db.close()}
