import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{const dashboard=projectDashboard(db),site=dashboard.sites[0],analysis=site.serp_brand_analysis;assert.deepEqual(analysis.summary,{brand_count:260,domain_count:226,platform_publisher_count:38,multi_domain_brand_count:2,domain_name_variation_count:0,own_domain_observation_count:1,external_acquisition_triggered:false});assert(analysis.brands.every((row)=>row.evidence_digest.length===64&&row.task_count>0&&row.domain_count>0));assert.equal(analysis.brands.find((row)=>row.website_name==="ワンキャリア").domain_count,2);assert.equal(analysis.domains.find((row)=>row.domain==="note.com").identity_kind,"publisher_platform");
  const brands=routeResearchApi("/api/v1/brands",new URL(`http://localhost/api/v1/brands?site_id=${site.site_id}&review=true&limit=100`),dashboard,db);assert.equal(brands.status,200);assert.equal(brands.body.meta.total,2);assert(brands.body.data.every((row)=>row.multi_domain_review));assert.equal(brands.body.provenance.external_acquisition_triggered,false);
  const domains=routeResearchApi("/api/v1/brands",new URL(`http://localhost/api/v1/brands?site_id=${site.site_id}&view=domains&q=youtube&limit=10`),dashboard,db);assert.equal(domains.status,200);assert.equal(domains.body.view,"domains");assert(domains.body.data.some((row)=>row.domain==="www.youtube.com"));console.log("SERP brand analysis API OK: 260 brands, 226 domains, 38 platform publishers, 2 multi-domain reviews")
}finally{db.close()}
