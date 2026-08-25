import assert from "node:assert/strict";
import {buildDfsEnrichmentPlan,selectDfsEnrichmentJobs} from "./dfs-enrichment-plan.mjs";
const keywords=Array.from({length:100},(_,index)=>`kw ${index}`),plan=buildDfsEnrichmentPlan({keywords,target:"it-shukatu.com"});
assert.equal(plan.keyword_count,100);assert.equal(plan.jobs.length,3);assert.equal(plan.estimated_max_usd,.246);assert.equal(plan.jobs[0].estimated_max_usd,.09);assert.equal(plan.jobs[1].estimated_max_usd,.024);assert.equal(plan.jobs[2].estimated_max_usd,.132);assert.equal(plan.jobs[2].payload[0].include_clickstream_data,false);
const keywordOnly=selectDfsEnrichmentJobs(plan,["keyword_metrics","keyword_difficulty"]);assert.equal(keywordOnly.jobs.length,2);assert.equal(keywordOnly.estimated_max_usd,.114);
assert.throws(()=>buildDfsEnrichmentPlan({keywords:["x ".repeat(11)],target:"x.example"}),/provider limit/);assert.throws(()=>selectDfsEnrichmentJobs(plan,["unknown"]),/no acquisition jobs/);
console.log("DFS enrichment plan: OK (official limits, cost ceiling and explicit job selection)");
