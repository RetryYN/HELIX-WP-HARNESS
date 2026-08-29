import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const dashboard=projectDashboard(db),site=dashboard.sites[0],analysis=site.serp_brand_analysis,summary=analysis.summary;
  assert.equal(summary.brand_count,analysis.brands.length);assert.equal(summary.domain_count,analysis.domains.length);assert.equal(summary.platform_publisher_count,analysis.brands.filter((row)=>row.identity_kind==="platform_publisher").length);assert.equal(summary.multi_domain_brand_count,analysis.brands.filter((row)=>row.multi_domain_review).length);assert.equal(summary.external_acquisition_triggered,false);assert(analysis.brands.every((row)=>row.evidence_digest.length===64&&row.task_count>0&&row.domain_count>0));
  const brands=routeResearchApi("/api/v1/brands",new URL(`http://localhost/api/v1/brands?site_id=${site.site_id}&review=true&limit=100`),dashboard,db);assert.equal(brands.status,200);assert.equal(brands.body.meta.total,summary.multi_domain_brand_count);assert(brands.body.data.every((row)=>row.multi_domain_review));assert.equal(brands.body.provenance.external_acquisition_triggered,false);
  const domains=routeResearchApi("/api/v1/brands",new URL(`http://localhost/api/v1/brands?site_id=${site.site_id}&view=domains&q=youtube&limit=10`),dashboard,db);assert.equal(domains.status,200);assert.equal(domains.body.view,"domains");assert(domains.body.data.some((row)=>row.domain==="www.youtube.com"));console.log(`SERP brand analysis API OK: ${summary.brand_count} brands, ${summary.domain_count} domains, ${summary.platform_publisher_count} platform publishers, ${summary.multi_domain_brand_count} multi-domain reviews`);
} finally { db.close(); }
