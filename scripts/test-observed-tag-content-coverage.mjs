import assert from "node:assert/strict";
import { buildObservedTagContentCoverage } from "./observed-tag-content-coverage.mjs";

const tags = [
  { site_id: "s", hashtag: "#IT就活", normalized_tag: "#it就活", classification: "social_or_topic_observed", occurrence_count: 3, group_ids: ["g1"], evidence_digest: "a".repeat(64) },
  { site_id: "s", hashtag: "#年休125日", normalized_tag: "#年休125日", classification: "job_attribute_marker_observed", occurrence_count: 2, group_ids: ["g1"], evidence_digest: "b".repeat(64) },
  { site_id: "s", hashtag: "#謎語", normalized_tag: "#謎語", classification: "ambiguous_marker_review", occurrence_count: 1, group_ids: ["g2"], evidence_digest: "c".repeat(64) },
];
const groups = [{ id: "g1", site_id: "s", wp_article_id: 1 }, { id: "g2", site_id: "s", wp_article_id: null }];
const articles = [{ site_id: "s", wp_article_id: 1, url: "https://example.test/a", title: "IT就活ガイド", headings: [{ position: 2, text: "#IT就活 の準備" }] }];
const built = buildObservedTagContentCoverage(tags, groups, articles, { siteId: "s" });
assert.equal(built.summary.decision_count, 3);
assert.equal(built.summary.exact_marker_covered_count, 1);
assert.equal(built.summary.lexical_term_covered_count, 1);
assert.equal(built.rows.find((row) => row.normalized_tag === "#年休125日").review_action, "verify_claim_before_consideration");
assert.equal(built.rows.find((row) => row.normalized_tag === "#謎語").review_action, "classify_before_consideration");
assert(built.rows.every((row) => !row.popularity_inferred && !row.ranking_effect_inferred && !row.auto_content_use && row.coverage_digest.length === 64));
console.log("observed tag content coverage: OK (article title/heading reverse lookup, claim/classification gates, no auto use)");
