import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi,setResearchDb} from "./keyword-dashboard-api.mjs";

const db=new DatabaseSync(".helix/keyword-dashboard.sqlite",{readOnly:true});
try{
  setResearchDb(db);const data=projectDashboard(db),siteId=data.sites[0].site_id,response=routeResearchApi("/api/v1/drafts",new URL(`http://localhost/api/v1/drafts?site_id=${siteId}&limit=100`),data,db);
  assert.equal(response.status,200);assert.equal(response.body.meta.total,63);assert.equal(response.body.summary.draft_count,63);assert.equal(response.body.summary.claim_count,573);assert.equal(response.body.summary.verified_claim_count,0);assert.equal(response.body.summary.blocked_count,63);assert.equal(response.body.summary.text_export_count,63);assert.equal(response.body.summary.html_export_count,63);assert.equal(response.body.summary.auto_approval,false);
  assert.ok(response.body.data.every((row)=>row.renderer_version==="content-evidence-draft.v1"&&row.review.publication_state==="blocked"&&!row.review.auto_approval&&row.sections.length>=3&&row.claims.length===row.sections.length+1&&row.text&&row.html&&row.revision_digest.length===64));
  assert.equal(response.body.provenance.external_acquisition_triggered,false);console.log(`content evidence draft API: OK (${response.body.summary.draft_count} drafts, ${response.body.summary.claim_count} claims, text/HTML, publication blocked)`);
}finally{setResearchDb(null);db.close()}
