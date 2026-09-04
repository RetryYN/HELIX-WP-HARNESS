import assert from "node:assert/strict";
import { buildSerpIntentFingerprints } from "./serp-intent-fingerprint.mjs";

for (const missing of [undefined, null, "", "   "]) {
  const tasks = ["a", "b"].map((task_id) => ({
    task_id, site_id: "s", group_id: task_id,
    pages: [{ rank: 1, domain: missing, page_type: missing }],
  }));
  const features = tasks.map(({ task_id }) => ({ task_id, feature_type: "organic" }));
  const demands = tasks.map(({ task_id }) => ({ task_id, demand_type: "question", value: "選び方" }));
  const result = buildSerpIntentFingerprints(tasks, { features, demands });
  assert(result.fingerprints.every((row) => Object.keys(row.domain_weights).length === 0 && Object.keys(row.page_type_weights).length === 0));
  assert(result.pairs.every((row) => row.decision !== "merge_review" && row.components.domain_similarity === 0 && row.components.page_type_similarity === 0));
  const absentGroup = buildSerpIntentFingerprints(tasks.map((row) => ({ ...row, group_id: missing, pages: [] })));
  assert.equal(absentGroup.summary.split_review_count, 0);
  assert.equal(absentGroup.pairs.length, 0);
  const similarUnknownGroups = buildSerpIntentFingerprints(tasks.map((row) => ({
    ...row, group_id: missing, pages: [{ rank: 1, domain: "example.test", page_type: "article" }],
  })), { features, demands });
  assert.equal(similarUnknownGroups.summary.merge_review_count, 0);
  assert(similarUnknownGroups.pairs.every((row) => !row.current_same_group && row.decision === "related_intent"));
  const absentTypes = buildSerpIntentFingerprints(tasks, {
    features: features.map((row) => ({ ...row, feature_type: missing })),
    demands: demands.map((row) => ({ ...row, demand_type: missing })),
  });
  assert(absentTypes.fingerprints.every((row) => row.feature_types.length === 0 && Object.keys(row.demand_type_counts).length === 0));
}
const knownSameGroup = buildSerpIntentFingerprints(["a", "b"].map((task_id) => ({ task_id, site_id: "s", group_id: "g", pages: [] })));
assert.equal(knownSameGroup.summary.split_review_count, 1);
console.log("Intent missing evidence: absent fields provide no similarity; unknown groups do not imply shared membership");
