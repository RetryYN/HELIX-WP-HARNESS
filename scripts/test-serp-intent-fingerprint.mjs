import assert from "node:assert/strict";
import "./test-serp-intent-missing-evidence.mjs";
import "./test-blind-semantic-evaluation.mjs";
import "./test-sample-semantic-evaluation-pairs.mjs";
import "./test-compare-semantic-review-results.mjs";
import "./test-blind-semantic-review-form.mjs";
import {buildSerpIntentFingerprints} from "./serp-intent-fingerprint.mjs";

const tasks=[{task_id:"a",group_id:"g1",site_id:"s",keyword:"IT企業",recommended_page_type:"article",pages:[{rank:1,domain:"a.test",page_type:"article"},{rank:2,domain:"b.test",page_type:"database"}]},{task_id:"b",group_id:"g2",site_id:"s",keyword:"IT会社",recommended_page_type:"article",pages:[{rank:1,domain:"a.test",page_type:"article"},{rank:2,domain:"b.test",page_type:"database"}]},{task_id:"c",group_id:"g1",site_id:"s",keyword:"面接",recommended_page_type:"video",pages:[{rank:1,domain:"video.test",page_type:"video"}]}];
const features=[{task_id:"a",feature_type:"people_also_ask"},{task_id:"b",feature_type:"people_also_ask"},{task_id:"c",feature_type:"video"}],demands=[{task_id:"a",demand_type:"paa",value:"IT企業とは"},{task_id:"b",demand_type:"paa",value:"IT企業とは"},{task_id:"c",demand_type:"related_search",value:"面接動画"}];
const result=buildSerpIntentFingerprints(tasks,{features,demands});assert.equal(result.fingerprints.length,3);const merge=result.pairs.find((row)=>row.left_task_id==="a"&&row.right_task_id==="b"),split=result.pairs.find((row)=>row.left_task_id==="a"&&row.right_task_id==="c");assert.equal(merge.decision,"merge_review");assert.equal(merge.review_required,true);assert.ok(merge.intent_similarity_score>.999);assert.equal(split.decision,"split_review");assert.equal(split.review_required,true);assert.equal(split.intent_similarity_score,0);assert.equal(result.summary.merge_review_count,1);assert.equal(result.summary.split_review_count,1);assert.ok(result.fingerprints.every((row)=>row.fingerprint_digest.length===64));assert.ok(result.pairs.every((row)=>row.pair_digest.length===64&&!row.auto_mutation));
console.log("SERP intent fingerprint: OK (domain/page/feature/demand similarity, merge/split review, no auto mutation)");
