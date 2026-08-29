import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi,setResearchDb} from "./keyword-dashboard-api.mjs";

const db=new DatabaseSync(".helix/keyword-dashboard.sqlite",{readOnly:true});
try {
  setResearchDb(db);
  const data=projectDashboard(db),siteId=data.sites[0].site_id,response=routeResearchApi("/api/v1/compositions",new URL(`http://localhost/api/v1/compositions?site_id=${siteId}&limit=100`),data,db),expectedHeadingCount=response.body.data.reduce((sum,row)=>sum+row.selected_heading_ids.length,0);
  assert.equal(response.status,200);assert.equal(response.body.meta.total,response.body.data.length);assert.equal(response.body.summary.composition_count,response.body.data.length);assert.equal(response.body.summary.selected_heading_count,expectedHeadingCount);assert.equal(response.body.summary.auto_approval,false);assert.equal(response.body.summary.policy,"content-plan-coherence.v2");assert.ok(response.body.data.every((row)=>row.policy==="content-plan-coherence.v2"&&row.status==="proposed"&&!row.auto_approval&&row.composition_digest.length===64));assert.ok(response.body.data.every((row)=>row.title_candidate_id&&row.baseline_title_candidate_id&&row.selected_heading_ids.length>=3&&row.metrics.title_quality_delta>=-5&&row.metrics.title_outline_lexical_coverage_delta>=0));assert.equal(response.body.provenance.external_acquisition_triggered,false);
  console.log(`content plan composition API: OK (${response.body.data.length} jointly optimized title×outline reviews, ${response.body.summary.selected_heading_count} selected headings, no auto-approval)`);
} finally { setResearchDb(null);db.close(); }
