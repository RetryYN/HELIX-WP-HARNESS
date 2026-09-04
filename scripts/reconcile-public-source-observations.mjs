import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

// This reconciles captured records, never source approvals or publication decisions.
// Legacy v1 hashed queue position together with the evidence-relevant candidate fields.
export function reconcilePublicSourceObservations(observations,candidates,{maximumLegacySourceOrder=1999}={}){
  if(!Number.isSafeInteger(maximumLegacySourceOrder)||maximumLegacySourceOrder<0||maximumLegacySourceOrder>9999)throw new Error("invalid legacy source order bound");
  const byClaim=new Map();
  for(const candidate of candidates){
    if(byClaim.has(candidate.claim_id))throw new Error("duplicate current source claim");
    const {candidate_digest,batch_id,...base}=candidate;
    if(digest(base)!==candidate_digest)throw new Error("current source candidate digest mismatch");
    byClaim.set(candidate.claim_id,{candidate,base});
  }
  const accepted=[],deferred=[],seen=new Set();
  let exact=0,reordered=0;
  for(const observation of observations.rows??[]){
    if(seen.has(observation.claim_id))throw new Error("duplicate captured source claim");
    seen.add(observation.claim_id);
    const current=byClaim.get(observation.claim_id);
    const defer=(reason)=>deferred.push({claim_id:observation.claim_id,capture_candidate_digest:observation.candidate_digest,capture_observation_digest:digest(observation),reason});
    if(!current){defer("not_in_current_manifest");continue;}
    const {candidate,base}=current;
    if(observation.query!==candidate.selected_query){defer("selected_query_changed");continue;}
    if(observation.candidate_digest===candidate.candidate_digest){accepted.push(structuredClone(observation));exact++;continue;}
    if(base.policy!=="claim-discovery-portfolio.v1"||!Number.isSafeInteger(base.source_order)||base.source_order<0){defer("legacy_identity_not_supported");continue;}
    let oldOrder=null;
    for(let order=0;order<=maximumLegacySourceOrder;order++){
      if(digest({...base,source_order:order})===observation.candidate_digest){oldOrder=order;break;}
    }
    if(oldOrder===null){defer("order_only_identity_not_proven_within_bound");continue;}
    const {source_order,...stableIdentity}=base;
    const receipt={policy:"public-source-order-reconciliation.v1",capture_candidate_digest:observation.candidate_digest,current_candidate_digest:candidate.candidate_digest,capture_source_order:oldOrder,current_source_order:source_order,stable_candidate_identity_digest:digest(stableIdentity),capture_observation_digest:digest(observation),maximum_legacy_source_order:maximumLegacySourceOrder,source_content_changed:false,approval_transferred:false};
    accepted.push({...structuredClone(observation),candidate_digest:candidate.candidate_digest,capture_candidate_digest:observation.candidate_digest,compatibility_receipt:{...receipt,receipt_digest:digest(receipt)}});
    reordered++;
  }
  return{observations:{...observations,rows:accepted},deferred,summary:{retained_observation_count:(observations.rows??[]).length,exact_match_count:exact,order_only_reconciled_count:reordered,deferred_count:deferred.length,approval_transferred_count:0,paid_acquisition_triggered:false}};
}
