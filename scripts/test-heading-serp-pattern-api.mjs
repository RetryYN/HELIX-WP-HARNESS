import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(process.env.WP_DASHBOARD_DB??".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],url=new URL(`/api/v1/heading-patterns?site_id=${encodeURIComponent(site.site_id)}&limit=100`,"http://localhost"),api=routeResearchApi(url.pathname,url,data,db);
  const expected=site.heading_serp_pattern_oracle.summary,{filtered_candidate_count,filtered_supported_count,filtered_review_count,...retainedSummary}=api.body.summary;
  assert.equal(api.status,200);assert.equal(api.body.meta.total,site.heading_serp_pattern_oracle.rows.length);assert.equal(filtered_candidate_count,site.heading_serp_pattern_oracle.rows.length);assert.deepEqual(retainedSummary,expected);assert.equal(api.body.summary.candidate_count,api.body.summary.supported_count+api.body.summary.needs_review_count);assert.equal(api.body.summary.missing_level_evidence_count,0);assert.equal(api.body.ranking_effect_inferred,false);assert.equal(api.body.interpretation_policy,"observed_serp_heading_patterns_no_ranking_causality");assert(api.body.data.every((row)=>row.evidence_digest.length===64&&!row.auto_approval));
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"review_heading_patterns",arguments:{site_id:site.site_id,state:"observed_pattern_supported",level:2,limit:100}}},data);assert(mcp.result.structuredContent.meta.total>0);assert(mcp.result.structuredContent.data.every((row)=>row.review_state==="observed_pattern_supported"&&row.heading_level===2));
  console.log(`heading pattern API/MCP: OK (${api.body.summary.candidate_count} candidates, ${api.body.summary.supported_count} supported, ${api.body.summary.needs_review_count} review, no ranking causality)`);
} finally {db.close()}
