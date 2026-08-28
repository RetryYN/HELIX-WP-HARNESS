import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const dashboard=projectDashboard(db),site=dashboard.sites[0],audit=site.keyword_decision_audit;
  assert.deepEqual(audit.summary,{decision_count:398,review_count:119,supported_count:279,serp_pair_count:339,gsc_query_count:54,article_assignment_count:5,decision_counts:{existing_article_assignment_review:5,gsc_cannibalization_review:54,merge_recheck:30,merge_review:1,separate_with_internal_link:29,merge_supported:55,separate_supported:224},external_acquisition_triggered:false});
  assert(audit.rows.every((row)=>row.evidence_digest.length===64&&row.decision_id.length===24));
  const response=routeResearchApi("/api/v1/keyword-decisions",new URL(`http://localhost/api/v1/keyword-decisions?site_id=${encodeURIComponent(site.site_id)}&review=required&limit=100`),dashboard,db);
  assert.equal(response.status,200);assert.equal(response.body.meta.total,119);assert.equal(response.body.summary.review_count,119);assert.equal(response.body.auto_mutation,false);assert(response.body.data.every((row)=>row.review_required));assert.equal(response.body.provenance.external_acquisition_triggered,false);
  console.log("keyword decision audit API OK: 398 decisions, 119 reviews, no automatic mutation");
}finally{db.close()}
