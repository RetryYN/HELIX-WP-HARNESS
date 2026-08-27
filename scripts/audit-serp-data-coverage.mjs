import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const defaultRoot=path.resolve(repoRoot,"artifacts/poc/keyword-workbook-100-live/raw");
const present=(value)=>value!==null&&value!==undefined&&value!==""&&(!Array.isArray(value)||value.length>0);

const projectedFields=new Set([
  "task.id","task.status_code","task.status_message","task.time","task.cost","task.result_count","task.path","task.data","task.data.keyword",
  "result.keyword","result.type","result.se_domain","result.location_code","result.language_code","result.check_url","result.datetime","result.spell","result.refinement_chips","result.item_types","result.se_results_count","result.pages_count","result.items_count",
  "organic.type","organic.rank_group","organic.rank_absolute","organic.page","organic.position","organic.xpath","organic.domain","organic.title","organic.url","organic.breadcrumb","organic.website_name","organic.description","organic.pre_snippet","organic.timestamp","organic.highlighted","organic.links","organic.rating","organic.price","organic.is_image","organic.is_video","organic.is_featured_snippet","organic.is_malicious","organic.is_web_story","organic.amp_version","organic.checks",
  "ai_overview.type","ai_overview.rank_group","ai_overview.rank_absolute","ai_overview.page","ai_overview.position","ai_overview.xpath","ai_overview.asynchronous_ai_overview","ai_overview.markdown","ai_overview.references",
  "people_also_ask.items.title","people_also_ask.items.seed_question",
  "related_searches.items"
]);
const genericallyProjectedItemFields=new Set(["type","rank_group","rank_absolute","page","position","xpath","title","url"]);
const payloadProjectedItemTypes=new Set(["people_also_ask","related_searches","ai_overview","knowledge_graph","people_also_search","images","video"]);
const decisionConnectedFields=new Set([
  "result.spell","result.item_types","organic.rank_group","organic.rank_absolute","organic.domain","organic.title","organic.url","organic.breadcrumb","organic.website_name","organic.description","organic.pre_snippet","organic.timestamp","organic.highlighted","organic.links","organic.rating","organic.price","organic.is_video","organic.checks",
  "ai_overview.asynchronous_ai_overview","ai_overview.markdown","ai_overview.references","people_also_ask.items.title","people_also_ask.items.seed_question","related_searches.items"
  ,"knowledge_graph.items[].type","knowledge_graph.items[].links[].title","knowledge_graph.items[].links[].url","knowledge_graph.items[].links[].domain","people_also_search.items[].value","images.items[].type","images.items[].alt","images.items[].url","video.items[].type","video.items[].source","video.items[].title","video.items[].url"
]);
const decisionFeatureFields=new Set(["title","subtitle","description","url","image_url"]),booleanOrganicFields=new Set(["is_image","is_video","is_featured_snippet","is_malicious","is_web_story","amp_version"]);
const classificationFor=(field)=>{if(decisionConnectedFields.has(field))return"decision_connected";const [prefix,key]=field.split(".");if(["knowledge_graph","people_also_search","images","video"].includes(prefix)&&decisionFeatureFields.has(key))return"decision_connected";if(projectedFields.has(field)||payloadProjectedItemTypes.has(prefix)||genericallyProjectedItemFields.has(key))return"evidence_only";return"unclassified"};
const isProjected=(field)=>projectedFields.has(field)||payloadProjectedItemTypes.has(field.slice(0,field.indexOf(".")))||genericallyProjectedItemFields.has(field.slice(field.indexOf(".")+1));
const ancestors=(field)=>{const parts=field.split("."),values=[];while(parts.length){const value=parts.join(".");values.push(value,value.replaceAll("[]",""));parts.pop()}return[...new Set(values)]};
const leafProjection=(field)=>{const prefix=field.split(".")[0];if(payloadProjectedItemTypes.has(prefix))return{projection_state:"projected",storage_kind:"raw_feature_payload_json"};const ancestor=ancestors(field).find((candidate)=>projectedFields.has(candidate));return ancestor?{projection_state:"projected",storage_kind:ancestor===field?"structured_or_normalized":"ancestor_json",projection_ancestor:ancestor}:{projection_state:"raw_only",storage_kind:"raw_snapshot_only"}};
const consumerRules=[
  [/^result\.item_types\[\]$/u,"scripts/serp-snapshot-history.mjs","item_types","SERP feature change detection"],
  [/^organic\.rank_group$/u,"scripts/serp-page-keyword-graph.mjs","row.rank_group","URL/keyword graph depth and weighting"],
  [/^organic\.rank_absolute$/u,"scripts/serp-action-signals.mjs","rank_absolute","SERP action evidence rank"],
  [/^organic\.(?:domain|url)$/u,"scripts/serp-page-keyword-graph.mjs","canonicalSerpUrl","page/domain overlap graph"],
  [/^organic\.title$/u,"scripts/keyword-dashboard-api.mjs","row.title","SERP content search"],
  [/^organic\.website_name$/u,"scripts/serp-brand-analysis.mjs","row.website_name","display-brand occupancy"],
  [/^organic\.timestamp$/u,"scripts/serp-freshness-signals.mjs","row.timestamp","top-result freshness distribution"],
  [/^organic\.(?:type|page|position|xpath|is_image|is_featured_snippet|is_malicious|is_web_story|amp_version|checks)(?:\[\])?$/u,"scripts/serp-presentation-integrity.mjs","attributes","presentation integrity and positive-format evidence"],
  [/^organic\.(?:breadcrumb|description|pre_snippet|highlighted)(?:\[\])?$/u,"scripts/keyword-dashboard-api.mjs","textFor","SERP message search"],
  [/^organic\.links\[\]\.(?:type|title|url|domain|description)$/u,"scripts/keyword-dashboard-api.mjs","row.links","sitelink search"],
  [/^organic\.(?:is_video|price|rating)(?:\.|$)/u,"scripts/serp-action-signals.mjs","priced","format/action guidance"],
  [/^people_also_ask\.items\[\]\.title$/u,"scripts/content-topic-proposals.mjs","topic_kind","question topic planning"],
  [/^related_searches\.items\[\]$/u,"scripts/content-topic-proposals.mjs","topic_kind","related-search topic planning"],
  [/^ai_overview\.asynchronous_ai_overview$/u,"scripts/keyword-dashboard-db.mjs","responseState","AIO acquisition-state gate"],
  [/^ai_overview\.markdown$/u,"scripts/keyword-dashboard-api.mjs","row.markdown","AIO answer search"],
  [/^ai_overview\.references\[\]\.(?:position|source|domain|url|title|text)$/u,"scripts/aio-citation-analysis.mjs","reference.url","AIO citation normalization"],
  [/^(?:knowledge_graph|images|video)\.items\[\]/u,"scripts/serp-feature-items.mjs","feature.payload","special SERP item normalization"],
  [/^result\.spell\.(?:keyword|type)$/u,"scripts/serp-action-signals.mjs","task.spell","spelling correction guidance"]
];
const consumerSourceCache=new Map(),consumerFor=(field)=>{const rule=consumerRules.find(([pattern])=>pattern.test(field));if(!rule)return null;const [,file,token,use]=rule;const source=consumerSourceCache.get(file)??readFileSync(path.resolve(repoRoot,file),"utf8");consumerSourceCache.set(file,source);return{file,token,use,verification_state:source.includes(token)?"verified_source_reference":"missing_source_reference"}};
const walkLeaves=(value,prefix,bump)=>{if(value==null||value==="")return;if(Array.isArray(value)){if(!value.length)return;for(const item of value)typeof item==="object"&&item!==null?walkLeaves(item,`${prefix}[]`,bump):bump(`${prefix}[]`);return}if(typeof value==="object"){for(const [key,item] of Object.entries(value))walkLeaves(item,`${prefix}.${key}`,bump);return}bump(prefix)};

export function auditSerpDataCoverage(rawRoot=defaultRoot){
  const files=readdirSync(rawRoot).filter((name)=>name.endsWith(".json")).sort();
  const captured=new Map();
  const rawLeafCaptured=new Map(),bumpLeaf=(field)=>rawLeafCaptured.set(field,(rawLeafCaptured.get(field)??0)+1);
  const bump=(field,amount=1)=>captured.set(field,(captured.get(field)??0)+amount);
  const booleanObservations=new Map(),observeBoolean=(field,value)=>{const row=booleanObservations.get(field)??{field,observed_count:0,true_count:0,false_count:0};row.observed_count+=1;value===true||value===1?row.true_count+=1:row.false_count+=1;booleanObservations.set(field,row)};
  const itemTypes=new Map();
  let paaQuestions=0,paaAnswers=0,paaReferences=0,aioItems=0,aioReferences=0;
  for(const name of files){
    const task=JSON.parse(readFileSync(path.join(rawRoot,name),"utf8")).tasks?.[0];
    const result=task?.result?.[0];
    if(!task||!result)continue;
    for(const [key,value] of Object.entries(task))if(key!=="result")walkLeaves(value,`task.${key}`,bumpLeaf);for(const [key,value] of Object.entries(result))if(key!=="items")walkLeaves(value,`result.${key}`,bumpLeaf);
    for(const [field,value] of Object.entries({"task.id":task.id,"task.status_code":task.status_code,"task.status_message":task.status_message,"task.time":task.time,"task.cost":task.cost,"task.result_count":task.result_count,"task.path":task.path,"task.data.keyword":task.data?.keyword,"result.keyword":result.keyword,"result.type":result.type,"result.se_domain":result.se_domain,"result.location_code":result.location_code,"result.language_code":result.language_code,"result.check_url":result.check_url,"result.datetime":result.datetime,"result.spell":result.spell,"result.refinement_chips":result.refinement_chips,"result.item_types":result.item_types,"result.se_results_count":result.se_results_count,"result.pages_count":result.pages_count,"result.items_count":result.items_count}))if(present(value))bump(field);
    for(const item of result.items??[]){
      walkLeaves(item,item.type,bumpLeaf);
      itemTypes.set(item.type,(itemTypes.get(item.type)??0)+1);
      const prefix=item.type;
      for(const [key,value] of Object.entries(item))if(key!=="items"&&present(value)){const field=`${prefix}.${key}`;bump(field);if(prefix==="organic"&&booleanOrganicFields.has(key))observeBoolean(field,value)}
      if(item.type==="people_also_ask")for(const question of item.items??[]){paaQuestions+=1;if(present(question.title))bump("people_also_ask.items.title");if(present(question.seed_question))bump("people_also_ask.items.seed_question");for(const expanded of question.expanded_element??[]){paaAnswers+=(expanded.items??[]).length;paaReferences+=(expanded.references??[]).length}}
      if(item.type==="related_searches")for(const value of item.items??[])if(present(value))bump("related_searches.items");
      if(item.type==="ai_overview"){aioItems+=(item.items??[]).length;aioReferences+=(item.references??[]).length}
      if(["knowledge_graph","people_also_search","images","video"].includes(prefix))for(const nested of item.items??[]){if(typeof nested==="string"){if(present(nested))bump(`${prefix}.items[].value`);continue}for(const [key,value] of Object.entries(nested??{}))if(key!=="links"&&present(value))bump(`${prefix}.items[].${key}`);for(const link of nested?.links??[])for(const [key,value] of Object.entries(link))if(present(value))bump(`${prefix}.items[].links[].${key}`)}
    }
  }
  const capturedAndProjected=[...captured].filter(([field])=>isProjected(field)).map(([field,nonempty_count])=>({field,nonempty_count}));
  const capturedRawOnly=[...captured].filter(([field])=>!isProjected(field)).map(([field,nonempty_count])=>({field,nonempty_count}));
  const classifiedProjected=capturedAndProjected.map((row)=>({...row,classification:classificationFor(row.field)})),decisionConnected=classifiedProjected.filter((row)=>row.classification==="decision_connected"),evidenceOnly=classifiedProjected.filter((row)=>row.classification==="evidence_only"),unclassified=classifiedProjected.filter((row)=>row.classification==="unclassified");
  const rawLeafFields=[...rawLeafCaptured].map(([field,nonempty_count])=>{const consumer=consumerFor(field),decisionState=consumer?.verification_state==="verified_source_reference"?"decision_connected":"evidence_only";return{field,nonempty_count,...leafProjection(field),decision_state:decisionState,consumer}}),rawOnlyLeafFields=rawLeafFields.filter((row)=>row.projection_state==="raw_only"),projectedLeafFields=rawLeafFields.filter((row)=>row.projection_state==="projected"),consumerMissingFields=rawLeafFields.filter((row)=>row.consumer?.verification_state==="missing_source_reference");
  return {
    schema_version:"serp-data-coverage-audit.v5",raw_files:files.length,
    item_type_counts:Object.fromEntries(itemTypes),captured_and_projected:capturedAndProjected,captured_raw_only:capturedRawOnly,
    raw_leaf_field_summary:{field_count:rawLeafFields.length,projected_field_count:projectedLeafFields.length,raw_only_field_count:rawOnlyLeafFields.length,decision_connected_field_count:rawLeafFields.filter((row)=>row.decision_state==="decision_connected").length,evidence_only_field_count:rawLeafFields.filter((row)=>row.decision_state==="evidence_only").length,consumer_verified_field_count:rawLeafFields.filter((row)=>row.consumer?.verification_state==="verified_source_reference").length,consumer_missing_field_count:consumerMissingFields.length},raw_leaf_fields:rawLeafFields,raw_only_leaf_fields:rawOnlyLeafFields,consumer_missing_fields:consumerMissingFields,
    decision_connected:decisionConnected,evidence_only_projected:evidenceOnly,projected_but_unclassified:unclassified,projected_but_not_decision_connected:[...evidenceOnly,...unclassified],boolean_observations:[...booleanObservations.values()],
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
