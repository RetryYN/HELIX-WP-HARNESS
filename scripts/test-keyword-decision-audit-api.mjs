import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const dashboard=projectDashboard(db),site=dashboard.sites[0],audit=site.keyword_decision_audit,summary=audit.summary;
  assert.equal(summary.decision_count,audit.rows.length);assert.equal(summary.review_count,audit.rows.filter((row)=>row.review_required).length);assert.equal(summary.supported_count,audit.rows.filter((row)=>!row.review_required).length);assert.equal(summary.decision_count,Object.values(summary.decision_counts).reduce((sum,count)=>sum+count,0));assert.equal(summary.external_acquisition_triggered,false);assert(audit.rows.every((row)=>row.evidence_digest.length===64&&row.decision_id.length===24));
  const response=routeResearchApi("/api/v1/keyword-decisions",new URL(`http://localhost/api/v1/keyword-decisions?site_id=${encodeURIComponent(site.site_id)}&review=required&limit=100`),dashboard,db);
  assert.equal(response.status,200);assert.equal(response.body.meta.total,summary.review_count);assert.equal(response.body.summary.decision_count,summary.review_count);assert.equal(response.body.summary.review_count,summary.review_count);assert.equal(response.body.summary.supported_count,0);assert.equal(response.body.auto_mutation,false);assert(response.body.data.every((row)=>row.review_required));assert.equal(response.body.provenance.external_acquisition_triggered,false);
  console.log(`keyword decision audit API OK: ${summary.decision_count} decisions, ${summary.review_count} reviews, no automatic mutation`);
} finally { db.close(); }
