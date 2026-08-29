import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const dashboard=projectDashboard(db),site=dashboard.sites[0],rows=dashboard.paa_answer_evidence.filter((row)=>row.site_id===site.site_id),resolved=rows.filter((row)=>row.response_state==="resolved").length,pending=rows.filter((row)=>row.response_state==="async_pending").length,answers=rows.flatMap((row)=>row.answers);
  assert.equal(rows.length,resolved+pending+rows.filter((row)=>!["resolved","async_pending"].includes(row.response_state)).length);assert(rows.every((row)=>row.evidence_digest.length===64&&!row.auto_mutation));const url=new URL(`http://localhost/api/v1/paa-answers?site_id=${site.site_id}&limit=100`),api=routeResearchApi(url.pathname,url,dashboard,db);assert.equal(api.status,200);assert.equal(api.body.summary.question_occurrence_count,rows.length);assert.equal(api.body.summary.resolved_question_count,resolved);assert.equal(api.body.summary.async_pending_count,pending);assert.equal(api.body.retry_mutation_supported,false);const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"search_paa_answers",arguments:{site_id:site.site_id,state:"resolved",limit:100}}},dashboard);assert.equal(mcp.result.structuredContent.meta.total,resolved);assert.equal(mcp.result.structuredContent.summary.async_pending_count,0);console.log(`PAA answer API/MCP: OK (${rows.length} questions, ${resolved} resolved sources, ${pending} async pending, ${answers.filter((answer)=>answer.table).length} tables)`);
} finally { db.close(); }
