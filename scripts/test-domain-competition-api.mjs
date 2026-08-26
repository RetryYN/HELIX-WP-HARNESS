import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(process.env.WP_DASHBOARD_DB??".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),site=data.sites[0],targetDomain=site.domain;
  const url=new URL(`/api/v1/domains?site_id=${encodeURIComponent(site.site_id)}&target_domain=${encodeURIComponent(targetDomain)}&q=${encodeURIComponent(targetDomain)}&limit=1`,"http://localhost"),response=routeResearchApi(url.pathname,url,data,db),row=response.body.data[0];
  const targetKeywords=new Set(data.serp_page_keyword_edges.filter((edge)=>edge.domain===targetDomain).map((edge)=>edge.keyword));
  assert.equal(response.status,200);assert.equal(response.body.meta.total,1);assert.equal(row.domain,targetDomain);
  assert.equal(row.comparison.observed_target_keyword_count,targetKeywords.size);assert.equal(row.comparison.duplicate_keyword_count,targetKeywords.size);assert.equal(row.comparison.duplicate_rate_target,1);assert.equal(row.comparison.jaccard_overlap_rate,1);assert.equal(row.comparison.competitor_unique_keyword_count,0);assert.equal(row.comparison.target_unique_keyword_count,0);assert.equal(row.comparison.scope.full_rank_database,false);assert.equal(row.comparison.policy,"observed-serp-domain-keyword-set.v1");
  console.log(`domain competition API: OK (${targetDomain}, ${targetKeywords.size} observed target KW, explicit target/Jaccard policies)`);
} finally { db.close() }
