import assert from 'node:assert/strict';
import { verifyUnobservedCandidateRouting } from './verify-unobserved-candidate-routing.mjs';
const ledger = { digest: 'l', value: { candidates: [
  { article_candidate_id: 'existing', observation_state: 'observed', canonical_keyword: 'existing query' },
  { article_candidate_id: 'new', observation_state: 'canonical_query_not_observed', meaning_units: [{ unit_id: 'u', demand_evidence_ids: ['e'] }], target_demands: [{ evidence_id: 'e', text: 'observed question' }] },
] } };
const observed = { digest: 'o', value: {} };
const base = { schema_version: 'unobserved-candidate-routing-review-aggregate.v1', target_demand_ledger_digest: 'l', observed_review_digest: 'o', candidates: [{ article_candidate_id: 'new', candidate_disposition: 'promote', candidate_rationale: 'distinct answer', unit_reviews: [{ unit_id: 'u', disposition: 'promote_query_candidate', target_article_candidate_id: null, query_to_test: 'observed question', evidence_ids: ['e'], rationale: 'direct observed demand' }] }] };
const result = verifyUnobservedCandidateRouting(ledger, observed, base);
assert.equal(result.summary.query_candidates_to_test, 1);
assert.equal(result.summary.promotion_queries_to_test, 1);
assert.equal(result.summary.canonical_query_observed_after_review, 0);
const borrowed = structuredClone(base); borrowed.candidates[0].unit_reviews[0].target_article_candidate_id = 'existing'; assert.throws(() => verifyUnobservedCandidateRouting(ledger, observed, borrowed));
const invented = structuredClone(base); invented.candidates[0].unit_reviews[0].query_to_test = 'invented query'; assert.throws(() => verifyUnobservedCandidateRouting(ledger, observed, invented));
const merge = structuredClone(base); merge.candidates[0].candidate_disposition = 'retire_to_existing'; merge.candidates[0].unit_reviews[0] = { unit_id: 'u', disposition: 'merge_into_article', target_article_candidate_id: 'existing', query_to_test: null, evidence_ids: ['e'], rationale: 'same reader problem outcome and scope' }; assert.equal(verifyUnobservedCandidateRouting(ledger, observed, merge).summary.candidate_dispositions.retire_to_existing, 1);
const link = structuredClone(base); link.candidates[0].candidate_disposition = 'hold'; link.candidates[0].unit_reviews[0] = { unit_id: 'u', disposition: 'internal_link', target_article_candidate_id: null, query_to_test: 'observed question', evidence_ids: ['e'], rationale: 'distinct related answer' }; assert.equal(verifyUnobservedCandidateRouting(ledger, observed, link).summary.internal_link_queries_to_test, 1);
const badHold = structuredClone(base); badHold.candidates[0].candidate_disposition = 'hold'; badHold.candidates[0].unit_reviews[0] = { unit_id: 'u', disposition: 'hold', target_article_candidate_id: null, query_to_test: null, evidence_ids: [], rationale: '' }; assert.throws(() => verifyUnobservedCandidateRouting(ledger, observed, badHold));
const duplicateLedger = structuredClone(ledger); duplicateLedger.value.candidates.push({ article_candidate_id: 'new2', observation_state: 'canonical_query_not_observed', meaning_units: [{ unit_id: 'u2', demand_evidence_ids: ['e2'] }], target_demands: [{ evidence_id: 'e2', text: 'ＯＢＳＥＲＶＥＤ　ＱＵＥＳＴＩＯＮ' }] });
const duplicateReview = structuredClone(base); duplicateReview.candidates.push({ article_candidate_id: 'new2', candidate_disposition: 'promote', candidate_rationale: 'distinct answer', unit_reviews: [{ unit_id: 'u2', disposition: 'promote_query_candidate', target_article_candidate_id: null, query_to_test: 'ＯＢＳＥＲＶＥＤ　ＱＵＥＳＴＩＯＮ', evidence_ids: ['e2'], rationale: 'direct observed demand' }] });
assert.throws(() => verifyUnobservedCandidateRouting(duplicateLedger, observed, duplicateReview));
console.log('unobserved candidate routing verification: OK');
