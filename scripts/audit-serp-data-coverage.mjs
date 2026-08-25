import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const defaultRoot=path.resolve(repoRoot,"artifacts/poc/keyword-workbook-100-live/raw");
const present=(value)=>value!==null&&value!==undefined&&value!==""&&(!Array.isArray(value)||value.length>0);

const projectedFields=new Set([
  "task.id","task.status_code","task.status_message","task.time","task.cost","task.result_count","task.path","task.data.keyword",
  "result.keyword","result.type","result.se_domain","result.location_code","result.language_code","result.check_url","result.datetime","result.spell","result.refinement_chips","result.item_types","result.se_results_count","result.pages_count","result.items_count",
  "organic.type","organic.rank_group","organic.rank_absolute","organic.page","organic.position","organic.xpath","organic.domain","organic.title","organic.url","organic.breadcrumb","organic.website_name","organic.description","organic.pre_snippet","organic.timestamp","organic.highlighted","organic.links","organic.rating","organic.price","organic.is_image","organic.is_video","organic.is_featured_snippet","organic.is_malicious","organic.is_web_story","organic.amp_version","organic.checks",
  "ai_overview.type","ai_overview.rank_group","ai_overview.rank_absolute","ai_overview.page","ai_overview.position","ai_overview.xpath","ai_overview.asynchronous_ai_overview","ai_overview.markdown","ai_overview.references",
  "people_also_ask.items.title","people_also_ask.items.seed_question",
  "related_searches.items"
]);
const genericallyProjectedItemFields=new Set(["type","rank_group","rank_absolute","page","position","xpath","title","url"]);
const payloadProjectedItemTypes=new Set(["people_also_ask","related_searches","ai_overview","knowledge_graph","people_also_search","images","video"]);
const decisionConnectedFields=new Set([
  "result.spell","result.item_types","organic.rank_group","organic.rank_absolute","organic.domain","organic.title","organic.url","organic.description","organic.timestamp","organic.highlighted","organic.rating","organic.price",
  "ai_overview.markdown","ai_overview.references","people_also_ask.items.title","people_also_ask.items.seed_question","related_searches.items"
]);
const isProjected=(field)=>projectedFields.has(field)||payloadProjectedItemTypes.has(field.slice(0,field.indexOf(".")))||genericallyProjectedItemFields.has(field.slice(field.indexOf(".")+1));

export function auditSerpDataCoverage(rawRoot=defaultRoot){
  const files=readdirSync(rawRoot).filter((name)=>name.endsWith(".json")).sort();
  const captured=new Map();
  const bump=(field,amount=1)=>captured.set(field,(captured.get(field)??0)+amount);
  const itemTypes=new Map();
  let paaQuestions=0,paaAnswers=0,paaReferences=0,aioItems=0,aioReferences=0;
  for(const name of files){
    const task=JSON.parse(readFileSync(path.join(rawRoot,name),"utf8")).tasks?.[0];
    const result=task?.result?.[0];
    if(!task||!result)continue;
    for(const [field,value] of Object.entries({"task.id":task.id,"task.status_code":task.status_code,"task.status_message":task.status_message,"task.time":task.time,"task.cost":task.cost,"task.result_count":task.result_count,"task.path":task.path,"task.data.keyword":task.data?.keyword,"result.keyword":result.keyword,"result.type":result.type,"result.se_domain":result.se_domain,"result.location_code":result.location_code,"result.language_code":result.language_code,"result.check_url":result.check_url,"result.datetime":result.datetime,"result.spell":result.spell,"result.refinement_chips":result.refinement_chips,"result.item_types":result.item_types,"result.se_results_count":result.se_results_count,"result.pages_count":result.pages_count,"result.items_count":result.items_count}))if(present(value))bump(field);
    for(const item of result.items??[]){
      itemTypes.set(item.type,(itemTypes.get(item.type)??0)+1);
      const prefix=item.type;
      for(const [key,value] of Object.entries(item))if(key!=="items"&&present(value))bump(`${prefix}.${key}`);
      if(item.type==="people_also_ask")for(const question of item.items??[]){paaQuestions+=1;if(present(question.title))bump("people_also_ask.items.title");if(present(question.seed_question))bump("people_also_ask.items.seed_question");for(const expanded of question.expanded_element??[]){paaAnswers+=(expanded.items??[]).length;paaReferences+=(expanded.references??[]).length}}
      if(item.type==="related_searches")for(const value of item.items??[])if(present(value))bump("related_searches.items");
      if(item.type==="ai_overview"){aioItems+=(item.items??[]).length;aioReferences+=(item.references??[]).length}
    }
  }
  const capturedAndProjected=[...captured].filter(([field])=>isProjected(field)).map(([field,nonempty_count])=>({field,nonempty_count}));
  const capturedRawOnly=[...captured].filter(([field])=>!isProjected(field)).map(([field,nonempty_count])=>({field,nonempty_count}));
  const projectedButNotDecisionConnected=capturedAndProjected.filter(({field})=>!decisionConnectedFields.has(field));
  return {
    schema_version:"serp-data-coverage-audit.v2",raw_files:files.length,
    item_type_counts:Object.fromEntries(itemTypes),captured_and_projected:capturedAndProjected,captured_raw_only:capturedRawOnly,
    projected_but_not_decision_connected:projectedButNotDecisionConnected,
    acquired_but_empty_or_incomplete:{paa_questions:paaQuestions,paa_answer_items:paaAnswers,paa_references:paaReferences,aio_items:aioItems,aio_references:aioReferences},
    not_acquired:[
      {dataset:"PAA expanded answers/references",reason:"people_also_ask_click_depth was not requested"},
      {dataset:"SERP pixel rectangles",reason:"calculate_rectangles was not requested"},
      {dataset:"competitor H1-H6/body/link graph",reason:"top URLs were not passed through page/content parsing"},
      {dataset:"fresh keyword volume/monthly history/CPC/competition/SEO difficulty",reason:"SERP snapshots do not replace Keywords Data/Labs acquisition"},
      {dataset:"ranked keywords/pages/domain competitors/history",reason:"DataForSEO Labs datasets were not acquired"},
      {dataset:"multi-engine suggestions/question corpus/trends/news/Q&A/social hashtags",reason:"no corresponding provider acquisition exists"}
    ]
  };
}

if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(auditSerpDataCoverage(process.argv[2]?path.resolve(process.argv[2]):defaultRoot),null,2));
