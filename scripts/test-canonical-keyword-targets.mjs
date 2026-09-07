import assert from 'node:assert/strict';
import { validateCanonicalKeywordTargets } from './canonical-keyword-targets.mjs';

const source = {
  packets: [{ task_id: 't1', keyword: 'main', serp: { pages: [{ rank: 1, url: 'https://example.test/rank1' }] } }],
  plans: { plans: [{ article_candidate_id: 'a1' }, { article_candidate_id: 'a2' }] },
};
const observed = { article_candidate_id: 'a1', state: 'observed', task_id: 't1', keyword: 'main', rank1_url: 'https://example.test/rank1', reason: 'direct answer' };
const derived = { article_candidate_id: 'a2', state: 'not_observed', task_id: null, keyword: null, rank1_url: null, reason: 'derived answer artifact' };
assert.equal(validateCanonicalKeywordTargets(source, [observed, derived]).length, 2);
assert.throws(() => validateCanonicalKeywordTargets(source, [observed]), /missing/);
assert.throws(() => validateCanonicalKeywordTargets(source, [observed, { ...derived, state: 'observed', task_id: 't1', keyword: 'main', rank1_url: 'https:\/\/example.test\/rank1' }]), /multiple/);
assert.throws(() => validateCanonicalKeywordTargets(source, [{ ...observed, rank1_url: 'https://example.test/wrong' }, derived]), /does not belong/);
assert.throws(() => validateCanonicalKeywordTargets(source, [observed, { ...derived, keyword: 'borrowed' }]), /cannot claim/);
const missingRankSource = { packets: [{ task_id: 't2', keyword: 'known query', serp: { pages: [{ rank: 2, url: 'https://example.test/rank2' }] } }], plans: { plans: [{ article_candidate_id: 'a3' }] } };
assert.equal(validateCanonicalKeywordTargets(missingRankSource, [{ article_candidate_id: 'a3', state: 'query_observed_rank1_missing', task_id: 't2', keyword: 'known query', rank1_url: null, reason: 'rank one row absent' }])[0].state, 'query_observed_rank1_missing');
const redactedSource = { packets: [{ task_id: 't3', keyword: 'redacted query', serp: { pages: [{ rank: 1, url: 'https://masked.example/article' }] } }], plans: { plans: [{ article_candidate_id: 'a4' }] } };
assert.equal(validateCanonicalKeywordTargets(redactedSource, [{ article_candidate_id: 'a4', state: 'query_observed_rank1_identity_redacted', task_id: 't3', keyword: 'redacted query', rank1_url: null, reason: 'URL identity was removed' }])[0].state, 'query_observed_rank1_identity_redacted');
assert.throws(() => validateCanonicalKeywordTargets(redactedSource, [{ article_candidate_id: 'a4', state: 'observed', task_id: 't3', keyword: 'redacted query', rank1_url: 'https://masked.example/article', reason: 'invalid external target' }]), /no externally usable/);
const recoveredEvidence = [{ task_id: 't3', keyword: 'redacted query', rank1_url: 'https://real.example.com/article', recovery_state: 'recovered', raw_digest: 'a'.repeat(64) }];
assert.equal(validateCanonicalKeywordTargets(redactedSource, [{ article_candidate_id: 'a4', state: 'observed', task_id: 't3', keyword: 'redacted query', rank1_url: 'https://real.example.com/article', reason: 'live identity recovered' }], { rank1IdentityEvidence: recoveredEvidence })[0].state, 'observed');
console.log('canonical keyword targets: OK (one main query per article, no borrowed rank-1 URLs, derived articles remain unobserved)');
