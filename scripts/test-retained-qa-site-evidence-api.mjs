import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";
import {handleMcpMessage} from "./keyword-dashboard-mcp.mjs";
const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const data=projectDashboard(db),site=data.sites[0],oracle=site.qa_site_evidence,request=(suffix="")=>{const url=new URL(`/api/v1/qa-site-evidence?site_id=${site.site_id}&limit=100${suffix}`,"http://localhost");return routeResearchApi(url.pathname,url,data,db)};
  const all=request();assert.equal(all.status,200);assert.equal(all.body.meta.total,oracle.summary.observation_count);assert.equal(all.body.full_qa_index,false);assert.equal(all.body.answer_text_retained,false);assert(all.body.data.every((row)=>row.evidence_digest.length===64&&!row.external_acquisition_triggered));
  const pages=request("&view=pages");assert.equal(pages.body.view,"pages");assert.equal(pages.body.meta.total,oracle.summary.unique_page_count);assert(pages.body.data.every((row)=>row.page_evidence_digest.length===64&&row.keyword_count>=1));
  const quora=request("&source=quora");assert.equal(quora.body.meta.total,oracle.summary.source_counts.quora??0);
  const history=request("&view=history");assert.equal(history.body.view,"history");assert.equal(history.body.meta.total,site.qa_appearance_history.summary.appearance_count);assert.equal(history.body.absence_confirms_unranked,false);assert(history.body.data.every((row)=>row.evidence_digest.length===64&&!row.confirmed_unranked&&!row.external_acquisition_triggered));
  const copy=request("&view=copy");assert.equal(copy.body.meta.total,1);assert.match(copy.body.data[0].text,/\[appearance_history\]/);assert.equal(copy.body.data[0].export_digest.length,64);assert.equal(copy.body.data[0].external_acquisition_triggered,false);
  const mcp=handleMcpMessage({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"search_qa_site_evidence",arguments:{site_id:site.site_id,view:"history",source:"yahoo_chiebukuro",limit:100}}},data);assert.equal(mcp.result.structuredContent.meta.total,site.qa_appearance_history.rows.filter((row)=>row.qa_source==="yahoo_chiebukuro").length);
  const mcpCopy=handleMcpMessage({jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"search_qa_site_evidence",arguments:{site_id:site.site_id,view:"copy",limit:1}}},data);assert.equal(mcpCopy.result.structuredContent.data[0].export_digest.length,64);
  console.log(`retained Q&A site API/MCP: OK (${oracle.summary.observation_count} observations / ${oracle.summary.unique_page_count} pages / ${site.qa_appearance_history.summary.appearance_count} history rows / copy export / no acquisition)`);
}finally{db.close()}
