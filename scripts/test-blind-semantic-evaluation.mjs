import assert from "node:assert/strict";
import { blindSemanticEvaluation } from "./blind-semantic-evaluation.mjs";

const source = {
  dataset_digest: "source-digest",
  strata: { merge_review: 2 },
  allowed_labels: ["same_article", "separate_articles", "related_only", "insufficient_evidence"],
  cases: ["b", "a"].map((case_id) => ({
    case_id,
    left: { keyword: "検証", results: [] },
    right: { keyword: "確認", results: [] },
    acquisition_comparison: { semantic_equivalence_proven: false },
    classifier_prediction: { decision: "merge_review", score: 0.9 },
    provisional_label: "same_article",
    annotation: { label: "same_article", reviewer: "prior-reviewer" },
  })),
};
const packet = blindSemanticEvaluation(source);
assert.equal(packet.cases.length, 2);
assert.equal(packet.review_mode, "predictions_withheld");
assert.equal(packet.population_accuracy_estimable, false);
assert.equal(packet.accuracy_claim, "not_evaluated");
for (const row of packet.cases) {
  assert.equal(row.classifier_prediction, undefined);
  assert.equal(row.provisional_label, undefined);
  assert.equal(row.annotation.label, null);
  assert.equal(row.annotation.reviewer, null);
  assert.deepEqual(row.left, source.cases[0].left);
  assert.match(row.case_id, /^[a-f0-9]{64}$/);
}
assert.equal(packet.strata, undefined);
assert.deepEqual(packet, blindSemanticEvaluation({ ...source, cases: [...source.cases].reverse() }));
assert.equal(source.cases[0].annotation.label, "same_article");
assert.match(packet.dataset_digest, /^[a-f0-9]{64}$/);
console.log("Blind semantic evaluation: predictions, strata, prior labels withheld; evidence retained; deterministic case order");
