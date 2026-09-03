import { createHash } from "node:crypto";

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const byCandidate = (rows = []) =>
  new Map(rows.map((row) => [row.candidate_id, row]));

const normalizedState = (value, fallback) =>
  value == null || value === "" ? fallback : value;

/**
 * Combine independent deterministic checks into one candidate-level review
 * record. This is a diagnostic oracle, not a model-quality or ranking oracle.
 */
export function buildGenerationQualityOracle({
  candidates = [],
  demandStabilityRows = [],
  competitiveStabilityRows = [],
  taskHoldoutRows = [],
  semanticReviewRows = [],
} = {}) {
  const demandByCandidate = byCandidate(demandStabilityRows);
  const competitiveByCandidate = byCandidate(competitiveStabilityRows);
  const holdoutByCandidate = byCandidate(taskHoldoutRows);
  const semanticByCandidate = byCandidate(semanticReviewRows);
  const rows = candidates.map((candidate) => {
    const review = candidate.review ?? {};
    const demand = demandByCandidate.get(candidate.candidate_id);
    const competitive = competitiveByCandidate.get(candidate.candidate_id);
    const holdout = holdoutByCandidate.get(candidate.candidate_id);
    const semantic = semanticByCandidate.get(candidate.candidate_id);
    const blockingReasons = [];
    if (!review.review_digest) blockingReasons.push("deterministic_review_missing");
    if (review.review_state === "blocked")
      blockingReasons.push(...(review.issues ?? []).map((issue) => `review:${issue}`));
    if (review.oracle?.evidence_reference_resolved !== true)
      blockingReasons.push("evidence_reference_unresolved");
    if (holdout?.source_holdout_overlap_task_ids?.length)
      blockingReasons.push("task_holdout_leakage");
    if (holdout?.unresolved_evidence_ids?.length)
      blockingReasons.push("holdout_evidence_unresolved");
    if (semantic?.review_state === "no_graph_evidence")
      blockingReasons.push("semantic_graph_evidence_missing");
    const base = {
      candidate_id: candidate.candidate_id,
      group_id: candidate.group_id,
      content_type: candidate.content_type,
      heading_level: candidate.heading_level ?? null,
      text: candidate.text ?? null,
      evidence_type: candidate.evidence_type ?? null,
      evidence_ids: [...(candidate.evidence_ids ?? [])],
      candidate_digest: candidate.candidate_digest ?? null,
      generation: candidate.generation
        ? {
            generator_kind: candidate.generation.generator_kind ?? null,
            generator_version: candidate.generation.generator_version ?? null,
            input_digest: candidate.generation.input_digest ?? null,
          }
        : null,
      deterministic_review: {
        state: normalizedState(review.review_state, "missing"),
        quality_score: review.quality_score ?? null,
        evidence_count: review.evidence_count ?? null,
        evidence_reference_resolved:
          review.oracle?.evidence_reference_resolved ?? false,
        issue_codes: [...(review.issues ?? [])],
        review_digest: review.review_digest ?? null,
      },
      demand_stability: {
        state: normalizedState(
          demand?.demand_stability_state,
          "not_available",
        ),
        editor_review_required: demand?.editor_review_required ?? null,
        evidence_digest: demand?.stability_digest ?? null,
      },
      competitive_stability: {
        state: normalizedState(
          competitive?.competitive_stability_state,
          "not_available",
        ),
        editor_review_required: competitive?.editor_review_required ?? null,
        evidence_digest: competitive?.stability_digest ?? null,
      },
      task_holdout: {
        state: normalizedState(holdout?.evaluation_state, "not_evaluable"),
        independent: holdout?.task_independence_proven ?? false,
        coverage_delta: holdout?.coverage_delta ?? null,
        evaluation_digest: holdout?.evaluation_digest ?? null,
      },
      temporal_holdout: {
        state: normalizedState(
          holdout?.temporal_evaluation_state,
          "not_evaluable",
        ),
        independent: holdout?.temporal_independence_proven ?? false,
        coverage_delta: holdout?.temporal_coverage_delta ?? null,
      },
      semantic_coverage: {
        state: normalizedState(semantic?.review_state, "not_available"),
        covered_concept_count: semantic?.covered_concept_count ?? null,
        review_concept_count: semantic?.review_concept_count ?? null,
        coverage_ratio: semantic?.coverage_ratio ?? null,
        coverage_digest: semantic?.coverage_digest ?? null,
      },
      blocking_reasons: [...new Set(blockingReasons)],
      review_state: blockingReasons.length
        ? "blocked_deterministic_gate"
        : "editor_review_required",
      human_quality_proven: false,
      ranking_effect_inferred: false,
      auto_selection: false,
      auto_content_mutation: false,
      policy: "generation-quality-oracle.v1",
    };
    return { ...base, quality_digest: digest(base) };
  });
  const countStates = (field) =>
    Object.fromEntries(
      Object.entries(Object.groupBy(rows, (row) => row[field])).map(
        ([state, items]) => [state, items.length],
      ),
    );
  const base = {
    policy: "generation-quality-oracle.v1",
    candidate_count: rows.length,
    blocked_deterministic_gate_count: rows.filter(
      (row) => row.review_state === "blocked_deterministic_gate",
    ).length,
    editor_review_required_count: rows.filter(
      (row) => row.review_state === "editor_review_required",
    ).length,
    evidence_reference_resolved_count: rows.filter(
      (row) => row.deterministic_review.evidence_reference_resolved,
    ).length,
    task_independent_count: rows.filter(
      (row) => row.task_holdout.independent,
    ).length,
    temporal_independent_count: rows.filter(
      (row) => row.temporal_holdout.independent,
    ).length,
    human_quality_proven: false,
    ranking_effect_inferred: false,
    auto_selection: false,
    auto_content_mutation: false,
    review_state_counts: countStates("review_state"),
    demand_state_counts: Object.fromEntries(
      Object.entries(
        Object.groupBy(rows, (row) => row.demand_stability.state),
      ).map(([state, items]) => [state, items.length]),
    ),
    competitive_state_counts: Object.fromEntries(
      Object.entries(
        Object.groupBy(rows, (row) => row.competitive_stability.state),
      ).map(([state, items]) => [state, items.length]),
    ),
    task_holdout_state_counts: Object.fromEntries(
      Object.entries(Object.groupBy(rows, (row) => row.task_holdout.state)).map(
        ([state, items]) => [state, items.length],
      ),
    ),
    semantic_state_counts: Object.fromEntries(
      Object.entries(
        Object.groupBy(rows, (row) => row.semantic_coverage.state),
      ).map(([state, items]) => [state, items.length]),
    ),
    rows,
  };
  const { rows: _rows, ...summary } = base;
  return { ...summary, summary, rows, oracle_digest: digest(base) };
}
