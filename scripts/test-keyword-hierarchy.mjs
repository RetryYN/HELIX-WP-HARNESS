import assert from "node:assert/strict";
import {buildKeywordHierarchy} from "./keyword-hierarchy.mjs";
const tree=buildKeywordHierarchy([
  {source_keyword_id:"general",raw_keyword:"就活",search_volume:10000},
  {source_keyword_id:"root",raw_keyword:"it 就活",search_volume:390},
  {source_keyword_id:"news",raw_keyword:"it ニュース 就活",search_volume:140},
  {source_keyword_id:"news-order",raw_keyword:"就活 itニュース",search_volume:20},
  {source_keyword_id:"detail",raw_keyword:"就活 気になるニュース it",search_volume:0},
]);
const tieTree=buildKeywordHierarchy([{source_keyword_id:"tie",raw_keyword:"就活ねくたい",search_volume:8100}]);
assert.deepEqual(tieTree[0].normalized_terms,["就活","ネクタイ"]);assert.equal(tieTree[0].term_count,2);
assert.equal(tree.find((row)=>row.source_keyword_id==="news").parent_source_keyword_id,"root");
assert.equal(tree.find((row)=>row.source_keyword_id==="root").parent_source_keyword_id,"general","display tree has a single lexical root");
assert.equal(tree.find((row)=>row.source_keyword_id==="root").context_scope_id,"context:it","SERP scope remains separate from the display root");
assert.equal(tree.find((row)=>row.source_keyword_id==="general").context_scope_id,"context:general");
assert.equal(tree.find((row)=>row.source_keyword_id==="general").relation,"root");
assert.equal(tree.find((row)=>row.source_keyword_id==="news-order").relation,"reordered_alias");
assert.equal(tree.find((row)=>row.source_keyword_id==="news-order").root_source_keyword_id,"general","an alias must inherit the representative concept root");
assert.equal(tree.find((row)=>row.source_keyword_id==="detail").parent_source_keyword_id,"news");
assert.equal(tree.find((row)=>row.source_keyword_id==="detail").depth,tree.find((row)=>row.source_keyword_id==="detail").tree_path.length-1,"depth includes derived trie nodes");
const modifierTree=buildKeywordHierarchy([
  {source_keyword_id:"base",raw_keyword:"it 就活",search_volume:390},
  {source_keyword_id:"modifier-parent",raw_keyword:"it 就活 ランキング",search_volume:100},
  {source_keyword_id:"child",raw_keyword:"it 就活人気ランキング",search_volume:50},
]);
assert.equal(modifierTree.find((row)=>row.source_keyword_id==="child").parent_source_keyword_id,"base","a modifier keyword must not become a hierarchy parent");
const compounds=buildKeywordHierarchy([
  {source_keyword_id:"difficulty",raw_keyword:"it 就活難易度",search_volume:10},
  {source_keyword_id:"score",raw_keyword:"it 就活 偏差値",search_volume:10},
  {source_keyword_id:"future",raw_keyword:"就活 5年後の自分 it",search_volume:10},
]);
assert.deepEqual(compounds.find((row)=>row.source_keyword_id==="difficulty").normalized_terms,["it","就活","難易度"]);
assert.deepEqual(compounds.find((row)=>row.source_keyword_id==="score").normalized_terms,["it","就活","偏差値"]);
assert.ok(compounds.find((row)=>row.source_keyword_id==="future").normalized_terms.includes("5年後"));
console.log("keyword token hierarchy: OK");
