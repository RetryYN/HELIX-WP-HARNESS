import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const dashboard=projectDashboard(db),site=dashboard.sites[0],audit=site.snapshot_reuse_audit;
  assert.deepEqual(audit.summary,{snapshot_count:104,current_analysis_count:100,historical_comparison_count:2,adjacent_candidate_count:2,out_of_scope_count:6,external_acquisition_triggered:false});
  assert.equal(db.prepare("SELECT COUNT(*) count FROM raw_snapshot_reuse_audit").get().count,110);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM serp_snapshot_organic_observations").get().count,1016);
  assert.deepEqual(db.prepare("SELECT reuse_state,COUNT(*) count FROM raw_snapshot_reuse_audit GROUP BY reuse_state ORDER BY reuse_state").all().map((row)=>({...row})),[
    {reuse_state:"adjacent_intent_candidate",count:2},{reuse_state:"current_analysis",count:100},{reuse_state:"historical_comparable",count:2},{reuse_state:"out_of_scope",count:6},
  ]);
  assert.equal(audit.comparisons.length,2);assert(audit.comparisons.every((row)=>row.contract_match&&row.shared_url_count===9&&row.evidence_digest.length===64&&row.policy==="same-keyword-snapshot-diff.v1"));
  assert.deepEqual(audit.comparisons.map((row)=>row.keyword),["it 就活 サイト","it 就活サイト"]);assert.equal(audit.comparisons.reduce((sum,row)=>sum+row.gained_urls.length+row.lost_urls.length,0),0);assert.equal(audit.comparisons.reduce((sum,row)=>sum+row.rank_movements.filter((item)=>item.rank_delta!==0||item.title_changed).length,0),11);
  const history=routeResearchApi("/api/v1/snapshot-history",new URL(`http://localhost/api/v1/snapshot-history?site_id=${site.site_id}`),dashboard,db);assert.equal(history.status,200);assert.equal(history.body.meta.total,2);assert.equal(history.body.view,"comparisons");assert.equal(history.body.auto_mutation,false);
  const adjacent=routeResearchApi("/api/v1/snapshot-history",new URL(`http://localhost/api/v1/snapshot-history?site_id=${site.site_id}&view=reuse&state=adjacent_intent_candidate`),dashboard,db);assert.equal(adjacent.status,200);assert.equal(adjacent.body.meta.total,2);assert(adjacent.body.data.every((row)=>row.reuse_state==="adjacent_intent_candidate"));
  const sites=routeResearchApi("/api/v1/sites",new URL("http://localhost/api/v1/sites"),dashboard,db);assert.equal(sites.body.data[0].snapshot_reuse_audit,undefined);
  console.log("SERP snapshot history API OK: 110 audited, 2 historical comparisons, 2 adjacent candidates, 6 isolated scope rows");
}finally{db.close()}
