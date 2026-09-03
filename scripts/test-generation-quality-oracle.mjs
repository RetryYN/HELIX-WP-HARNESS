import assert from "node:assert/strict";
import { buildGenerationQualityOracle } from "./generation-quality-oracle.mjs";

const candidates = [
  {
    candidate_id: "ready",
    group_id: "g",
    content_type: "title",
    text: "SEO 基礎ガイド",
    evidence_ids: ["e1"],
    review: {
      review_state: "ready",
      quality_score: 92,
      evidence_count: 1,
      review_digest: "r".repeat(64),
      oracle: { evidence_reference_resolved: true },
      issues: [],
    },
  },
  {
    candidate_id: "blocked",
    group_id: "g",
    content_type: "heading",
    heading_level: 3,
    text: "未支持見出し",
    review: {
      review_state: "blocked",
      quality_score: 0,
      evidence_count: 0,
      review_digest: "b".repeat(64),
      oracle: { evidence_reference_resolved: false },
      issues: ["evidence_missing"],
    },
  },
];
const oracle = buildGenerationQualityOracle({
  candidates,
  demandStabilityRows: [
    {
      candidate_id: "ready",
      demand_stability_state: "stable_observed",
      editor_review_required: false,
      stability_digest: "d".repeat(64),
    },
  ],
  competitiveStabilityRows: [
    {
      candidate_id: "ready",
      competitive_stability_state: "not_applicable",
      editor_review_required: false,
      stability_digest: "c".repeat(64),
    },
  ],
  taskHoldoutRows: [
    {
      candidate_id: "ready",
      evaluation_state: "independent_signal_improvement",
      task_independence_proven: true,
      coverage_delta: 0.12,
      evaluation_digest: "t".repeat(64),
    },
    {
      candidate_id: "blocked",
      evaluation_state: "source_lineage_unresolved",
      task_independence_proven: false,
      unresolved_evidence_ids: ["missing"],
      evaluation_digest: "u".repeat(64),
    },
  ],
  semanticReviewRows: [
    {
      candidate_id: "ready",
      review_state: "semantic_concept_observed",
      covered_concept_count: 1,
      review_concept_count: 2,
      coverage_ratio: 0.5,
      coverage_digest: "s".repeat(64),
    },
  ],
});

assert.equal(oracle.policy, "generation-quality-oracle.v1");
assert.equal(oracle.rows.length, 2);
assert.equal(oracle.summary.candidate_count, 2);
assert.equal(oracle.summary.blocked_deterministic_gate_count, 1);
assert.equal(oracle.summary.editor_review_required_count, 1);
assert.deepEqual(oracle.summary.review_state_counts, {
  blocked_deterministic_gate: 1,
  editor_review_required: 1,
});
assert.equal(oracle.summary.task_independent_count, 1);
assert.equal(oracle.summary.human_quality_proven, false);
assert.equal(oracle.summary.ranking_effect_inferred, false);
assert.equal(oracle.summary.auto_selection, false);
assert.equal(oracle.rows[0].review_state, "editor_review_required");
assert.equal(oracle.rows[0].text, "SEO 基礎ガイド");
assert.deepEqual(oracle.rows[0].evidence_ids, ["e1"]);
assert.equal(oracle.rows[0].semantic_coverage.coverage_ratio, 0.5);
assert.equal(oracle.rows[1].review_state, "blocked_deterministic_gate");
assert.deepEqual(oracle.rows[1].blocking_reasons, [
  "review:evidence_missing",
  "evidence_reference_unresolved",
  "holdout_evidence_unresolved",
]);
assert.match(oracle.oracle_digest, /^[a-f0-9]{64}$/);
assert(oracle.rows.every((row) => /^[a-f0-9]{64}$/.test(row.quality_digest)));
console.log(
  "generation quality oracle: OK (candidate-level deterministic gates, stability/semantic/holdout dimensions, human and ranking claims remain false)",
);
