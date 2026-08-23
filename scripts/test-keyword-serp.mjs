import assert from "node:assert/strict";
import { checkKeywordCoverage, groupBySerp, normalizeKeyword } from "./keyword-serp-core.mjs";

assert.equal(normalizeKeyword("  ＳＥＯ　記事  "), "seo 記事");
assert.equal(normalizeKeyword("Web\tライティング\n副業"), "web ライティング 副業");

const records = [
  { source_keyword_id: "a", organic_urls: ["https://a.test/1", "https://b.test/2", "https://c.test/3", "https://d.test/4", "https://e.test/5"] },
  { source_keyword_id: "b", organic_urls: ["https://a.test/1", "https://b.test/2", "https://c.test/3", "https://d.test/4", "https://e.test/5"] },
  { source_keyword_id: "c", organic_urls: ["https://a.test/1", "https://b.test/2", "https://c.test/3", "https://y.test/4", "https://z.test/5"] },
  { source_keyword_id: "d", organic_urls: ["https://v.test/1", "https://w.test/2", "https://x.test/3", "https://y.test/4", "https://z.test/5"] },
];
const first = groupBySerp(records, { highThreshold: 0.8, possibleThreshold: 0.6, comparisonDepth: 5 });
const second = groupBySerp(records, { highThreshold: 0.8, possibleThreshold: 0.6, comparisonDepth: 5 });
assert.deepEqual(first, second);
const scoped=groupBySerp(records.slice(0,2),{scopeById:new Map([[records[0].source_keyword_id,"general"],[records[1].source_keyword_id,"it"]])});
assert.equal(scoped.pairs[0].intent_confidence,"context_separate");
assert.equal(scoped.pairs[0].likely_same_intent,false,"SERP overlap must not cross a context root");
assert.deepEqual(first.clusters, [["a", "b", "c"], ["d"]]);
assert.equal(first.pairs.find((pair) => pair.left === "a" && pair.right === "b").ratio, 1);
assert.equal(first.pairs.find((pair) => pair.left === "a" && pair.right === "c").intent_confidence, "possible");
assert.equal(first.possible_pairs.length, 2);
assert.equal(first.pairs.find((pair) => pair.left === "a" && pair.right === "d").likely_same_intent, false);
assert.equal(first.pairs.find((pair) => pair.left === "a" && pair.right === "b").intent_confidence, "high");
assert.deepEqual(checkKeywordCoverage("IT就活サイトの選び方。", { main_keyword: "it 就活 サイト", sub_keywords: ["IT 就活サイト"] }).missing, []);
assert.deepEqual(checkKeywordCoverage("IT就活サイトの選び方。", { main_keyword: "it 就活 サイト", sub_keywords: ["比較"] }).missing, ["比較"]);
const bridge = groupBySerp([
  { source_keyword_id: "x", organic_urls: ["https://a/", "https://b/", "https://c/", "https://d/", "https://e/"] },
  { source_keyword_id: "y", organic_urls: ["https://a/", "https://b/", "https://c/", "https://f/", "https://g/"] },
  { source_keyword_id: "z", organic_urls: ["https://a/", "https://f/", "https://g/", "https://h/", "https://i/"] },
], { highThreshold: 0.8, possibleThreshold: 0.6, comparisonDepth: 5 });
assert.equal(bridge.clusters.some((cluster) => cluster.length === 3), false, "60% bridge must not transitively merge a 20% pair");
console.log("keyword SERP core: OK");
