import assert from "node:assert/strict";
import {buildLatestKeywordGroups} from "./keyword-grouping.mjs";

const urls=(prefix)=>Array.from({length:5},(_,index)=>`https://${prefix}.example/${index}`);
const records=[
  {source_keyword_id:"general",keyword:"就活",search_volume:10000,source_file_digest:"a",source_sheet:"s",source_row:1,organic_urls:urls("shared")},
  {source_keyword_id:"it",keyword:"it 就活",search_volume:390,source_file_digest:"a",source_sheet:"s",source_row:2,organic_urls:urls("shared")},
  {source_keyword_id:"it-order",keyword:"就活it",search_volume:90,source_file_digest:"a",source_sheet:"s",source_row:3,organic_urls:urls("shared")},
  {source_keyword_id:"it-recommend",keyword:"it 就活 おすすめ",search_volume:1000,source_file_digest:"a",source_sheet:"s",source_row:4,organic_urls:urls("recommend")},
];
const result=buildLatestKeywordGroups(records);
assert.equal(result.articleKeywordGroups.length,2,"different context roots must remain separate, while a modifier-only child is absorbed into its actual parent action");
const itGroup=result.articleKeywordGroups.find((group)=>group.main_keyword==="it 就活");
assert.deepEqual(new Set(itGroup.intent_keywords),new Set(["就活it","it 就活 おすすめ"]));
assert.equal(result.articleKeywordGroups.some((group)=>group.main_keyword.endsWith("おすすめ")),false,"a modifier keyword must never become main");
assert.equal(result.grouping.pairs.some((pair)=>pair.same_context===false&&pair.likely_same_intent),false,"SERP overlap must not merge context roots");
console.log("latest keyword grouping: OK");
