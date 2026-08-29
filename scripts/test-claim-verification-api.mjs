import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],queue=site.claim_verification_queue,expected=queue.summary;
  const url=new URL(`/api/v1/claim-verification-queue?site_id=${site.site_id}&limit=100`,"http://localhost");
  const api=routeResearchApi(url.pathname,url,data,db),summary=api.body.summary,{filtered_count,...retainedSummary}=summary;
  assert.equal(api.status,200);
  assert.equal(api.body.meta.total,queue.rows.length);
  assert.deepEqual(retainedSummary,expected);
  assert.equal(filtered_count,queue.rows.length);
  assert.equal(Object.values(summary.priority_counts).reduce((sum,count)=>sum+count,0),summary.claim_count);
  assert.equal(Object.values(summary.source_requirement_counts).reduce((sum,count)=>sum+count,0),summary.claim_count);
  assert.equal(summary.claim_count,summary.claim_with_citation_candidate_count+summary.claim_without_citation_candidate_count);
  assert.equal(summary.verified_count,0);
  assert.equal(summary.external_discovery_executed_count,0);
  assert(api.body.data.every((row)=>!row.external_discovery_executed&&!row.claim_verified&&!row.auto_approval&&!row.auto_publication));
  const expectedP0=summary.priority_counts.P0??0;
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"review_claim_verification",arguments:{site_id:site.site_id,priority:"P0",limit:100}}},data);
  assert.equal(mcp.result.structuredContent.meta.total,expectedP0);
  console.log(`claim verification API/MCP: OK (${summary.claim_count} claims, ${expectedP0} P0, ${summary.retained_evidence_count} retained references, zero inferred verification)`);
} finally { db.close(); }
