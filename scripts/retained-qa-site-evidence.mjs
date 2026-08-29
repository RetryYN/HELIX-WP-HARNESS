import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const qaSources=[
  {source:"yahoo_chiebukuro",matches:(domain)=>domain==="detail.chiebukuro.yahoo.co.jp"},
  {source:"quora",matches:(domain)=>domain==="jp.quora.com"||domain.endsWith(".quora.com")},
  {source:"oshiete_goo",matches:(domain)=>domain==="oshiete.goo.ne.jp"},
  {source:"teratail",matches:(domain)=>domain==="teratail.com"},
  {source:"stack_overflow",matches:(domain)=>domain==="stackoverflow.com"||domain.endsWith(".stackoverflow.com")},
];

export function buildRetainedQaSiteEvidence(organicResults,taskScopes,competitorPages=[]){
  const taskById=new Map(taskScopes.map((row)=>[row.task_id,row])),pageByUrl=new Map(competitorPages.map((row)=>[row.url,row]));
  const rows=[];
  for(const result of organicResults){
    const source=qaSources.find((item)=>item.matches(String(result.domain??"").toLowerCase()));
    if(!source)continue;
    const task=taskById.get(result.task_id);if(!task)continue;
    const page=pageByUrl.get(result.url),contentState=page?.status==="ok"&&Number(page.text_length)>0?"retained_body_derived_evidence":page?.status==="robots_denied"?"robots_denied_serp_snippet_only":"serp_snippet_only";
    const base={site_id:task.site_id,group_id:task.group_id,task_id:result.task_id,source_keyword:task.keyword,rank_absolute:result.rank_absolute,qa_source:source.source,domain:result.domain,url:result.url,title:result.title,description:result.description??null,published_at:result.published_at??null,content_state:contentState,retained_text_length:contentState==="retained_body_derived_evidence"?Number(page.text_length):null,question_text_state:"observed_serp_title_not_normalized_question",answer_text_retained:false,full_qa_index:false,external_acquisition_triggered:false,policy:"retained-qa-site-evidence.v1"};
    rows.push({...base,evidence_digest:digest(base)});
  }
  rows.sort((a,b)=>a.rank_absolute-b.rank_absolute||a.source_keyword.localeCompare(b.source_keyword,"ja")||a.url.localeCompare(b.url));
  const uniqueUrls=new Set(rows.map((row)=>row.url)),sourceCounts=Object.fromEntries(qaSources.map(({source})=>[source,rows.filter((row)=>row.qa_source===source).length]).filter(([,count])=>count));
  return{rows,summary:{observation_count:rows.length,keyword_count:new Set(rows.map((row)=>row.task_id)).size,unique_page_count:uniqueUrls.size,source_counts:sourceCounts,body_derived_evidence_count:rows.filter((row)=>row.content_state==="retained_body_derived_evidence").length,snippet_only_count:rows.filter((row)=>row.content_state==="serp_snippet_only").length,robots_denied_count:rows.filter((row)=>row.content_state==="robots_denied_serp_snippet_only").length,best_rank:rows.length?Math.min(...rows.map((row)=>row.rank_absolute)):null,full_qa_index:false,external_acquisition_triggered:false},policy:"retained-qa-site-evidence.v1",answer_text_retained:false,full_qa_index:false,external_acquisition_triggered:false};
}
