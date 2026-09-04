import assert from "node:assert/strict";
import {buildClaimDiscoveryPortfolio} from "./claim-discovery-portfolio.mjs";
import {reconcilePublicSourceObservations} from "./reconcile-public-source-observations.mjs";
import {buildNewArticlePublicSourceEvidence} from "./new-article-public-source-evidence.mjs";
import {buildPublicSourceReviewPacket,attachPublicSourceReviewProgress} from "./public-source-review-ledger.mjs";

const claim=(id)=>({claim_id:id,group_id:"g",main_keyword:"例",topic:"定義",priority_band:"P1",source_requirement:"authoritative_definition_or_entity_source_required",discovery_queries:["一次資料","用語 定義","別の資料"],citation_candidate_count:0});
const original=buildClaimDiscoveryPortfolio({rows:[claim("a"),claim("b")]});
const current=buildClaimDiscoveryPortfolio({rows:[claim("b"),claim("a")]});
const observations={observed_at:"2026-01-01",rows:original.candidates.map(c=>({claim_id:c.claim_id,query:c.selected_query,candidate_digest:c.candidate_digest,title:"保持した出典",observed_facts:["保持した事実"]}))};
const before=JSON.stringify({original,current,observations});
const result=reconcilePublicSourceObservations(observations,current.candidates);
assert.equal(result.summary.order_only_reconciled_count,2);
assert.equal(result.summary.deferred_count,0);
assert.equal(result.summary.approval_transferred_count,0);
for(const row of result.observations.rows){
  const captured=observations.rows.find(c=>c.claim_id===row.claim_id);
  assert.equal(row.capture_candidate_digest,captured.candidate_digest);
  assert.equal(row.compatibility_receipt.approval_transferred,false);
  assert.deepEqual(row.observed_facts,captured.observed_facts);
  assert.equal(row.title,captured.title);
}
assert.equal(JSON.stringify({original,current,observations}),before);
const validSource=(row)=>({...row,executed_query:row.query,query_strategy_state:"planned_query_executed",result_state:"qualifying_candidate_observed",direct_support_state:"directly_supported",url:"https://fixture.example/source",source_class:"government",approval_state:"approved",auto_approval:true,auto_publication:true});
const evidence=buildNewArticlePublicSourceEvidence({rows:[{queries:current.candidates}]},{...result.observations,rows:result.observations.rows.map(validSource)});
assert(evidence.rows.every(row=>row.approval_state==="unreviewed"&&!row.auto_approval&&!row.auto_publication&&row.compatibility_receipt.approval_transferred===false));
assert.equal(evidence.summary.auto_approval_count,0);
const oldEvidence=buildNewArticlePublicSourceEvidence({rows:[{queries:original.candidates}]},{...observations,rows:observations.rows.map(validSource)});
const oldPacket=buildPublicSourceReviewPacket(oldEvidence),newPacket=buildPublicSourceReviewPacket(evidence);
assert.notEqual(newPacket.packet_digest,oldPacket.packet_digest);
const oldDecisions=oldPacket.items.map(item=>({packet_digest:oldPacket.packet_digest,review_id:item.review_id,editorial_state:"approved_for_claim_use",source_verification_state:"verified",citation_approval_state:"approved"}));
const progress=attachPublicSourceReviewProgress(newPacket,[{packet_digest:oldPacket.packet_digest}],oldDecisions);
assert.equal(progress.summary.approved_for_claim_use_count,0);
assert.equal(progress.summary.unreviewed_count,2);
assert.equal(reconcilePublicSourceObservations(observations,original.candidates).summary.exact_match_count,2);
for(const field of ["topic","main_keyword","priority_band","citation_candidate_count"]){
  const changed=claim("a");changed[field]=field==="citation_candidate_count"?1:"changed";
  const candidates=buildClaimDiscoveryPortfolio({rows:[claim("b"),changed]}).candidates;
  assert.equal(reconcilePublicSourceObservations(observations,candidates).deferred.find(r=>r.claim_id==="a").reason,"order_only_identity_not_proven_within_bound");
}
const changedQuery=claim("a");changedQuery.discovery_queries[1]="別のクエリ";
assert.equal(reconcilePublicSourceObservations(observations,buildClaimDiscoveryPortfolio({rows:[changedQuery]}).candidates).deferred.find(r=>r.claim_id==="a").reason,"selected_query_changed");
assert.equal(reconcilePublicSourceObservations(observations,[]).summary.deferred_count,2);
assert.equal(reconcilePublicSourceObservations(observations,current.candidates,{maximumLegacySourceOrder:0}).summary.deferred_count,1);
assert.throws(()=>reconcilePublicSourceObservations(observations,[{...current.candidates[0],topic:"tampered"}]),/digest mismatch/);
assert.throws(()=>reconcilePublicSourceObservations(observations,[...current.candidates,current.candidates[0]]),/duplicate/);
assert.throws(()=>reconcilePublicSourceObservations({...observations,rows:[observations.rows[0],observations.rows[0]]},current.candidates),/duplicate/);
assert.throws(()=>reconcilePublicSourceObservations(observations,[],{maximumLegacySourceOrder:Infinity}),/bound/);
console.log("public source reconciliation: OK (order-only digest proof, original content retained, changed content deferred, no approval transfer)");
