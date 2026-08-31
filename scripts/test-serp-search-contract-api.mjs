import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const dashboard=projectDashboard(db),site=dashboard.sites[0],rows=dashboard.serp_search_contracts.filter((row)=>row.site_id===site.site_id),cohorts=new Set(rows.map((row)=>row.contract_fingerprint)).size,verified=rows.filter((row)=>row.contract_state==="verified").length,mismatches=rows.reduce((sum,row)=>sum+row.mismatch_count,0);
  assert(rows.every((row)=>row.evidence_digest.length===64&&!row.auto_mutation));
  assert(rows.every((row)=>row.comparison_eligible===(row.mismatch_count===0)));
  assert(rows.every((row)=>(row.contract_state==="verified")===row.comparison_eligible));
  const url=new URL(`http://localhost/api/v1/search-contracts?site_id=${site.site_id}&limit=100`),api=routeResearchApi(url.pathname,url,dashboard,db);assert.equal(api.status,200);assert.equal(api.body.summary.task_count,rows.length);assert.equal(api.body.summary.contract_cohort_count,cohorts);assert.equal(api.body.summary.mismatch_count,mismatches);assert.equal(api.body.comparison_rule,"exact_contract_fingerprint_required");const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"audit_serp_search_contracts",arguments:{site_id:site.site_id,state:"verified",limit:100}}},dashboard);assert.equal(mcp.result.structuredContent.meta.total,verified);assert.equal(mcp.result.structuredContent.summary.comparison_eligible_count,verified);console.log(`SERP search contract API/MCP: OK (${verified} verified tasks, ${cohorts} exact contract cohorts, ${mismatches} echo mismatches)`);
} finally { db.close(); }
