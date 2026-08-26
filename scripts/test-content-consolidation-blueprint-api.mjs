import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const dashboard=projectDashboard(db),site=dashboard.sites[0],analysis=site.content_consolidation_blueprints;
  assert.deepEqual(analysis.summary,{blueprint_count:1,source_heading_count:10,duplicate_heading_pair_count:3,unique_heading_count:4,projected_merged_heading_count:7,title_option_count:2,auto_mutation:false,external_acquisition_triggered:false});
  const url=new URL(`http://localhost/api/v1/consolidation-blueprints?site_id=${encodeURIComponent(site.site_id)}&limit=100`),response=routeResearchApi(url.pathname,url,dashboard,db);
  assert.equal(response.status,200);assert.equal(response.body.meta.total,1);
  const row=response.body.data[0];assert.equal(row.title_selection_state,"unresolved_not_auto_selected");assert.equal(row.blueprint_state,"review_required");assert.equal(row.title_options.length,2);assert.equal(row.source_heading_count,10);assert.equal(row.duplicate_heading_pair_count,3);assert.equal(row.unique_heading_count,4);assert.equal(row.projected_merged_heading_count,7);assert.ok(row.duplicate_heading_pairs.every((item)=>item.resolution_state==="unresolved_representative_not_auto_selected"));assert.equal(row.auto_mutation,false);assert.equal(row.blueprint_digest.length,64);assert.equal(response.body.auto_mutation,false);
  console.log(`content consolidation blueprint API: OK (2 title options, 3 duplicate pairs, 4 unique headings, ${row.shared_evidence_count}/${row.evidence_union_count} shared/union evidence)`);
}finally{db.close()}
