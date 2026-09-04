import assert from "node:assert/strict";
import { sampleSemanticEvaluationPairs as sample } from "./sample-semantic-evaluation-pairs.mjs";
const pairs = Array.from({ length: 100 }, (_, i) => ({
  left_task_id: "source", right_task_id: `task-${i}`, decision: "not_retained", pair_digest: `d-${i}`,
}));
const options = { size: 20, seed: "pre-review-v1" };
const ids = (rows) => rows.map((row) => row.right_task_id);
const selected = sample(pairs, options);
assert.equal(selected.length, 20);
assert.equal(new Set(ids(selected)).size, 20);
assert.deepEqual(ids(selected), ids(sample([...pairs].reverse(), options)));
assert.deepEqual(ids(selected), ids(sample(pairs.map((row) => ({ ...row, decision: "merge_review", pair_digest: "changed", intent_similarity_score: 1 })), options)));
assert.notDeepEqual(ids(selected), ids(sample(pairs, { ...options, seed: "different" })));
assert.equal(sample(pairs, { ...options, size: 100 }).length, 100);
for (const size of [0, -1, 1.5, NaN, 101]) assert.throws(() => sample(pairs, { ...options, size }));
assert.throws(() => sample(pairs, { ...options, seed: "" }));
assert.throws(() => sample([pairs[0], { ...pairs[0], left_task_id: pairs[0].right_task_id, right_task_id: pairs[0].left_task_id }], { ...options, size: 1 }));
console.log("Semantic pair sampling: score-independent, repeatable, unique, full-population eligible; invalid inputs rejected");
