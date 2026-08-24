import assert from "node:assert/strict";
import {buildLatestKeywordGroups,deriveParentCandidate,evidenceDigest} from "./keyword-grouping.mjs";

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
assert.ok(result.articleKeywordGroups.every((group)=>group.resolution_state==="resolved"&&group.derived_parent_candidate===null));

// §5: a modifier-only group with no actual parent keyword stays unresolved instead of failing the whole batch or promoting a derived value.
const orphan=buildLatestKeywordGroups([
  {source_keyword_id:"orphan",keyword:"転職 サイト おすすめ",search_volume:100,source_file_digest:"a",source_sheet:"s",source_row:1,organic_urls:urls("orphan")},
  {source_keyword_id:"other",keyword:"it 就活",search_volume:390,source_file_digest:"a",source_sheet:"s",source_row:2,organic_urls:urls("it")},
]);
const unresolved=orphan.articleKeywordGroups.find((group)=>group.resolution_state==="unresolved");
assert.ok(unresolved,"a modifier-only group without an actual parent must be kept as unresolved");
assert.equal(unresolved.main_keyword,null,"derived parent must not be promoted to main_keyword");
assert.equal(unresolved.main_keyword_origin,"derived_parent_candidate");
assert.equal(unresolved.derived_parent_candidate,"転職 サイト","only the trailing modifier is removed, one level");
assert.deepEqual(unresolved.intent_keywords,["転職 サイト おすすめ"]);
assert.equal(deriveParentCandidate("it 就活サイト おすすめ"),"it 就活サイト");
assert.equal(deriveParentCandidate("it 就活"),null);

// Absorption must consider every member's ancestor chain: here the first cluster member is itself a root with no parent,
// while the second member's actual parent lives in another cluster.
const chain=buildLatestKeywordGroups([
  {source_keyword_id:"a-root-modifier",keyword:"転職 おすすめ",search_volume:300,source_file_digest:"a",source_sheet:"s",source_row:1,organic_urls:urls("mod")},
  {source_keyword_id:"b-child-modifier",keyword:"転職 理由 面接 おすすめ",search_volume:50,source_file_digest:"a",source_sheet:"s",source_row:2,organic_urls:urls("mod")},
  {source_keyword_id:"c-actual-parent",keyword:"おすすめ 転職 理由",search_volume:200,source_file_digest:"a",source_sheet:"s",source_row:3,organic_urls:urls("reason")},
]);
assert.equal(chain.hierarchy.find((row)=>row.source_keyword_id==="a-root-modifier").parent_source_keyword_id,null);
assert.equal(chain.hierarchy.find((row)=>row.source_keyword_id==="b-child-modifier").parent_source_keyword_id,"c-actual-parent");
assert.equal(chain.articleKeywordGroups.length,1,"a modifier-only cluster is absorbed through any member's actual parent");
assert.equal(chain.articleKeywordGroups[0].main_keyword,"おすすめ 転職 理由");
assert.deepEqual(new Set(chain.articleKeywordGroups[0].intent_keywords),new Set(["転職 おすすめ","転職 理由 面接 おすすめ"]));

const digestInput={tasks:records.map((row)=>({...row,response_digest:row.source_keyword_id})),algorithm:"x",hierarchy:result.hierarchy,grouping:result.grouping,articleKeywordGroups:result.articleKeywordGroups};
assert.equal(evidenceDigest(digestInput),evidenceDigest({...digestInput,tasks:digestInput.tasks.map((row)=>({...row,organic_urls:[]}))}),"digest depends on snapshot digests and grouping, not on incidental task fields");
console.log("latest keyword grouping: OK");
