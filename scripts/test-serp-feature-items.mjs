import assert from "node:assert/strict";
import {normalizeSerpFeatureItems} from "./serp-feature-items.mjs";

const actual=normalizeSerpFeatureItems([
  {feature_id:"f1",task_id:"t1",group_id:"g1",feature_type:"people_also_search",payload:{items:["関連語"]}},
  {feature_id:"f2",task_id:"t2",group_id:"g2",feature_type:"knowledge_graph",payload:{items:[{type:"knowledge_graph_description_item",text:"説明",links:[{title:"出典",url:"https://example.test",domain:"example.test"}]}]}},
  {feature_id:"f3",task_id:"t3",group_id:"g3",feature_type:"images",payload:{items:[{type:"images_element",alt:"画像説明",url:"https://page.test",image_url:"https://image.test/a.jpg"}]}},
]);
assert.equal(actual.items.length,3);assert.equal(actual.links.length,1);assert.equal(actual.items[0].text,"関連語");assert.equal(actual.items[1].text,"説明");assert.equal(actual.items[2].alt,"画像説明");assert.equal(actual.links[0].domain,"example.test");assert.ok(actual.items.every((row)=>row.feature_item_id.length===64&&row.evidence_digest.length===64));assert.ok(actual.links.every((row)=>row.link_id.length===64&&row.evidence_digest.length===64));
console.log("SERP feature items: OK (nested text/media/source links normalized with provenance)");
