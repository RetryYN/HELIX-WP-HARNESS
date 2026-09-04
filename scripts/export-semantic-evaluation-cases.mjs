import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import path from "node:path";

// Export review inputs, never use the current classifier as its own gold label.
const db = new DatabaseSync(path.resolve(process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite"), { readOnly: true });
try {
  const pairs = db.prepare("SELECT * FROM serp_intent_pair_reviews ORDER BY decision, intent_similarity_score, pair_digest").all();
  const strata = Map.groupBy(pairs, (row) => row.decision);
  const task = db.prepare("SELECT task_id,keyword,observed_at,snapshot_digest FROM raw_snapshot_inventory WHERE task_id=?");
  const results = db.prepare("SELECT rank_absolute,title,url FROM serp_snapshot_organic_observations WHERE task_id=? ORDER BY rank_absolute LIMIT 10");
  const evidence = (taskId) => {
    const snapshot = task.get(taskId);
    if (!snapshot) throw new Error(`Missing snapshot for ${taskId}`);
    return { ...snapshot, results: results.all(taskId) };
  };
  const cases = [...strata].flatMap(([decision, rows]) => {
    // Low, median and high scores in each decision stratum; deterministic.
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
    schema_version: "semantic-evaluation-cases.v1",
    sampling: "low_median_high_per_classifier_decision_not_representative_accuracy_sample",
    retained_pair_count: pairs.length,
    source_selection_bias: "classifier_filtered_pairs_exclude_many_low_score_cross_group_pairs_and_cap_related_pairs",
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
