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
console.log('canonical keyword targets: OK (one main query per article, no borrowed rank-1 URLs, derived articles remain unobserved)');
