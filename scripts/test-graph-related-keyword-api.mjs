import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi,researchOpenApi,setResearchDb} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const data=projectDashboard(db),site=data.sites[0],url=new URL(`/api/v1/graph-related-keywords?site_id=${site.site_id}&q=${encodeURIComponent("企業")}&depth=1&limit=100`,"http://localhost"),response=routeResearchApi(url.pathname,url,data,db);assert.equal(researchOpenApi.info.version,"2.102.0");assert.equal(response.status,200);assert.equal(response.body.meta.total,482);assert.equal(response.body.data.length,100);assert.equal(response.body.summary.semantic_path_candidate_count,365);assert.equal(response.body.external_market_coverage,false);assert.equal(response.body.sense_disambiguation_required,true);assert.equal(response.body.auto_group_assignment,false);assert.equal(response.body.auto_mutation,false);assert(response.body.data.every((row)=>!row.synonymy_inferred&&!row.search_demand_inferred&&!row.ranking_effect_inferred&&row.market_coverage_state==="retained_inventory_only"));
  setResearchDb(db);const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"search_graph_related_keywords",arguments:{site_id:site.site_id,query:"企業",depth:1,state:"semantic_path_review",limit:100}}},data).result;assert.equal(mcp.isError,false);assert(mcp.structuredContent.meta.total>0);assert(mcp.structuredContent.data.every((row)=>row.match_state==="semantic_path_review"));assert.equal(mcp.structuredContent.auto_group_assignment,false);
  console.log("graph related keyword API/MCP: OK (arbitrary query, evidence paths, review-only boundaries, zero market inference)");
}finally{setResearchDb(null);db.close()}
