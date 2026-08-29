const specs={
  keyword_metrics:{endpoint:"/keywords_data/google_ads/search_volume/live",limit:1000,cost_model:"per_request",request_cost_usd:.09,source:"DataProviderB Google Ads Search Volume live"},
  keyword_difficulty:{endpoint:"/data-provider-b_labs/google/bulk_keyword_difficulty/live",limit:1000,cost_model:"task_plus_returned_item",request_cost_usd:.012,item_cost_usd:.00012,source:"DataProviderB Labs Bulk Keyword Difficulty live"},
  ranked_keywords:{endpoint:"/data-provider-b_labs/google/ranked_keywords/live",limit:1000,cost_model:"task_plus_returned_item",request_cost_usd:.012,item_cost_usd:.00012,source:"DataProviderB Labs Ranked Keywords live"},
};
const round=(value)=>Number(value.toFixed(6));
const chunks=(values,size)=>Array.from({length:Math.ceil(values.length/size)},(_,index)=>values.slice(index*size,(index+1)*size));
export function buildDataProviderBEnrichmentPlan({siteId,keywords,target,locationCode=2392,languageCode="ja"}){
  const uniqueKeywords=[...new Set(keywords.map((value)=>String(value).trim()).filter(Boolean))];
  if(!siteId)throw new Error("site identity is required");if(!uniqueKeywords.length)throw new Error("at least one keyword is required");if(!target)throw new Error("target domain is required");
  for(const keyword of uniqueKeywords)if(keyword.length>80||keyword.split(/\s+/u).length>10)throw new Error(`keyword exceeds provider limit: ${keyword}`);
  const jobs=[];
  for(const [index,batch] of chunks(uniqueKeywords,specs.keyword_metrics.limit).entries())jobs.push({job_id:`keyword_metrics:${index+1}`,kind:"keyword_metrics",endpoint:specs.keyword_metrics.endpoint,payload:[{keywords:batch,location_code:locationCode,language_code:languageCode}],input_count:batch.length,maximum_result_count:batch.length,estimated_max_usd:specs.keyword_metrics.request_cost_usd});
  for(const [index,batch] of chunks(uniqueKeywords,specs.keyword_difficulty.limit).entries())jobs.push({job_id:`keyword_difficulty:${index+1}`,kind:"keyword_difficulty",endpoint:specs.keyword_difficulty.endpoint,payload:[{keywords:batch,location_code:locationCode,language_code:languageCode}],input_count:batch.length,maximum_result_count:batch.length,estimated_max_usd:round(specs.keyword_difficulty.request_cost_usd+batch.length*specs.keyword_difficulty.item_cost_usd)});
  jobs.push({job_id:"ranked_keywords:1",kind:"ranked_keywords",endpoint:specs.ranked_keywords.endpoint,payload:[{target,location_code:locationCode,language_code:languageCode,limit:1000,include_clickstream_data:false,load_rank_absolute:true,historical_serp_mode:"live"}],input_count:1,maximum_result_count:1000,estimated_max_usd:round(specs.ranked_keywords.request_cost_usd+1000*specs.ranked_keywords.item_cost_usd)});
  return{schema_version:"data-provider-b-enrichment-plan.v2",site_id:siteId,provider:"DataProviderB",location_code:locationCode,language_code:languageCode,target,keyword_count:uniqueKeywords.length,pricing_basis:{captured_on:"2026-08-26",specs},jobs,estimated_max_usd:round(jobs.reduce((sum,job)=>sum+job.estimated_max_usd,0)),execution_guard:"live requires explicit WP_DATA_PROVIDER_B_ENRICHMENT_LIVE=1, selected jobs, account price snapshot and a sufficient cost ceiling"};
}

export function selectDataProviderBEnrichmentJobs(plan,kinds){const wanted=new Set(kinds);const jobs=plan.jobs.filter((job)=>wanted.has(job.kind));if(!jobs.length)throw new Error("no acquisition jobs selected");return{...plan,jobs,estimated_max_usd:round(jobs.reduce((sum,job)=>sum+job.estimated_max_usd,0))}}
