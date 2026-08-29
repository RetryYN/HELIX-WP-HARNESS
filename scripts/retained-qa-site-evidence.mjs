import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const qaSources=[
  {source:"yahoo_chiebukuro",matches:(domain)=>domain==="detail.chiebukuro.yahoo.co.jp"},
  {source:"quora",matches:(domain)=>domain==="jp.quora.com"||domain.endsWith(".quora.com")},
  {source:"oshiete_goo",matches:(domain)=>domain==="oshiete.goo.ne.jp"},
  {source:"teratail",matches:(domain)=>domain==="teratail.com"},
  {source:"stack_overflow",matches:(domain)=>domain==="stackoverflow.com"||domain.endsWith(".stackoverflow.com")},
];
export const qaSourceForDomain=(domain)=>qaSources.find((item)=>item.matches(String(domain??"").toLowerCase()))?.source??null;

export function buildRetainedQaSiteEvidence(organicResults,taskScopes,competitorPages=[]){
  const taskById=new Map(taskScopes.map((row)=>[row.task_id,row])),pageByUrl=new Map(competitorPages.map((row)=>[row.url,row]));
  const rows=[];
  for(const result of organicResults){
    const source=qaSourceForDomain(result.domain);
    if(!source)continue;
    const task=taskById.get(result.task_id);if(!task)continue;
    const page=pageByUrl.get(result.url),contentState=page?.status==="ok"&&Number(page.text_length)>0?"retained_body_derived_evidence":page?.status==="robots_denied"?"robots_denied_serp_snippet_only":"serp_snippet_only";
    const base={site_id:task.site_id,group_id:task.group_id,task_id:result.task_id,source_keyword:task.keyword,rank_absolute:result.rank_absolute,qa_source:source,domain:result.domain,url:result.url,title:result.title,description:result.description??null,published_at:result.published_at??null,content_state:contentState,retained_text_length:contentState==="retained_body_derived_evidence"?Number(page.text_length):null,question_text_state:"observed_serp_title_not_normalized_question",answer_text_retained:false,full_qa_index:false,external_acquisition_triggered:false,policy:"retained-qa-site-evidence.v1"};
    rows.push({...base,evidence_digest:digest(base)});
  }
  rows.sort((a,b)=>a.rank_absolute-b.rank_absolute||a.source_keyword.localeCompare(b.source_keyword,"ja")||a.url.localeCompare(b.url));
  const pages=[...Map.groupBy(rows,(row)=>row.url).entries()].map(([url,observations])=>{const representative=[...observations].sort((a,b)=>a.rank_absolute-b.rank_absolute||a.evidence_digest.localeCompare(b.evidence_digest))[0],ranks=observations.map((row)=>row.rank_absolute),base={site_id:representative.site_id,url,domain:representative.domain,qa_source:representative.qa_source,title:representative.title,content_state:observations.some((row)=>row.content_state==="retained_body_derived_evidence")?"retained_body_derived_evidence":observations.some((row)=>row.content_state==="robots_denied_serp_snippet_only")?"robots_denied_serp_snippet_only":"serp_snippet_only",observation_count:observations.length,keyword_count:new Set(observations.map((row)=>row.source_keyword)).size,group_count:new Set(observations.map((row)=>row.group_id)).size,source_keywords:[...new Set(observations.map((row)=>row.source_keyword))].sort((a,b)=>a.localeCompare(b,"ja")),group_ids:[...new Set(observations.map((row)=>row.group_id))].sort(),task_ids:[...new Set(observations.map((row)=>row.task_id))].sort(),best_rank:Math.min(...ranks),worst_rank:Math.max(...ranks),average_rank:ranks.reduce((sum,rank)=>sum+rank,0)/ranks.length,observation_digests:observations.map((row)=>row.evidence_digest).sort(),cross_keyword_evidence:observations.length>1,auto_content_mutation:false,external_acquisition_triggered:false,policy:"retained-qa-page-aggregation.v1"};return{...base,page_evidence_digest:digest(base)}}).sort((a,b)=>b.keyword_count-a.keyword_count||b.group_count-a.group_count||a.best_rank-b.best_rank||a.url.localeCompare(b.url));
  const sourceCounts=Object.fromEntries(qaSources.map(({source})=>[source,rows.filter((row)=>row.qa_source===source).length]).filter(([,count])=>count));
  return{rows,pages,summary:{observation_count:rows.length,keyword_count:new Set(rows.map((row)=>row.task_id)).size,unique_page_count:pages.length,duplicate_page_count:pages.filter((row)=>row.observation_count>1).length,multi_keyword_page_count:pages.filter((row)=>row.keyword_count>1).length,multi_group_page_count:pages.filter((row)=>row.group_count>1).length,maximum_page_keyword_count:Math.max(0,...pages.map((row)=>row.keyword_count)),source_counts:sourceCounts,body_derived_evidence_count:rows.filter((row)=>row.content_state==="retained_body_derived_evidence").length,snippet_only_count:rows.filter((row)=>row.content_state==="serp_snippet_only").length,robots_denied_count:rows.filter((row)=>row.content_state==="robots_denied_serp_snippet_only").length,best_rank:rows.length?Math.min(...rows.map((row)=>row.rank_absolute)):null,full_qa_index:false,external_acquisition_triggered:false},policy:"retained-qa-site-evidence.v2",answer_text_retained:false,full_qa_index:false,external_acquisition_triggered:false};
}
