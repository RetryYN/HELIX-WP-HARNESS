import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import path from "node:path";

// Export review inputs, never use the current classifier as its own gold label.
const db = new DatabaseSync(path.resolve(process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite"), { readOnly: true });
try {
  const pairs = db.prepare("SELECT * FROM serp_intent_pair_reviews ORDER BY decision, intent_similarity_score, pair_digest").all();
  const retainedPairCount = pairs.length;
  const pairKey = (left, right) => JSON.stringify([left, right].sort());
  const retainedKeys = new Set(pairs.map((row) => pairKey(row.left_task_id, row.right_task_id)));
  const tasks = db.prepare("SELECT task_id,site_id FROM serp_intent_fingerprints ORDER BY site_id,task_id").all();
  let populationPairCount = 0;
  for (let i = 0; i < tasks.length; i += 1) {
    for (let j = i + 1; j < tasks.length; j += 1) {
      const left = tasks[i], right = tasks[j];
      if (left.site_id !== right.site_id) continue;
      populationPairCount += 1;
      const key = pairKey(left.task_id, right.task_id);
      if (retainedKeys.has(key)) continue;
      pairs.push({
        left_task_id: left.task_id,
        right_task_id: right.task_id,
        pair_digest: createHash("sha256").update(key).digest("hex"),
        decision: "not_retained",
        intent_similarity_score: null,
        components_json: "null",
        policy: "prediction_unavailable_not_a_separate_article_label",
      });
    }
  }
  if (pairs.length !== populationPairCount) throw new Error("Pair population mismatch");
  const strata = Map.groupBy(pairs, (row) => row.decision);
  const task = db.prepare("SELECT task_id,keyword,observed_at,snapshot_digest FROM raw_snapshot_inventory WHERE task_id=?");
  const results = db.prepare("SELECT rank_absolute,title,url FROM serp_snapshot_organic_observations WHERE task_id=? ORDER BY rank_absolute LIMIT 10");
  const evidence = (taskId) => {
    const snapshot = task.get(taskId);
    if (!snapshot) throw new Error(`Missing snapshot for ${taskId}`);
    return { ...snapshot, results: results.all(taskId) };
  };
  const cases = [...strata].flatMap(([decision, rows]) => {
    // Unretained rows have no score: use hash order, not an invented prediction.
    if (decision === "not_retained") rows.sort((a, b) => a.pair_digest.localeCompare(b.pair_digest));
    const indices = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
    return indices.map((index) => {
      const row = rows[index];
      return {
        case_id: row.pair_digest,
        left: evidence(row.left_task_id),
        right: evidence(row.right_task_id),
        classifier_prediction: { decision, score: row.intent_similarity_score, components: JSON.parse(row.components_json), policy: row.policy },
        annotation: { label: null, rationale: null, reviewer: null, reviewed_at: null, evidence_urls: [] },
      };
    });
  });
  const output = {
    schema_version: "semantic-evaluation-cases.v2",
    sampling: "score_extremes_and_median_for_retained_decisions_hash_positions_for_unretained",
    retained_pair_count: retainedPairCount,
    population_pair_count: populationPairCount,
    source_selection_bias: "all_same_site_fingerprint_pairs_enumerated_but_cases_are_exploratory_not_random",
    population_accuracy_estimable: false,
    strata: Object.fromEntries([...strata].map(([key, rows]) => [key, rows.length])),
    allowed_labels: ["same_article", "separate_articles", "related_only", "insufficient_evidence"],
    annotation_instructions: [
      "Review the two search intents and retained results before inspecting classifier_prediction.",
      "Record audience, task, scope and content-format differences in rationale.",
      "A shared URL, current group or classifier prediction is not a gold label.",
      "SERP titles and URLs alone may be insufficient; use insufficient_evidence when needed.",
      "Keep connected keyword/task pairs in the same partition before tuning or evaluating.",
    ],
    accuracy_claim: "not_evaluated",
    cases,
  };
  output.dataset_digest = createHash("sha256").update(JSON.stringify(output)).digest("hex");
  console.log(JSON.stringify(output, null, 2));
} finally {
  db.close();
}
