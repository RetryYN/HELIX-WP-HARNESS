import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const dashboard=projectDashboard(db),site=dashboard.sites[0],analysis=site.serp_depth_stability,summary=analysis.summary,count=(state)=>analysis.rows.filter((row)=>row.stability_state===state).length;
  assert.equal(summary.pair_count,analysis.rows.length);assert.equal(summary.threshold_flip_count,count("threshold_flip"));assert.equal(summary.stable_merge_count,count("stable_merge"));assert.equal(summary.stable_related_count,count("stable_related"));assert.equal(summary.stable_separate_count,count("stable_separate"));assert.equal(summary.robust_merge_count,analysis.rows.filter((row)=>row.robust_merge).length);assert.deepEqual(summary.depths,[3,5,10]);assert.equal(summary.auto_mutation,false);assert.equal(summary.external_acquisition_triggered,false);assert.ok(analysis.rows.every((row)=>row.evaluations.length===summary.depths.length&&row.stability_digest.length===64&&!row.auto_mutation));
  const url=new URL(`http://localhost/api/v1/depth-stability?site_id=${encodeURIComponent(site.site_id)}&robust=true&limit=100`),response=routeResearchApi(url.pathname,url,dashboard,db);assert.equal(response.status,200);assert.equal(response.body.meta.total,summary.robust_merge_count);assert(response.body.data.every((row)=>row.stability_state==="stable_merge"&&row.robust_merge));assert.equal(response.body.auto_mutation,false);console.log(`SERP depth stability API: OK (${summary.threshold_flip_count}/${summary.pair_count} threshold flips, ${summary.robust_merge_count} robust merge across top3/5/10)`);
} finally { db.close(); }
