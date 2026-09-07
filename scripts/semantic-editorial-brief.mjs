import { createHash } from 'node:crypto';

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unique = (values) => [...new Set(values.filter(Boolean))];

export function buildSemanticEditorialBriefs(source, { decisions = [], rankedKeywordEvidence = [] } = {}) {
  const observations = new Map(source.packets.flatMap((packet) => packet.demand_observations.map((row) => [row.evidence_id, { ...row, task_id: packet.task_id }])));
  const packetByTask = new Map(source.packets.map((packet) => [packet.task_id, packet]));
  const interpretationById = new Map(source.story.interpretations.map((row) => [row.id, row]));
  const planByInterpretation = new Map(source.plans.plans.flatMap((plan) => plan.sections.flatMap((section) => section.interpretation_ids.map((id) => [id, plan.article_candidate_id]))));
  const problemByInterpretation = new Map(source.story.problem_clusters.flatMap((problem) => problem.interpretation_ids.map((id) => [id, problem.id])));
  const unassigned = new Set(source.routing.unassigned_problem_ids);
  const explicit = new Map(decisions.map((row) => [`${row.article_candidate_id}:${row.evidence_id}`, row]));
  const rankedByCandidate = new Map(rankedKeywordEvidence.map((row) => [row.article_candidate_id, row]));

  const briefs = source.plans.plans.map((plan) => {
    const taskIds = unique(plan.sections.flatMap((section) => section.source_task_ids));
    const ownInterpretations = new Set(plan.sections.flatMap((section) => section.interpretation_ids));
    const evidenceToInterpretations = new Map();
    for (const interpretation of source.story.interpretations) {
      for (const evidenceId of interpretation.evidence_ids) {
        const rows = evidenceToInterpretations.get(evidenceId) ?? [];
        rows.push(interpretation.id);
        evidenceToInterpretations.set(evidenceId, rows);
      }
    }
    const candidateObservations = unique(taskIds.flatMap((taskId) => packetByTask.get(taskId)?.demand_observations.map((row) => row.evidence_id) ?? []));
    const ledger = candidateObservations.map((evidenceId) => {
      const observation = observations.get(evidenceId);
      const interpretationIds = evidenceToInterpretations.get(evidenceId) ?? [];
      const own = interpretationIds.filter((id) => ownInterpretations.has(id));
      const otherCandidates = unique(interpretationIds.map((id) => planByInterpretation.get(id)).filter((id) => id && id !== plan.article_candidate_id));
      const isUnassigned = interpretationIds.some((id) => unassigned.has(problemByInterpretation.get(id)));
      const override = explicit.get(`${plan.article_candidate_id}:${evidenceId}`);
      let disposition;
      let reason;
      if (override) {
        if (!['main_argument', 'body_supplement', 'separate_article', 'exclude', 'hold'].includes(override.disposition)) throw new Error(`invalid disposition: ${override.disposition}`);
        if (!override.reason) throw new Error(`explicit decision requires reason: ${evidenceId}`);
        disposition = override.disposition;
        reason = override.reason;
      } else if (own.length) {
        disposition = 'main_argument';
        reason = 'The observed demand supports a meaning unit assigned to this article.';
      } else if (otherCandidates.length) {
        disposition = 'separate_article';
        reason = 'The observed demand resolves to a different answer artifact.';
      } else {
        disposition = 'hold';
        reason = isUnassigned ? 'The meaning unit has no approved article assignment.' : 'No evidence-backed meaning assignment exists; exclusion is not inferred.';
      }
      return {
        evidence_id: evidenceId,
        keyword_or_question: observation.text,
        evidence_kind: observation.kind,
        source_keyword: observation.source_keyword,
        observed_at: observation.observed_at,
        snapshot_digest: observation.snapshot_digest,
        interpretation_ids: interpretationIds,
        disposition,
        decision_reason: reason,
        target_article_candidate_ids: disposition === 'separate_article' ? otherCandidates : [],
        decision_state: override ? 'explicit_editorial_decision' : 'evidence_projection',
      };
    });
    const outline = plan.sections.map((section, index) => ({
      level: 2,
      order: index + 1,
      heading_text: section.heading_text,
      heading_copy_state: section.heading_text ? 'provided' : 'not_generated',
      heading_intent: section.expected_reader_outcomes,
      question_to_answer: section.question_to_resolve,
      reader_condition: section.reader_condition,
      answer_scope: section.answer_scope,
      required_explanations: section.recall_methods.map((row) => ({ method: row.method, expected_material: row.expected_material, evidence_ids: row.evidence_ids })),
      supporting_demands: ledger.filter((row) => section.evidence.some((item) => item.evidence_ids.includes(row.evidence_id))).map((row) => row.evidence_id),
      prerequisites: section.prerequisites,
    }));
    const ranked = rankedByCandidate.get(plan.article_candidate_id);
    const exactCorpus = Boolean(ranked?.complete_exact_page_corpus);
    const benchmark = {
      state: exactCorpus ? 'ready_for_semantic_conjunction' : 'pending_exact_page_ranked_keywords',
      rank1_url: ranked?.rank1_url ?? null,
      acquired_keyword_count: ranked?.keywords?.length ?? 0,
      complete_exact_page_corpus: exactCorpus,
      semantic_agreement: null,
      note: exactCorpus ? 'Corpus is present, but semantic agreement still requires classification.' : 'Seed-query ranks and heading overlap do not substitute for the complete URL-level ranked-keyword corpus.',
    };
    const base = {
      article_candidate_id: plan.article_candidate_id,
      main_keywords: unique(taskIds.map((taskId) => packetByTask.get(taskId)?.keyword)),
      target_readers: unique(plan.sections.map((section) => section.reader_condition)),
      answer_scopes: unique(plan.sections.map((section) => section.answer_scope)),
      keyword_ledger: ledger,
      disposition_counts: Object.fromEntries(['main_argument', 'body_supplement', 'separate_article', 'exclude', 'hold'].map((state) => [state, ledger.filter((row) => row.disposition === state).length])),
      rank1_page_comparison: benchmark,
      outline,
      internal_link_questions: plan.related_questions,
      unresolved_routes: plan.unresolved_routes,
      copywriting_state: outline.every((section) => section.heading_text) ? 'generated_unreviewed' : 'not_generated',
      design_gate: ledger.some((row) => row.disposition === 'hold') || !exactCorpus || outline.some((section) => !section.heading_text) ? 'blocked' : 'ready_for_independent_review',
      non_claims: ['A heading plan does not prove body-answer quality.', 'Rank-1 semantic agreement is a minimum gate, not a ranking guarantee.', 'Editorial transitions are hypotheses unless separately observed.'],
    };
    return { ...base, brief_digest: digest(base) };
  });
  const base = {
    schema_version: 'semantic-editorial-briefs.v1',
    source_story_digest: source.routing.story_digest,
    article_candidate_count: briefs.length,
    ready_for_independent_review_count: briefs.filter((row) => row.design_gate === 'ready_for_independent_review').length,
    pending_exact_page_corpus_count: briefs.filter((row) => !row.rank1_page_comparison.complete_exact_page_corpus).length,
    held_demand_count: briefs.reduce((sum, row) => sum + row.disposition_counts.hold, 0),
    briefs,
  };
  return { ...base, output_digest: digest(base) };
}
