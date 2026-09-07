import assert from 'node:assert/strict';
import { projectTargetDemandLedger } from './project-target-demand-ledger.mjs';

const source = {
  plans: { plans: [
    { article_candidate_id: 'article', sections: [
      { problem_id: 'p1', reader_condition: 'reader', question_to_resolve: 'question', answer_scope: 'answer', source_task_ids: ['main', 'support'], evidence: [{ evidence_ids: ['e-main', 'e-support'] }] },
    ] },
    { article_candidate_id: 'derived', sections: [
      { problem_id: 'p2', reader_condition: 'reader', question_to_resolve: 'other question', answer_scope: 'other answer', source_task_ids: ['main'], evidence: [{ evidence_ids: ['e-main'] }] },
    ] },
  ] },
  packets: [
    { task_id: 'main', keyword: 'main query', demand_observations: [{ evidence_id: 'e-main', kind: 'paa', text: 'question', observed_at: 'now', snapshot_digest: 'a', recursion_depth: 1 }] },
    { task_id: 'support', keyword: 'support query', demand_observations: [{ evidence_id: 'e-support', kind: 'related_search', text: 'related', observed_at: 'now', snapshot_digest: 'b', recursion_depth: 1 }] },
  ],
};
const targets = { assignments: [
  { article_candidate_id: 'article', state: 'observed', task_id: 'main', keyword: 'main query', rank1_url: 'rank1' },
  { article_candidate_id: 'derived', state: 'not_observed' },
] };
const result = projectTargetDemandLedger(source, targets, { source_digest: 's', canonical_targets_digest: 't' });
assert.deepEqual(result.summary, { candidates: 2, observed_candidates: 1, unobserved_candidates: 1, meaning_units: 2, target_demand_contexts: 3, reviewed_candidates: 0 });
assert.equal(result.candidates[0].target_demands.length, 2);
assert.deepEqual(result.candidates[0].target_demands[1].cited_by_unit_ids, ['p1']);
assert.equal(result.candidates[1].canonical_keyword, null);
assert.equal(result.candidates[1].target_demands[0].review_state, 'review_required');

const borrowed = structuredClone(targets);
borrowed.assignments[0].task_id = 'outside';
assert.throws(() => projectTargetDemandLedger(source, borrowed));

const missingEvidence = structuredClone(source);
missingEvidence.plans.plans[0].sections[0].evidence[0].evidence_ids.push('unknown');
const separated = projectTargetDemandLedger(missingEvidence, targets);
assert.deepEqual(separated.candidates[0].meaning_units[0].demand_evidence_ids, ['e-main', 'e-support']);
assert.deepEqual(separated.candidates[0].meaning_units[0].other_evidence_ids, ['unknown']);

console.log('target demand ledger projection: OK');
