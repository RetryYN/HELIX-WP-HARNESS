import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const data=projectDashboard(db),site=data.sites[0],queue=site.seo_action_queue,url=new URL(`/api/v1/action-queue?site_id=${site.site_id}&limit=100`,"http://localhost"),api=routeResearchApi(url.pathname,url,data,db),s=api.body.summary;
  assert.equal(api.body.meta.total,queue.summary.action_count);assert.deepEqual(s.priority_counts,queue.summary.priority_counts);assert.deepEqual(s.type_counts,queue.summary.type_counts);
  assert.equal(s.type_counts.primary_source_verification,63);assert.equal(s.type_counts.content_gap_review,13);assert.equal(s.type_counts.internal_link_review,17);assert.equal(s.type_counts.rank_monitor_registration_review,1);
  const formatRows=queue.rows.filter((row)=>row.action_type==="serp_format_review");assert(formatRows.length>0);assert(formatRows.every((row)=>row.context.priority_uses_observed_placement&&!row.context.click_or_demand_inferred));assert(formatRows.filter((row)=>row.context.top3_feature_count>0).every((row)=>row.priority_band==="P1"&&row.priority_reason==="observed_top3_serp_format_not_yet_approved"));assert(formatRows.filter((row)=>row.context.top3_feature_count===0).every((row)=>row.priority_band==="P2"));
  assert(api.body.data.every((row)=>row.review_state==="review_required"&&row.execution_state==="not_executed"&&!row.auto_execution&&!row.rank_lift_inferred));assert.equal(api.body.auto_execution,false);assert.equal(api.body.rank_lift_inferred,false);
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"review_seo_actions",arguments:{site_id:site.site_id,priority:"P0",limit:100}}},data);assert.equal(mcp.result.structuredContent.meta.total,queue.summary.priority_counts.P0);
  console.log(`SEO action queue API/MCP: OK (${queue.summary.action_count} reviews, top3 placement priority, zero execution)`);
}finally{db.close()}
