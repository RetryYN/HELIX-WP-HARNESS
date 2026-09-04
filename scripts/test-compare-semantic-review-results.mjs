import assert from "node:assert/strict";
import { compareSemanticReviewResults as compare } from "./compare-semantic-review-results.mjs";
const rows = (...urls) => urls.map((url) => ({ url }));
const result = compare(rows("https://example.test/shared", "https://example.test/left", "https://example.test/shared", null), rows("https://example.test/shared", "https://example.test/right"));
assert.equal(result.left_distinct_url_count, 2);
assert.equal(result.right_distinct_url_count, 2);
assert.deepEqual(result.shared_urls, ["https://example.test/shared"]);
assert.deepEqual(result.left_only_urls, ["https://example.test/left"]);
assert.deepEqual(result.right_only_urls, ["https://example.test/right"]);
assert.equal(result.url_jaccard, 1 / 3);
assert.equal(result.semantic_equivalence_proven, false);
assert.equal(result.article_merge_recommended, false);
assert.equal(compare(rows("https://example.test/a"), rows("https://example.test/b")).url_jaccard, 0);
assert.equal(compare(rows("https://example.test/a#one"), rows("https://example.test/a#two")).url_jaccard, 0);
for (const absent of [[], rows(null, undefined, "", "relative", "javascript:alert(1)")]) {
  assert.equal(compare(absent, rows("https://example.test/a")).url_jaccard, null);
  assert.equal(compare(absent, []).evidence_state, "insufficient_url_evidence");
}
console.log("Semantic review result comparison: exact URL overlap, unique evidence, missing-data distinction; no merge inference");
