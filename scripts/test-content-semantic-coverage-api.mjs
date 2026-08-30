import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi,setResearchDb} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const data=projectDashboard(db),site=data.sites[0],group=data.groups.find((row)=>row.site_id===site.site_id&&row.main_keyword.includes("企業"));assert(group);
  const url=new URL(`/api/v1/content-semantic-coverage?site_id=${site.site_id}&group_id=${group.id}&depth=1&limit=100`,"http://localhost"),response=routeResearchApi(url.pathname,url,data,db);assert.equal(response.status,200);assert(response.body.meta.total>0);assert(response.body.summary.review_concept_count>0);assert.equal(response.body.sense_disambiguation_required,true);assert.equal(response.body.semantic_requirement_inferred,false);assert.equal(response.body.search_demand_inferred,false);assert.equal(response.body.synonymy_inferred,false);assert.equal(response.body.ranking_effect_inferred,false);assert.equal(response.body.auto_selection,false);assert.equal(response.body.auto_mutation,false);assert(response.body.data.every((row)=>row.coverage_digest.length===64&&!row.auto_selection&&!row.auto_content_mutation));
  setResearchDb(db);const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"review_content_semantic_coverage",arguments:{site_id:site.site_id,group_id:group.id,depth:1,limit:10}}},data).result;assert.equal(mcp.isError,false);assert(mcp.structuredContent.data.length>0);assert.equal(mcp.structuredContent.semantic_requirement_inferred,false);console.log(`content semantic coverage API/MCP: OK (${response.body.summary.review_concept_count} review concepts, ${response.body.meta.total} candidates, no mutation)`);
}finally{setResearchDb(null);db.close()}
