import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],oracle=site.simultaneous_rank_integrity,expected=oracle.summary;
  const url=new URL(`/api/v1/simultaneous-rank-integrity?site_id=${site.site_id}&limit=100`,"http://localhost");
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_relation_count,...retainedSummary}=summary;
  assert.equal(api.body.meta.total,oracle.rows.length);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(filtered_relation_count,oracle.rows.length);
  assert.equal(summary.relation_count,summary.same_group_count+summary.cross_group_count);
  assert.equal(summary.relation_count,summary.boundary_connected_count+summary.intent_only_count+summary.url_only_count);
  assert.equal(summary.review_required_count,0);
  assert.equal(api.body.merge_inferred_from_shared_urls,false);
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"audit_simultaneous_rankings",arguments:{site_id:site.site_id,scope:"cross_group",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,summary.cross_group_count);
  console.log(`simultaneous rank API/MCP: OK (${summary.relation_count} relations, URL/rank reconstruction, zero integrity gaps)`);
} finally { db.close(); }
