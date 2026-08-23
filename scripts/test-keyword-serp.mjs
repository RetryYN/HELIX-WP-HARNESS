import assert from "node:assert/strict";
import { checkKeywordCoverage, groupBySerp, normalizeKeyword } from "./keyword-serp-core.mjs";

assert.equal(normalizeKeyword("  ＳＥＯ　記事  "), "seo 記事");
assert.equal(normalizeKeyword("Web\tライティング\n副業"), "web ライティング 副業");

const records = [
  { source_keyword_id: "a", organic_urls: ["https://a.test/1", "https://b.test/2", "https://c.test/3", "https://d.test/4", "https://e.test/5"] },
  { source_keyword_id: "b", organic_urls: ["https://a.test/1", "https://b.test/2", "https://c.test/3", "https://d.test/4", "https://e.test/5"] },
  { source_keyword_id: "c", organic_urls: ["https://a.test/1", "https://b.test/2", "https://c.test/3", "https://d.test/4", "https://z.test/5"] },
];
const first = groupBySerp(records, { threshold: 0.8, comparisonDepth: 5 });
const second = groupBySerp(records, { threshold: 0.8, comparisonDepth: 5 });
assert.deepEqual(first, second);
assert.deepEqual(first.clusters, [["a", "b"], ["c"]]);
assert.equal(first.pairs.find((pair) => pair.left === "a" && pair.right === "b").ratio, 1);
assert.equal(first.pairs.find((pair) => pair.left === "a" && pair.right === "c").likely_same_intent, false);
assert.deepEqual(checkKeywordCoverage("IT就活サイトの選び方。", { main_keyword: "it 就活 サイト", sub_keywords: ["IT 就活サイト"] }).missing, []);
assert.deepEqual(checkKeywordCoverage("IT就活サイトの選び方。", { main_keyword: "it 就活 サイト", sub_keywords: ["比較"] }).missing, ["比較"]);
console.log("keyword SERP core: OK");
