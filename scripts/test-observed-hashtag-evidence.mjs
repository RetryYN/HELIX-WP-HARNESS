import assert from "node:assert/strict";
import { buildObservedHashtagEvidence, classifyObservedHashtag, extractObservedHashtags } from "./observed-hashtag-evidence.mjs";

assert.deepEqual(extractObservedHashtags("＃IT就活 #案件情報全開示#案件選択制。"), [
  { hashtag: "#IT就活", normalized_tag: "#it就活", offset: 0 },
  { hashtag: "#案件情報全開示", normalized_tag: "#案件情報全開示", offset: 6 },
  { hashtag: "#案件選択制", normalized_tag: "#案件選択制", offset: 14 },
]);
assert.equal(classifyObservedHashtag("#年休125日"), "job_attribute_marker_observed");
assert.equal(classifyObservedHashtag("#Twitter就活"), "social_or_topic_observed");
assert.equal(classifyObservedHashtag("#案件情報全開示"), "ambiguous_marker_review");

const built = buildObservedHashtagEvidence([
  { site_id: "site-a", source_kind: "serp_title", source_id: "task:1", field_name: "title", observed_text: "#IT就活 #年休125日", task_id: "task", group_id: "group", url: "https://example.test/a", source_digest: "a".repeat(64) },
  { site_id: "site-a", source_kind: "competitor_heading", source_id: "page:1", field_name: "heading", observed_text: "#IT就活", page_id: "page", group_id: "group", url: "https://example.test/b", source_digest: "b".repeat(64) },
]);
assert.equal(built.occurrences.length, 3);
assert.equal(built.rows.length, 2);
assert.equal(built.rows.find((row) => row.normalized_tag === "#it就活").occurrence_count, 2);
assert(built.rows.every((row) => row.review_required && !row.popularity_inferred && !row.trend_inferred && !row.search_volume_inferred && !row.auto_content_use && row.evidence_digest.length === 64));
console.log("observed hashtag evidence: OK (Unicode/adjacent extraction, conservative classification, no popularity inference)");
