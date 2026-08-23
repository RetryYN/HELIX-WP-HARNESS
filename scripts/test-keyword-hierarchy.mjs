import assert from "node:assert/strict";
import {buildKeywordHierarchy} from "./keyword-hierarchy.mjs";
const tree=buildKeywordHierarchy([
  {source_keyword_id:"root",raw_keyword:"it 就活",search_volume:390},
  {source_keyword_id:"news",raw_keyword:"it ニュース 就活",search_volume:140},
  {source_keyword_id:"news-order",raw_keyword:"就活 itニュース",search_volume:20},
  {source_keyword_id:"detail",raw_keyword:"就活 気になるニュース it",search_volume:0},
]);
assert.equal(tree.find((row)=>row.source_keyword_id==="news").parent_source_keyword_id,"root");
assert.equal(tree.find((row)=>row.source_keyword_id==="news-order").relation,"reordered_alias");
assert.equal(tree.find((row)=>row.source_keyword_id==="detail").parent_source_keyword_id,"news");
assert.equal(tree.find((row)=>row.source_keyword_id==="detail").depth,2);
console.log("keyword token hierarchy: OK");
