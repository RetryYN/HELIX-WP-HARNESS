import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],oracle=site.content_readiness_oracle,expected=oracle.summary;
  const url=new URL(`/api/v1/content-readiness?site_id=${site.site_id}&limit=100`,"http://localhost");
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_count,...retainedSummary}=summary;
  assert.equal(api.status,200);
  assert.equal(api.body.meta.total,oracle.rows.length);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(filtered_count,oracle.rows.length);
  assert.equal(summary.group_count,summary.blocked_count+summary.editor_review_required_count+summary.ready_for_publication_review_count);
  assert.equal(summary.auto_approved_count,0);
  assert.equal(summary.auto_published_count,0);
  assert(api.body.data.every((row)=>!row.auto_approval&&!row.auto_publication&&!row.ranking_effect_inferred));
  const expectedClaimBlocked=oracle.rows.filter((row)=>row.blocker_codes.includes("claim_verification")).length;
  assert.equal(summary.claim_verification_blocked_count,expectedClaimBlocked);
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"review_content_readiness",arguments:{site_id:site.site_id,blocker:"claim_verification",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,expectedClaimBlocked);
  console.log(`content readiness API/MCP: OK (${summary.blocked_count} blocked, repair/topology/claim/citation gates, zero auto publication)`);
} finally { db.close(); }
