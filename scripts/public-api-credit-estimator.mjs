const roundCredits=(value)=>Math.round((value+Number.EPSILON)*100)/100;
const integer=(value,label,min,max)=>{const parsed=Number(value);if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw new TypeError(`${label} must be an integer from ${min} to ${max}`);return parsed};

export const publicApiCreditContract=Object.freeze({
  schema_version:"public-api-credit-estimator.v1",
  accounting_unit:"provider_credit_not_usd",
  usd_conversion_supported:false,
  paid_request_executed:false,
  source:"retained official OpenAPI 3.1.1 operation descriptions",
  formulas:{
    search_volume:{operation_id:"SearchVolumeHistoryController_register",base_per_keyword:0.03,seo_difficulty_per_keyword:0.75,minimum_per_request:15,max_keywords:50000},
    search_rank:{operation_id:"SearchRankHistoryController_register",top_30_per_keyword:0.9,additional_10_ranks_per_keyword:0.3,allowed_depths:[30,40,50,60,70,80,90,100]}
    ,bulk_site_research:{operation_id:"BulkSiteResearchController_searchBulkSiteResearch",per_url:0.45,minimum_per_request:4.5,max_urls:100}
  }
});

export function estimateSearchVolumeCredits({keywordCount,seoDifficulty=false}={}){
  const count=integer(keywordCount,"keywordCount",1,publicApiCreditContract.formulas.search_volume.max_keywords);
  if(typeof seoDifficulty!=="boolean")throw new TypeError("seoDifficulty must be boolean");
  const unit=0.03+(seoDifficulty?0.75:0),calculated=roundCredits(count*unit),credits=Math.max(15,calculated);
  return{schema_version:publicApiCreditContract.schema_version,operation_id:"SearchVolumeHistoryController_register",estimation_state:"exact_from_public_formula_for_submitted_count",keyword_count:count,seo_difficulty:seoDifficulty,unit_credit:unit,calculated_credit:calculated,minimum_credit:15,estimated_credit:credits,minimum_applied:credits>calculated,accounting_unit:"provider_credit_not_usd",usd_cost:null,usd_conversion_supported:false,deduplication_charge_basis:"not_stated_use_submitted_count_as_ceiling",external_request_executed:false};
}

export function estimateSearchRankCredits({keywordCount,depth=30,urlCount}={}){
  const count=integer(keywordCount,"keywordCount",1,Number.MAX_SAFE_INTEGER),rankDepth=integer(depth,"depth",30,100);
  if(!publicApiCreditContract.formulas.search_rank.allowed_depths.includes(rankDepth))throw new TypeError("depth must be one of 30, 40, 50, 60, 70, 80, 90, 100");
  const urls=urlCount==null?null:integer(urlCount,"urlCount",1,50),additionalSteps=(rankDepth-30)/10,unit=roundCredits(0.9+additionalSteps*0.3);
  return{schema_version:publicApiCreditContract.schema_version,operation_id:"SearchRankHistoryController_register",estimation_state:"exact_from_public_formula_for_submitted_count_and_depth",keyword_count:count,depth:rankDepth,url_count:urls,unit_credit:unit,estimated_credit:roundCredits(count*unit),accounting_unit:"provider_credit_not_usd",usd_cost:null,usd_conversion_supported:false,url_count_affects_credit:false,url_charge_basis:"not_in_public_formula",search_volume_and_difficulty_surcharge:"not_stated_in_public_formula",external_request_executed:false};
}

export function estimateBulkSiteResearchCredits({urlCount}={}){
  const count=integer(urlCount,"urlCount",1,100),calculated=roundCredits(count*.45),credits=Math.max(4.5,calculated);
  return{schema_version:publicApiCreditContract.schema_version,operation_id:"BulkSiteResearchController_searchBulkSiteResearch",estimation_state:"exact_from_public_formula_for_submitted_url_count",url_count:count,unit_credit:.45,calculated_credit:calculated,minimum_credit:4.5,estimated_credit:credits,minimum_applied:credits>calculated,accounting_unit:"provider_credit_not_usd",usd_cost:null,usd_conversion_supported:false,external_request_executed:false};
}

export function estimatePublicApiCredits({operation,keywordCount,seoDifficulty=false,depth=30,urlCount}={}){
  if(operation==="search_volume")return estimateSearchVolumeCredits({keywordCount,seoDifficulty});
  if(operation==="search_rank")return estimateSearchRankCredits({keywordCount,depth,urlCount});
  if(operation==="bulk_site_research")return estimateBulkSiteResearchCredits({urlCount});
  throw new TypeError("operation must be search_volume, search_rank, or bulk_site_research");
}
