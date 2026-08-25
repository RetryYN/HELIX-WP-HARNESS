import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const chunk=(rows,size)=>Array.from({length:Math.ceil(rows.length/size)},(_,index)=>rows.slice(index*size,(index+1)*size));
const money=(value)=>Number(value.toFixed(6));

export const providerPricing={schema_version:"dataforseo-public-pricing.v1",observed_at:"2026-08-26",currency:"USD",prices:{google_trends_standard_task:0.0027,serp_standard_normal_base:0.0006},evidence:[
  {product:"google_trends_standard_task",url:"https://dataforseo.com/pricing/keywords-data/google-trends",billing_unit:"task with up to 5 keywords",price_usd:0.0027},
  {product:"google_news_standard_normal",url:"https://dataforseo.com/pricing/serp/google-news-serp-api",billing_unit:"base SERP at default depth",price_usd:0.0006},
  {product:"youtube_organic_standard_normal",url:"https://dataforseo.com/pricing/serp/youtube-serp-api",billing_unit:"request with default 20 results",price_usd:0.0006},
]};

export function assessProviderExecution(plan,{live=false,approvedMaxCostUsd,credentialsPresent=false,selectedCapabilities=["google_trends","google_news"]}={}){
  const selected=new Set(selectedCapabilities),jobs=Object.entries(plan.jobs).filter(([kind])=>selected.has(kind)).flatMap(([,rows])=>rows),estimated=money(jobs.reduce((sum,row)=>sum+(row.cost_usd??0),0)),unknown=jobs.filter((row)=>row.cost_usd==null).map((row)=>row.job_id),approved=Number(approvedMaxCostUsd),blockers=[];
  if(!live)blockers.push("explicit_live_flag_required");if(!credentialsPresent)blockers.push("provider_credentials_required");if(unknown.length)blockers.push("unknown_cost_blocks_execution");if(!Number.isFinite(approved)||approved<0)blockers.push("exact_approved_max_cost_required");else if(estimated>approved)blockers.push("estimated_cost_exceeds_approved_max");
  return{allowed:blockers.length===0,selected_capabilities:[...selected],job_count:jobs.length,estimated_cost_usd:estimated,approved_max_cost_usd:Number.isFinite(approved)?approved:null,unknown_cost_job_ids:unknown,blockers};
}

export function buildProviderAcquisitionPlan(keywords,{generatedAt,locationCode=2392,languageCode="ja"}={}){
  const seeds=[...new Set(keywords.map((value)=>String(value??"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ja")),trendUnit=providerPricing.prices.google_trends_standard_task,serpUnit=providerPricing.prices.serp_standard_normal_base;
  const trendJobs=chunk(seeds,5).map((batch,index)=>({job_id:`google-trends-${String(index+1).padStart(2,"0")}`,endpoint:"/v3/keywords_data/google_trends/explore/task_post",method:"standard",payload:{keywords:batch,location_code:locationCode,language_code:languageCode,time_range:"past_5_years",type:"web",item_types:["google_trends_graph","google_trends_map"]},unit_cost_usd:trendUnit,cost_usd:trendUnit}));
  const newsJobs=seeds.map((keyword,index)=>({job_id:`google-news-${String(index+1).padStart(3,"0")}`,endpoint:"/v3/serp/google/news/task_post",method:"standard",payload:{keyword,location_code:locationCode,language_code:languageCode,priority:1},unit_cost_usd:serpUnit,cost_usd:serpUnit}));
  const youtubeJobs=seeds.map((keyword,index)=>({job_id:`youtube-organic-${String(index+1).padStart(3,"0")}`,endpoint:"/v3/serp/youtube/organic/task_post",method:"standard",payload:{keyword,location_code:locationCode,language_code:languageCode,device:"desktop",priority:1},unit_cost_usd:serpUnit,cost_usd:serpUnit}));
  const executableEstimate=money([...trendJobs,...newsJobs].reduce((sum,row)=>sum+row.cost_usd,0)),proxyEstimate=money(youtubeJobs.reduce((sum,row)=>sum+row.cost_usd,0));
  const capabilities=[
    {capability:"google_trends",state:"plan_ready",job_count:trendJobs.length,estimated_cost_usd:money(trendJobs.length*trendUnit),coverage:`${seeds.length} seeds, batches of up to 5, past 5 years, graph + region map`,limitations:["topics/queries require single-keyword jobs and are excluded"]},
    {capability:"google_news",state:"plan_ready",job_count:newsJobs.length,estimated_cost_usd:money(newsJobs.length*serpUnit),coverage:"one Google News SERP task per seed",limitations:["result freshness is acquisition-time dependent"]},
    {capability:"hashtags",state:"provider_gap",job_count:youtubeJobs.length,estimated_cost_usd:proxyEstimate,coverage:"YouTube Organic can acquire videos for each seed",limitations:["YouTube SERP does not guarantee authoritative hashtag extraction","TikTok dataset/official provider is not connected","proxy jobs are excluded from executable estimate","no hashtag result may be represented as acquired"]},
    {capability:"qa_sites",state:"provider_gap",job_count:0,estimated_cost_usd:0,coverage:"existing PAA remains available",limitations:["no dedicated DataForSEO Q&A-site endpoint identified","Google operator query would be billed at the documented 5x multiplier","Yahoo!知恵袋/教えてGoo acquisition is not scheduled"]},
  ];
  const pricing={...providerPricing,evidence_digest:digest(providerPricing)};
  const plan={schema_version:"seo-provider-acquisition-plan.v2",generated_at:generatedAt,execution_state:"not_executed",approval_required:true,credentials_stored:false,cost_state:"public_price_estimate",currency:"USD",seed_count:seeds.length,location_code:locationCode,language_code:languageCode,estimated_executable_cost_usd:executableEstimate,estimated_optional_proxy_cost_usd:proxyEstimate,estimated_all_planned_jobs_cost_usd:money(executableEstimate+proxyEstimate),pricing,capabilities,jobs:{google_trends:trendJobs,google_news:newsJobs,youtube_organic_proxy:youtubeJobs},sources:[...pricing.evidence.map((row)=>row.url),"https://docs.dataforseo.com/v3/keywords-data-google-trends-explore-task_post/","https://docs.dataforseo.com/v3/serp-google-news-task_post/","https://docs.dataforseo.com/v3/serp-youtube-organic-task_post/"],policy:{automatic_execution:false,explicit_live_flag_required:true,exact_approved_max_cost_required:true,credentials_from_environment_only:true,unknown_cost_blocks_execution:true,provider_gap_is_not_acquired_data:true,account_price_snapshot_must_be_rechecked_before_execution:true}};
  return{...plan,plan_digest:digest(plan)};
}
