import assert from "node:assert/strict";
import {estimateBulkSiteResearchCredits,estimatePublicApiCredits,estimateSearchRankCredits,estimateSearchVolumeCredits,publicApiCreditContract} from "./public-api-credit-estimator.mjs";

assert.equal(publicApiCreditContract.accounting_unit,"provider_credit_not_usd");
assert.equal(publicApiCreditContract.usd_conversion_supported,false);
assert.deepEqual(estimateSearchVolumeCredits({keywordCount:1}),expectVolume(1,false,.03,15,true));
assert.equal(estimateSearchVolumeCredits({keywordCount:500}).estimated_credit,15);
assert.equal(estimateSearchVolumeCredits({keywordCount:501}).estimated_credit,15.03);
assert.equal(estimateSearchVolumeCredits({keywordCount:19,seoDifficulty:true}).estimated_credit,15);
assert.equal(estimateSearchVolumeCredits({keywordCount:20,seoDifficulty:true}).estimated_credit,15.6);
assert.equal(estimateSearchRankCredits({keywordCount:2,depth:30,urlCount:50}).estimated_credit,1.8);
assert.equal(estimateSearchRankCredits({keywordCount:2,depth:100,urlCount:1}).estimated_credit,6);
assert.equal(estimateSearchRankCredits({keywordCount:2,depth:100,urlCount:1}).url_count_affects_credit,false);
assert.equal(estimatePublicApiCredits({operation:"search_rank",keywordCount:1,depth:40}).estimated_credit,1.2);
assert.equal(estimateBulkSiteResearchCredits({urlCount:1}).estimated_credit,4.5);assert.equal(estimateBulkSiteResearchCredits({urlCount:10}).estimated_credit,4.5);assert.equal(estimateBulkSiteResearchCredits({urlCount:11}).estimated_credit,4.95);assert.equal(estimateBulkSiteResearchCredits({urlCount:100}).estimated_credit,45);assert.throws(()=>estimateBulkSiteResearchCredits({urlCount:101}));
for(const input of [{keywordCount:0},{keywordCount:50001},{keywordCount:1,seoDifficulty:"true"}])assert.throws(()=>estimateSearchVolumeCredits(input));
for(const input of [{keywordCount:1,depth:31},{keywordCount:1,depth:30,urlCount:51}])assert.throws(()=>estimateSearchRankCredits(input));
assert.throws(()=>estimatePublicApiCredits({operation:"unknown",keywordCount:1}));
function expectVolume(keyword_count,seo_difficulty,calculated_credit,estimated_credit,minimum_applied){return{schema_version:"public-api-credit-estimator.v1",operation_id:"SearchVolumeHistoryController_register",estimation_state:"exact_from_public_formula_for_submitted_count",keyword_count,seo_difficulty,unit_credit:seo_difficulty ? .78 : .03,calculated_credit,minimum_credit:15,estimated_credit,minimum_applied,accounting_unit:"provider_credit_not_usd",usd_cost:null,usd_conversion_supported:false,deduplication_charge_basis:"not_stated_use_submitted_count_as_ceiling",external_request_executed:false}}
console.log("public API credit estimator: OK (dynamic formulas, boundaries, provider-credit/USD separation, zero paid requests)");
