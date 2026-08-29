import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const dashboard=projectDashboard(db),site=dashboard.sites[0],rows=dashboard.serp_presentation_integrity.filter((row)=>row.site_id===site.site_id),organic=rows.reduce((sum,row)=>sum+row.organic_top10_count,0),videos=rows.reduce((sum,row)=>sum+row.is_video_count,0),verified=rows.filter((row)=>row.integrity_state==="verified").length;
  assert(rows.every((row)=>row.evidence_digest.length===64&&!row.auto_mutation&&!row.external_acquisition_triggered));const url=new URL(`http://localhost/api/v1/presentation-integrity?site_id=${site.site_id}&limit=100`),api=routeResearchApi(url.pathname,url,dashboard,db);assert.equal(api.status,200);assert.equal(api.body.summary.task_count,rows.length);assert.equal(api.body.summary.organic_result_count,organic);assert.equal(api.body.summary.video_observation_count,videos);assert.equal(api.body.summary.anomaly_count,rows.length-verified);assert.equal(api.body.interpretation_policy,"true_is_observed_format_false_is_not_proof_of_absence");const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"audit_serp_presentation",arguments:{site_id:site.site_id,state:"verified",limit:100}}},dashboard);assert.equal(mcp.result.structuredContent.meta.total,verified);assert.equal(mcp.result.structuredContent.summary.anomaly_count,0);console.log(`SERP presentation API/MCP: OK (${organic} top results, ${videos} observed video formats, zero contract anomalies)`);
} finally { db.close(); }
