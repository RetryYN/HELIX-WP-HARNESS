import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyRoutingQuerySerpReview } from './verify-routing-query-serp-review.mjs';

const bytes = (value) => Buffer.from(JSON.stringify(value));
const wrapped = (value) => ({ value, digest: crypto.createHash('sha256').update(bytes(value)).digest('hex') });
const manifest = wrapped({
  schema_version: 'routing-query-serp-acquisition.v2', total_candidates: 2,
  results: [
    { query_id: 'q1', article_candidate_id: 'a1', unit_id: 'u1', query_to_test: 'alpha', raw_digest: 'r1', rank1_url: 'https://example.test/a', state: 'rank1_observed' },
    { query_id: 'q2', article_candidate_id: 'a1', unit_id: 'u2', query_to_test: 'alpha detail', raw_digest: 'r2', rank1_url: 'https://example.test/a', state: 'rank1_observed' },
  ],
});
const routing = wrapped({ candidates: [{ article_candidate_id: 'a1', unit_reviews: [
  { unit_id: 'u1', query_to_test: 'alpha' }, { unit_id: 'u2', query_to_test: 'alpha detail' },
] }] });
const packet = wrapped({ schema_version: 'routing-query-serp-review-packet.v1', candidates: [{ article_candidate_id: 'a1', queries: manifest.value.results }] });
const baseReview = {
  schema_version: 'routing-query-serp-review-aggregate.v1', manifest_digest: manifest.digest, routing_review_digest: routing.digest, packet_digests: [packet.digest],
  candidates: [{ article_candidate_id: 'a1', query_reviews: [
    { query_id: 'q1', unit_id: 'u1', intent_state: 'same_answer_artifact', decision: 'canonical_query', article_cluster_id: 'c1', canonical_query_id: 'q1', rationale: 'primary observed demand' },
    { query_id: 'q2', unit_id: 'u2', intent_state: 'same_answer_artifact', decision: 'supporting_query', article_cluster_id: 'c1', canonical_query_id: 'q1', rationale: 'same answer artifact' },
  ], cluster_reviews: [{ article_cluster_id: 'c1', canonical_query_id: 'q1', member_query_ids: ['q1', 'q2'], reader_problem: 'reader problem', answer_artifact: 'one answer', rationale: 'complete-link match' }] }],
};
const verify = (review = baseReview, manifestInput = manifest) => verifyRoutingQuerySerpReview(manifestInput, routing, [packet], review);
assert.equal(verify().summary.accepted_article_clusters, 1);
assert.equal(verify().summary.shared_rank1_urls, 1);

const rejects = (message, mutate, manifestInput = manifest) => {
  const value = structuredClone(baseReview); mutate(value);
  assert.throws(() => verify(value, manifestInput), message);
};
rejects(/different intent must be rejected/, (value) => { value.candidates[0].query_reviews[1].intent_state = 'different_intent'; });
rejects(/exactly one canonical/, (value) => { value.candidates[0].query_reviews[1].decision = 'canonical_query'; });
rejects(/review must cover every observed query/, (value) => { value.candidates[0].query_reviews.pop(); });
rejects(/member cluster mismatch/, (value) => { value.candidates[0].query_reviews[1].article_cluster_id = 'borrowed'; });
rejects(/manifest digest mismatch/, (value) => { value.manifest_digest = 'wrong'; });
const duplicated = wrapped({ ...manifest.value, results: [manifest.value.results[0], { ...manifest.value.results[1], query_to_test: ' ALPHA ' }] });
assert.throws(() => verify(baseReview, duplicated), /manifest digest mismatch|normalized query duplicate/);
console.log('routing query SERP review verifier tests passed');
