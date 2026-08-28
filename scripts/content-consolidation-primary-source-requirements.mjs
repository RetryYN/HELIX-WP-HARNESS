import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const topicOf=(text)=>String(text).match(/「([^」]+)」/)?.[1]??String(text).slice(0,80);
const requirementFor=(topic)=>{
  if(/外資/iu.test(topic))return{kind:"official_employer_recruiting_schedule",types:["official_employer_careers_page","official_recruiting_guideline"],query:`${topic} 新卒 採用 スケジュール 公式`};
  if(/sier/iu.test(topic))return{kind:"official_industry_definition_and_employer_schedule",types:["government_or_public_industry_definition","official_employer_careers_page"],query:`${topic} 定義 採用 公式 site:meti.go.jp OR site:ipa.go.jp`};
  if(/企業/iu.test(topic))return{kind:"official_employer_recruiting_schedule",types:["official_employer_careers_page","official_recruiting_guideline"],query:`${topic} 新卒 採用 選考 公式`};
  if(/業界/iu.test(topic))return{kind:"public_industry_definition_or_statistics",types:["government_publication","public_institution_industry_report"],query:`${topic} 定義 統計 site:meti.go.jp OR site:soumu.go.jp OR site:ipa.go.jp`};
  return{kind:"official_employer_recruiting_schedule",types:["official_employer_careers_page","official_recruiting_guideline"],query:`${topic} 新卒 採用 選考 スケジュール 公式`};
};

export function buildConsolidationPrimarySourceRequirements(blueprints,recommendations,backfillCandidates){
  const allCandidates=[...recommendations,...backfillCandidates],byClaim=Map.groupBy(allCandidates,(row)=>row.merged_claim_id),rows=[];
  for(const blueprint of blueprints)for(const claim of blueprint.merged_draft_preview?.claims??[]){
    if(claim.claim_id.endsWith(":intro"))continue;
    const topic=topicOf(claim.text),requirement=requirementFor(topic),candidates=byClaim.get(claim.claim_id)??[],urls=[...new Set(candidates.map((row)=>row.url))].sort(),provenUrls=[...new Set(candidates.filter((row)=>row.authority_audit?.primary_source_state==="proven").map((row)=>row.url))].sort(),record={left_group_id:blueprint.left_group_id,right_group_id:blueprint.right_group_id,merged_claim_id:claim.claim_id,claim_text:claim.text,topic,requirement_kind:requirement.kind,required_source_types:requirement.types,discovery_query:requirement.query,current_candidate_url_count:urls.length,current_candidate_urls:urls,primary_source_proven_url_count:provenUrls.length,primary_source_proven_urls:provenUrls,gap_state:provenUrls.length?"primary_source_requirement_satisfied":"primary_source_required",acquisition_state:"planned_not_executed",external_acquisition_triggered:false,approval_state:"unreviewed",auto_approval:false,policy:"content-consolidation-primary-source-requirement.v1"};rows.push({...record,requirement_digest:digest(record)});
  }
  return{policy:"content-consolidation-primary-source-requirement.v1",rows,summary:{requirement_count:rows.length,satisfied_count:rows.filter((row)=>row.gap_state==="primary_source_requirement_satisfied").length,missing_count:rows.filter((row)=>row.gap_state==="primary_source_required").length,planned_not_executed_count:rows.filter((row)=>row.acquisition_state==="planned_not_executed").length,claim_with_current_candidate_count:rows.filter((row)=>row.current_candidate_url_count>0).length,claim_with_primary_source_count:rows.filter((row)=>row.primary_source_proven_url_count>0).length,external_acquisition_triggered:false,auto_approval:false}};
}
