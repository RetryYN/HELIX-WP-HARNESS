import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const dashboard=projectDashboard(db),site=dashboard.sites[0],analysis=site.serp_intent_analysis;
  assert.equal(analysis.summary.fingerprint_count,100);
  assert.equal(analysis.summary.evaluated_pair_count,4950);
  assert.equal(analysis.summary.retained_pair_count,356);
  assert.equal(analysis.summary.merge_review_count,21);
  assert.equal(analysis.summary.split_review_count,0);
  assert.equal(analysis.summary.auto_mutation,false);
  assert.ok(analysis.fingerprints.every((row)=>row.fingerprint_digest.length===64));
  assert.ok(analysis.pairs.every((row)=>row.pair_digest.length===64&&!row.auto_mutation));
  const url=new URL(`http://localhost/api/v1/intent-fingerprints?site_id=${encodeURIComponent(site.site_id)}&review=required&limit=100`),response=routeResearchApi(url.pathname,url,dashboard,db);
  assert.equal(response.status,200);
  assert.equal(response.body.meta.total,21);
  assert.equal(response.body.data.length,21);
  assert.equal(response.body.summary.filtered_review_count,21);
  assert.equal(response.body.fingerprints.length,100);
  assert.equal(response.body.auto_mutation,false);
  assert.equal(response.body.provenance.external_acquisition_triggered,false);
  assert.ok(response.body.data.every((row)=>row.decision==="merge_review"&&row.review_required));
  console.log("SERP intent fingerprint API: OK (100 fingerprints, 4,950 comparisons, 21 review-only merge candidates)");
}finally{db.close()}
