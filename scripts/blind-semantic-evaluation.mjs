import { createHash } from "node:crypto";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

// Explicit allowlist: classifier scores, strata and provisional labels must not
// enter the first-pass reviewer packet. This is not adversarial anonymization.
export function blindSemanticEvaluation(dataset) {
  const cases = dataset.cases.map((row) => ({
    case_id: digest(["blind-semantic-review.v1", row.case_id]),
    left: row.left,
    right: row.right,
    acquisition_comparison: row.acquisition_comparison,
    result_comparison: row.result_comparison,
    annotation: { label: null, rationale: null, reviewer: null, reviewed_at: null, evidence_urls: [] },
  })).sort((a, b) => a.case_id.localeCompare(b.case_id));
  const packet = {
    schema_version: "blind-semantic-evaluation.v1",
    source_dataset_digest: dataset.dataset_digest,
    review_mode: "predictions_withheld",
    sampling: "exploratory_not_population_representative",
    population_accuracy_estimable: false,
    allowed_labels: dataset.allowed_labels,
    annotation_instructions: [
      "Judge search intent, audience, task, scope and content format using the retained evidence.",
      "Record a rationale and evidence URLs; use insufficient_evidence when titles and URLs do not suffice.",
      "Do not consult classifier output or provisional labels before completing the first-pass annotation.",
      "This packet does not establish independent gold labels or population accuracy.",
    ],
    accuracy_claim: "not_evaluated",
    cases,
  };
  return { ...packet, dataset_digest: digest(packet) };
}
