import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const data=projectDashboard(db),site=data.sites[0];assert.equal(data.wp_paragraph_summaries.length,59);assert.equal(data.wp_paragraph_summaries.reduce((sum,row)=>sum+row.paragraph_count,0),8050);assert.equal(data.wp_paragraph_summaries.reduce((sum,row)=>sum+row.li_count,0),1798);
  const all=routeResearchApi("/api/v1/wordpress/paragraphs",new URL(`http://localhost/api/v1/wordpress/paragraphs?site_id=${site.site_id}`),data,db);assert.equal(all.status,200);assert.equal(all.body.meta.total,8050);assert.equal(all.body.meta.limit,25);assert.equal(all.body.data.length,25);assert.equal(all.body.summary.article_count,59);assert.equal(all.body.summary.total_text_length,395969);assert.equal(all.body.summary.text_retained,false);assert(all.body.data.every((row)=>row.text_digest.length===64&&!("text" in row)));
  const lists=routeResearchApi("/api/v1/wordpress/paragraphs",new URL(`http://localhost/api/v1/wordpress/paragraphs?site_id=${site.site_id}&element=li&limit=100`),data,db);assert.equal(lists.body.meta.total,1798);assert(lists.body.data.every((row)=>row.element==="li"));
  const foreign=routeResearchApi("/api/v1/wordpress/paragraphs",new URL("http://localhost/api/v1/wordpress/paragraphs?site_id=missing"),data,db);assert.equal(foreign.status,404);
  console.log("WP paragraph structure API OK: 8,050 digest-only rows, 59 articles, no paragraph text retained");
}finally{db.close()}
