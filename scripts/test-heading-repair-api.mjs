import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],oracle=site.heading_repair_oracle,expected=oracle.summary;
  const url=new URL(`/api/v1/heading-repairs?site_id=${site.site_id}&limit=100`,"http://localhost");
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_count,...retainedSummary}=summary;
  assert.equal(api.status,200);
  assert.equal(api.body.meta.total,oracle.rows.length);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(filtered_count,oracle.rows.length);
  assert.equal(summary.source_review_count,summary.ready_for_editor_review_count+summary.needs_review_count);
  assert.equal(summary.semantic_preservation_verified_count,0);
  assert(api.body.data.every((row)=>row.semantic_preservation_unverified&&!row.auto_approval&&!row.ranking_effect_inferred&&!row.copying_competitor_heading));
  assert.equal(api.body.semantic_preservation_verified,false);
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"review_heading_repairs",arguments:{site_id:site.site_id,state:"ready_for_editor_review",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,summary.ready_for_editor_review_count);
  console.log(`heading repair API/MCP: OK (${oracle.rows.length} repairs, ${summary.ready_for_editor_review_count} morphology-ready, semantic review required, no copy/approval/rank inference)`);
} finally { db.close(); }
