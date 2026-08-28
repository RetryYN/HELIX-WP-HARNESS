import assert from "node:assert/strict";
import {buildSerpBrandAnalysis} from "./serp-brand-analysis.mjs";

const result=buildSerpBrandAnalysis([{id:"g1",task_ids:["t1","t2"]},{id:"g2",task_ids:["t3"]}],[
  {task_id:"t1",rank_absolute:1,domain:"brand.test",website_name:"ブランド"},{task_id:"t2",rank_absolute:4,domain:"sub.brand.test",website_name:"ブランド"},
  {task_id:"t3",rank_absolute:2,domain:"www.youtube.com",website_name:"YouTube · 公式チャンネル"},{task_id:"t1",rank_absolute:8,domain:"www.youtube.com",website_name:"YouTube · 別チャンネル"},
]);
assert.equal(result.summary.brand_count,3);assert.equal(result.summary.multi_domain_brand_count,1);assert.equal(result.summary.platform_publisher_count,2);assert.equal(result.summary.domain_name_variation_count,0);
const brand=result.brands.find((row)=>row.website_name==="ブランド");assert.equal(brand.task_count,2);assert.equal(brand.domain_count,2);assert.equal(brand.multi_domain_review,true);assert.equal(brand.best_rank,1);assert.equal(brand.evidence_digest.length,64);
const youtube=result.domains.find((row)=>row.domain==="www.youtube.com");assert.equal(youtube.identity_kind,"publisher_platform");assert.equal(youtube.website_name_count,2);assert.equal(youtube.name_variation_review,false);
console.log("SERP brand analysis: OK (display brand occupancy, platform publishers, multi-domain and name-variation review)");
