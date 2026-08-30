import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi,researchOpenApi} from "./keyword-dashboard-api.mjs";
const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const data=projectDashboard(db),site=data.sites.find((row)=>row.new_article_public_source_evidence?.rows.length);
  assert(site);
  const request=(suffix="")=>{const url=new URL(`/api/v1/new-article-public-source-evidence?site_id=${site.site_id}&limit=100${suffix}`,"http://localhost");return routeResearchApi(url.pathname,url,data,db)};
  const all=request();
  assert.equal(researchOpenApi.info.version,"2.106.0");
  assert.equal(all.status,200);assert.equal(all.body.meta.total,37);assert.equal(all.body.summary.acquisition_cost_usd,0);assert.equal(all.body.summary.requirement_satisfied_count,12);assert.equal(all.body.summary.adapted_query_count,25);assert.equal(all.body.paid_acquisition_triggered,false);assert(all.body.data.every((row)=>row.evidence_digest.length===64&&!row.auto_approval&&!row.auto_publication));
  const contextual=request("&support_state=contextual_only");assert.equal(contextual.body.meta.total,17);assert(contextual.body.data.every((row)=>!row.requirement_satisfied));
  const unsupported=request("&support_state=not_supported");assert.equal(unsupported.body.meta.total,8);assert(unsupported.body.data.every((row)=>row.result_state==="no_qualifying_result"));
  console.log("new article public source evidence API: OK (37 priority checks, 12 direct, $0)");
}finally{db.close()}
