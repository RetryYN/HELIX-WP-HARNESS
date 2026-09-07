import assert from 'node:assert/strict';
import { verifyTwoSidedReview } from './verify-two-sided-semantic-review.mjs';

const ledger = { digest: 'ledger', value: { candidates: [{
  article_candidate_id: 'a', observation_state: 'observed',
  meaning_units: [
    { unit_id: 'd', question_to_resolve: 'demand question' },
    { unit_id: 'e', question_to_resolve: 'editorial method' },
  ],
  target_demands: [{ evidence_id: 't', text: 'observed demand' }],
}] } };
const keywordSource = { digest: 'keywords', value: { candidates: [{ article_candidate_id: 'a', pages: [{ keyword_reviews: [{ keyword: 'ranked query', keyword_digest: 'k' }] }] }] } };
const headingSource = { digest: 'headings', value: { candidates: [{ article_candidate_id: 'a', observation_state: 'reviewed', target_digest: 'page', heading_reviews: [{ position: 1, text: 'answer' }] }] } };
const base = {
  schema_version: 'two-sided-semantic-review-aggregate.v1',
  target_demand_ledger_digest: 'ledger', acquired_keyword_review_digest: 'keywords', heading_review_digest: 'headings',
  candidates: [{
    article_candidate_id: 'a',
    unit_reviews: [
      { unit_id: 'd', layer: 'demand', demand_core: 'answer demand', editorial_requirements: [], supporting_target_evidence_ids: ['t'], rationale: 'observed directly' },
      { unit_id: 'e', layer: 'editorial', demand_core: null, editorial_requirements: ['verification method'], supporting_target_evidence_ids: [], rationale: 'author method' },
    ],
    target_demand_reviews: [{ evidence_id: 't', material: true, disposition: 'body', matched_unit_ids: ['d'], rationale: 'same answer' }],
    acquired_keyword_reviews: [{ keyword_id: 'k', text: 'ranked query', material: true, relation: 'common', matched_unit_ids: ['d'], rationale: 'same demand' }],
    heading_reviews: [{ heading_id: 'page:1', position: 1, classification: 'partial', matched_unit_ids: ['d'], rationale: 'answers demand' }],
    transitions: [], false_merges: [],
  }],
};
const result = verifyTwoSidedReview(ledger, keywordSource, headingSource, base);
assert.equal(result.summary.passed_candidates, 1);
assert.equal(result.summary.demand_units, 1);
assert.equal(result.summary.editorial_requirements, 1);

const missingDemand = structuredClone(base); missingDemand.candidates[0].target_demand_reviews = [];
assert.throws(() => verifyTwoSidedReview(ledger, keywordSource, headingSource, missingDemand));
const badLink = structuredClone(base); badLink.candidates[0].target_demand_reviews[0].disposition = 'internal_link';
assert.throws(() => verifyTwoSidedReview(ledger, keywordSource, headingSource, badLink));
const missingBackReference = structuredClone(base); missingBackReference.candidates[0].unit_reviews[0].supporting_target_evidence_ids = [];
assert.throws(() => verifyTwoSidedReview(ledger, keywordSource, headingSource, missingBackReference));
const editorialCitation = structuredClone(base); editorialCitation.candidates[0].heading_reviews[0].matched_unit_ids = ['e'];
assert.throws(() => verifyTwoSidedReview(ledger, keywordSource, headingSource, editorialCitation));
const falseMerge = structuredClone(base); falseMerge.candidates[0].false_merges = [{ unit_id: 'd', evidence_ids: ['t'], kind: 'unresolved', rationale: 'still merged' }];
assert.equal(verifyTwoSidedReview(ledger, keywordSource, headingSource, falseMerge).summary.passed_candidates, 0);
const rejectedMerge = structuredClone(base); rejectedMerge.candidates[0].false_merges = [{ unit_id: 'd', evidence_ids: ['t'], kind: 'rejected_demand_entailment', rationale: 'removed from accepted mapping' }];
assert.equal(verifyTwoSidedReview(ledger, keywordSource, headingSource, rejectedMerge).summary.passed_candidates, 1);
assert.equal(verifyTwoSidedReview(ledger, keywordSource, headingSource, rejectedMerge).summary.rejected_false_merges, 1);
console.log('two-sided semantic review verification: OK');
