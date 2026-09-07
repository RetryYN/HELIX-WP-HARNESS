import assert from 'node:assert/strict';
import { buildSemanticEditorialBriefs } from './semantic-editorial-brief.mjs';

const obs = (id, text) => ({ evidence_id: id, kind: 'paa', text, source_keyword: 'main', observed_at: '2026-01-01T00:00:00Z', snapshot_digest: id });
const interpretation = (id, evidenceIds) => ({ id, task_id: 't1', evidence_ids: evidenceIds });
const section = (problemId, interpretationIds, evidenceIds) => ({ problem_id: problemId, reader_condition: 'reader', question_to_resolve: 'question', answer_scope: 'scope', expected_reader_outcomes: ['outcome'], recall_methods: [{ method: 'method', expected_material: 'material', evidence_ids: evidenceIds }], source_task_ids: ['t1'], interpretation_ids: interpretationIds, prerequisites: [], evidence: [{ evidence_ids: evidenceIds }], heading_text: null });
const source = {
  packets: [{ task_id: 't1', keyword: 'main', demand_observations: [obs('e1', 'own'), obs('e2', 'other'), obs('e3', 'unassigned'), obs('e4', 'unknown'), obs('e5', 'supplement'), obs('e6', 'exclude')] }],
  story: { interpretations: [interpretation('i1', ['e1', 'e5', 'e6']), interpretation('i2', ['e2']), interpretation('i3', ['e3'])], problem_clusters: [{ id: 'p1', interpretation_ids: ['i1'] }, { id: 'p2', interpretation_ids: ['i2'] }, { id: 'p3', interpretation_ids: ['i3'] }] },
  routing: { story_digest: 'story', unassigned_problem_ids: ['p3'] },
  plans: { plans: [{ article_candidate_id: 'a1', sections: [section('p1', ['i1'], ['e1', 'e5', 'e6'])], related_questions: [], unresolved_routes: [] }, { article_candidate_id: 'a2', sections: [section('p2', ['i2'], ['e2'])], related_questions: [], unresolved_routes: [] }] },
};
const canonicalKeywordTargets = [{ article_candidate_id: 'a1', state: 'observed', task_id: 't1', keyword: 'main', rank1_url: 'https://example.test/rank1', reason: 'direct answer' }, { article_candidate_id: 'a2', state: 'not_observed', task_id: null, keyword: null, rank1_url: null, reason: 'derived answer artifact' }];
const result = buildSemanticEditorialBriefs(source, { canonicalKeywordTargets, decisions: [{ article_candidate_id: 'a1', evidence_id: 'e5', disposition: 'body_supplement', reason: 'supports the answer without needing its own section' }, { evidence_id: 'e6', disposition: 'exclude', reason: 'opposite reader and purpose' }, { article_candidate_id: 'a1', evidence_id: 'e3', disposition: 'separate_article', target_article_candidate_ids: ['a3'], reason: 'different answer artifact' }] });
const a1 = result.briefs.find((row) => row.article_candidate_id === 'a1');
assert.equal(a1.keyword_ledger.find((row) => row.evidence_id === 'e1').disposition, 'main_argument');
assert.equal(a1.keyword_ledger.find((row) => row.evidence_id === 'e2').disposition, 'separate_article');
assert.equal(a1.keyword_ledger.find((row) => row.evidence_id === 'e3').disposition, 'separate_article');
assert.deepEqual(a1.keyword_ledger.find((row) => row.evidence_id === 'e3').target_article_candidate_ids, ['a3']);
assert.equal(a1.keyword_ledger.find((row) => row.evidence_id === 'e3').target_resolution, 'proposed_or_unassigned');
assert.equal(a1.keyword_ledger.find((row) => row.evidence_id === 'e4').disposition, 'hold');
assert.equal(a1.keyword_ledger.find((row) => row.evidence_id === 'e5').disposition, 'body_supplement');
assert.equal(a1.keyword_ledger.find((row) => row.evidence_id === 'e6').disposition, 'exclude');
assert.equal(a1.outline[0].heading_copy_state, 'not_generated');
assert.equal(a1.rank1_page_comparison.state, 'pending_exact_page_ranked_keywords');
assert.equal(a1.main_keyword, 'main');
assert.equal(a1.design_gate, 'blocked');
assert.throws(() => buildSemanticEditorialBriefs(source, { decisions: [{ article_candidate_id: 'a1', evidence_id: 'e5', disposition: 'exclude' }] }), /requires reason/);
console.log('semantic editorial brief: OK (five-way decisions, evidence lineage, outline requirements, exact-page gate)');
