import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const editorialStates=new Set(["approved_for_claim_use","changes_requested","rejected","deferred"]);

export function buildPublicSourceReviewPacket(evidenceOracle){
  const items=(evidenceOracle.rows??[]).filter((row)=>row.direct_support_state==="directly_supported"&&row.requirement_satisfied).map((row)=>{
    const base={review_id:`public-source-review:${row.claim_id}`,claim_id:row.claim_id,group_id:row.group_id,priority_band:row.priority_band,source_requirement:row.source_requirement,url:row.url,source_class:row.source_class,publisher:row.publisher??null,title:row.title??null,observed_facts:row.observed_facts??[],source_text_digest:row.source_text_digest,evidence_digest:row.evidence_digest,observed_support_state:row.direct_support_state,observed_requirement_satisfied:row.requirement_satisfied,review_state:"editor_review_required",publication_gate_state:"blocked_source_verification_and_citation_approval",auto_approval:false,auto_apply:false,auto_publication:false,policy:"public-source-review-packet.v1"};return{...base,review_digest:digest(base)};
  }).sort((a,b)=>a.priority_band.localeCompare(b.priority_band)||a.claim_id.localeCompare(b.claim_id));
  const summary={eligible_review_count:items.length,source_verified_count:0,citation_approved_count:0,approved_for_claim_use_count:0,reviewed_count:0,unreviewed_count:items.length,publication_unblocked_count:0,auto_approval_count:0,auto_apply_count:0,auto_publication_count:0};
  return{schema_version:"public-source-review-packet.v1",source_evidence_set_digest:evidenceOracle.evidence_set_digest,items,summary,packet_digest:digest({source_evidence_set_digest:evidenceOracle.evidence_set_digest,items}),policy:"public-source-review-packet.v1"};
}

export function validatePublicSourceReviewDecisions(packet,input){
  if(input?.schema_version!=="public-source-review-decisions.v1")throw new Error("decision schema version mismatch");
  if(input.packet_digest!==packet.packet_digest)throw new Error("review packet digest mismatch");
  if(!/^[a-f0-9]{64}$/u.test(input.reviewer_digest??""))throw new Error("reviewer_digest must be a 64-character lowercase SHA-256");
  const itemById=new Map(packet.items.map((row)=>[row.review_id,row])),seen=new Set(),decisions=[];
  for(const decision of input.decisions??[]){
    if(seen.has(decision.review_id))throw new Error(`duplicate public-source review decision: ${decision.review_id}`);seen.add(decision.review_id);
    const item=itemById.get(decision.review_id);if(!item)throw new Error(`unknown public-source review: ${decision.review_id}`);
    if(decision.review_digest!==item.review_digest)throw new Error(`stale public-source review digest: ${decision.review_id}`);
    if(!editorialStates.has(decision.editorial_state))throw new Error(`invalid editorial_state: ${decision.review_id}`);
    for(const field of ["source_identity_verified","source_requirement_verified","claim_direct_support_verified"])if(typeof decision[field]!=="boolean")throw new Error(`${field} must be boolean: ${decision.review_id}`);
    if(decision.editorial_state==="approved_for_claim_use"&&(!decision.source_identity_verified||!decision.source_requirement_verified||!decision.claim_direct_support_verified))throw new Error(`claim-use approval prerequisites are incomplete: ${decision.review_id}`);
    if(!/^\d{4}-\d{2}-\d{2}T/u.test(decision.reviewed_at??""))throw new Error(`reviewed_at must be ISO-like: ${decision.review_id}`);
    const base={review_id:decision.review_id,review_digest:decision.review_digest,claim_id:item.claim_id,evidence_digest:item.evidence_digest,reviewer_digest:input.reviewer_digest,editorial_state:decision.editorial_state,source_identity_verified:decision.source_identity_verified,source_requirement_verified:decision.source_requirement_verified,claim_direct_support_verified:decision.claim_direct_support_verified,source_verification_state:decision.source_identity_verified&&decision.source_requirement_verified&&decision.claim_direct_support_verified?"verified":"not_verified",citation_approval_state:decision.editorial_state==="approved_for_claim_use"?"approved":decision.editorial_state==="rejected"?"rejected":"pending",reviewed_at:decision.reviewed_at,notes:String(decision.notes??"").slice(0,2000),auto_approval:false,auto_apply:false,auto_publication:false};decisions.push({...base,decision_digest:digest(base)});
  }
  const base={schema_version:"public-source-review-decisions.v1",packet_digest:packet.packet_digest,reviewer_digest:input.reviewer_digest,decision_count:decisions.length,remaining_count:packet.items.length-decisions.length,complete:decisions.length===packet.items.length,auto_approval:false,auto_apply:false,auto_publication:false,decisions};return{...base,decision_set_digest:digest(base)};
}

export function attachPublicSourceReviewProgress(packet,decisionSets,decisions){
  const validSets=decisionSets.filter((row)=>row.packet_digest===packet.packet_digest),matching=decisions.filter((row)=>row.packet_digest===packet.packet_digest),byReview=Map.groupBy(matching,(row)=>row.review_id);
  const items=packet.items.map((item)=>{const reviews=byReview.get(item.review_id)??[],states=[...new Set(reviews.map((row)=>row.editorial_state))],editorialProgressState=!reviews.length?"unreviewed":states.length===1?states[0]:"reviewer_disagreement",approved=editorialProgressState==="approved_for_claim_use"&&reviews.every((row)=>row.source_verification_state==="verified"&&row.citation_approval_state==="approved"),base={...item,editorial_progress_state:editorialProgressState,review_count:reviews.length,reviewer_count:new Set(reviews.map((row)=>row.reviewer_digest)).size,decision_digests:reviews.map((row)=>row.decision_digest).sort(),source_verified:approved,citation_approved:approved,claim_use_approved:approved,publication_gate_state:approved?"blocked_pending_draft_application_and_publication_review":"blocked_source_verification_and_citation_approval",auto_approval:false,auto_apply:false,auto_publication:false};return{...base,progress_digest:digest(base)}});
  const progress={reviewer_count:new Set(validSets.map((row)=>row.reviewer_digest)).size,decision_set_count:validSets.length,decision_count:matching.length,reviewed_count:items.filter((row)=>row.review_count).length,unreviewed_count:items.filter((row)=>!row.review_count).length,source_verified_count:items.filter((row)=>row.source_verified).length,citation_approved_count:items.filter((row)=>row.citation_approved).length,approved_for_claim_use_count:items.filter((row)=>row.claim_use_approved).length,changes_requested_count:items.filter((row)=>row.editorial_progress_state==="changes_requested").length,rejected_count:items.filter((row)=>row.editorial_progress_state==="rejected").length,deferred_count:items.filter((row)=>row.editorial_progress_state==="deferred").length,disagreement_count:items.filter((row)=>row.editorial_progress_state==="reviewer_disagreement").length,publication_unblocked_count:0,auto_approval_count:0,auto_apply_count:0,auto_publication_count:0};
  return{...packet,items,summary:{...packet.summary,...progress},decision_progress:progress,progress_digest:digest(progress)};
}
