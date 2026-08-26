import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function resolveContentClaimEvidence(revision,candidates,{topics=[],competitorPages=[],featureItems=[]}={}){
  const candidateById=new Map(candidates.map((row)=>[row.candidate_id,row])),topicById=new Map(topics.map((row)=>[row.proposal_id,row])),pageById=new Map(competitorPages.map((row)=>[row.page_id,row])),featureById=new Map(featureItems.map((row)=>[row.feature_item_id,row])),sectionByClaimId=new Map(revision.sections.map((section)=>[section.paragraphs[0]?.claim_ids[0],section]));
  const references=[];
  for(const claim of revision.claims){const section=sectionByClaimId.get(claim.claim_id),candidate=section?candidateById.get(section.heading_candidate_id):null,evidenceType=candidate?.evidence_type??null;for(const [index,evidenceId] of claim.evidence_ids.entries()){
    let source=null;
    if(evidenceType==="serp_demand"){const row=topicById.get(evidenceId);if(row)source={source_type:evidenceType,label:row.display_topic,topic_kind:row.topic_kind,relation:row.relation,occurrence_count:row.occurrence_count,task_count:row.task_count,evidence_occurrence_ids:(row.evidence??[]).map((item)=>item.occurrence_id),url:null}}
    else if(evidenceType==="competitor_term"){const row=pageById.get(evidenceId);if(row)source={source_type:evidenceType,label:row.title??row.url,url:row.url,domain:row.domain,status:row.status,snapshot_digest:row.snapshot_digest??null}}
    else if(evidenceType==="serp_feature_item"){const row=featureById.get(evidenceId);if(row)source={source_type:evidenceType,label:row.text??row.title??row.alt??row.source??row.url,url:row.url??null,feature_type:row.feature_type,task_id:row.task_id,source:row.source??null,evidence_digest:row.evidence_digest??null}}
    const base={claim_id:claim.claim_id,evidence_order:index+1,evidence_id:evidenceId,evidence_type:evidenceType,resolution_state:source?"resolved":"unresolved",source};references.push({...base,reference_digest:digest(base)});
  }}
  const applicableClaims=revision.claims.filter((claim)=>claim.verification_state!=="not_applicable"),resolved=references.filter((row)=>row.resolution_state==="resolved").length,total=references.length,claimsWithEvidence=new Set(references.filter((row)=>row.resolution_state==="resolved").map((row)=>row.claim_id));
  const oracle={policy:"content-claim-evidence-resolution.v1",claim_count:revision.claims.length,applicable_claim_count:applicableClaims.length,claim_with_resolved_evidence_count:claimsWithEvidence.size,evidence_reference_count:total,resolved_evidence_reference_count:resolved,unresolved_evidence_reference_count:total-resolved,evidence_resolution_rate:total?resolved/total:null,all_references_resolved:total>0&&resolved===total,fact_verification_state:"pending_primary_source",publication_state:"blocked",auto_approval:false};
  return{references,oracle,oracle_digest:digest(oracle)};
}
