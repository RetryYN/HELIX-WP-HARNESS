import assert from "node:assert/strict";
import {buildSerpActionSignals} from "./serp-action-signals.mjs";

const signals=buildSerpActionSignals({tasks:[{task_id:"visual",group_id:"g1",keyword:"髪型",spell:null},{task_id:"book",group_id:"g2",keyword:"本",spell:{keyword:"書籍",type:"including_results_for"}},{task_id:"plain",group_id:"g3",keyword:"一般",spell:null}],features:[{feature_id:"visual:images:0",task_id:"visual",feature_type:"images",rank_absolute:3}],featureItems:[{feature_id:"visual:images:0",feature_item_id:"item1",feature_type:"images",item_type:"images_element",alt:"就活向けの髪型例",url:"https://image-source.test",links:[]}],organicResults:[{task_id:"book",rank_absolute:2,price:{current:1000},rating:{value:4.5}},{task_id:"book",rank_absolute:4,price:null,rating:null},{task_id:"plain",rank_absolute:1,attributes:{is_video:1}}]});
assert.equal(signals.length,3);
const visual=signals.find((row)=>row.task_id==="visual"),book=signals.find((row)=>row.task_id==="book"),video=signals.find((row)=>row.task_id==="plain");
assert.deepEqual(visual.signal_types,["visual"]);assert.ok(visual.recommended_formats.includes("original_images"));assert.equal(visual.evidence[0].evidence_id,"visual:images:0");assert.equal(visual.evidence[1].evidence_type,"serp_feature_item");assert.ok(visual.heading_guidance.some((value)=>value.includes("就活向けの髪型例")));
assert.deepEqual(book.signal_types,["commercial","spelling"]);assert.equal(book.corrected_keyword,"書籍");assert.equal(book.priced_result_count,1);assert.equal(book.rated_result_count,1);assert.ok(book.heading_guidance.some((value)=>value.includes("評価方法")));assert.equal(book.evidence_digest.length,64);
assert.deepEqual(video.signal_types,["video"]);assert.equal(video.video_result_count,1);assert.equal(video.evidence[0].evidence_type,"organic_result_attribute");assert.ok(video.recommended_formats.includes("transcript"));
assert.ok(signals.every((row)=>row.status==="proposed"&&row.evidence.length>0));
console.log("SERP action signals: OK (evidence-bound format, commercial, video and spelling guidance)");
