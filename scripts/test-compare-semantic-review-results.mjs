import assert from "node:assert/strict";
import { compareSemanticReviewResults as compare } from "./compare-semantic-review-results.mjs";
const rows = (...urls) => urls.map((url) => ({ url }));
for(const placeholder of ["https://example.test/<redacted-user>/n/<redacted-post>","https://example.test/%3Credacted-post%3E","https://example.test/%3CREDACTED_USER%3E?bad=%XX"]){
  const redacted=compare(rows(placeholder),rows(placeholder));
  assert.deepEqual(redacted.shared_urls,[]);
  assert.equal(redacted.url_jaccard,null);
  assert.equal(redacted.left_redacted_url_count,1);
  assert.equal(redacted.right_redacted_url_count,1);
  assert.equal(redacted.evidence_state,"insufficient_url_evidence");
}
const partial=compare(rows("https://example.test/shared","https://example.test/<redacted-post>"),rows("https://example.test/shared","https://example.test/<redacted-post>"));
assert.deepEqual(partial.shared_urls,["https://example.test/shared"]);
assert.equal(partial.evidence_state,"partial_url_identity");
assert.equal(partial.url_jaccard_scope,"identifiable_retained_urls_only");
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
