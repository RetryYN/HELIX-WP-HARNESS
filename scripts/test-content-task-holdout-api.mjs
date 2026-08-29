import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";
const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const data=projectDashboard(db),site=data.sites[0],oracle=site.content_task_holdout_oracle;
  const request=(suffix="")=>{const url=new URL(`/api/v1/content-task-holdout?site_id=${site.site_id}&limit=100${suffix}`,"http://localhost");return routeResearchApi(url.pathname,url,data,db)};
  const api=request("&state=independent_signal_improvement");assert.equal(api.status,200);assert.equal(api.body.meta.total,oracle.summary.improvement_count);assert.equal(api.body.summary.evaluable_count,74);assert.equal(api.body.summary.task_leakage_count,0);assert.equal(api.body.summary.temporal_evaluable_count,731);assert.equal(api.body.summary.temporal_leakage_count,0);assert.equal(api.body.temporal_independence_proven,true);assert.equal(api.body.human_quality_proven,false);assert.equal(api.body.ranking_effect_inferred,false);assert(api.body.data.every((row)=>row.task_independence_proven&&!row.source_holdout_overlap_task_ids.length&&!row.auto_selection));
  const temporal=request("&temporal_state=temporal_signal_regression");assert.equal(temporal.body.meta.total,oracle.summary.temporal_regression_count);assert(temporal.body.data.every((row)=>row.temporal_independence_proven&&!row.temporal_source_overlap_task_ids.length));
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"review_content_task_holdout",arguments:{site_id:site.site_id,temporal_state:"temporal_signal_improvement",limit:100}}},data);assert.equal(mcp.result.structuredContent.meta.total,oracle.summary.temporal_improvement_count);
  console.log(`content holdout API/MCP: OK (${oracle.summary.evaluable_count} task, ${oracle.summary.temporal_evaluable_count} temporal, 0 leakage)`);
}finally{db.close()}
