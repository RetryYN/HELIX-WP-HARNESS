import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (file) => { const bytes = fs.readFileSync(file); return { bytes, value: JSON.parse(bytes) }; };
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const unique = (rows, key, label) => {
  const result = new Map();
  for (const row of rows ?? []) {
    assert(typeof row?.[key] === 'string' && row[key], `${label} requires ${key}`);
    assert(!result.has(row[key]), `duplicate ${label}: ${row[key]}`);
    result.set(row[key], row);
  }
  return result;
};
const counts = (rows, key, states) => Object.fromEntries(states.map((state) => [state, rows.filter((row) => row[key] === state).length]));
const normalizeQuery = (value) => value.normalize('NFKC').toLocaleLowerCase('ja').trim().replace(/\s+/g, ' ');

export function verifyRoutingQuerySerpReview(manifest, routing, packets, review) {
  assert.equal(manifest.value.schema_version, 'routing-query-serp-acquisition.v2');
  assert.equal(review.schema_version, 'routing-query-serp-review-aggregate.v1');
  assert.equal(review.manifest_digest, manifest.digest, 'manifest digest mismatch');
  assert.equal(review.routing_review_digest, routing.digest, 'routing review digest mismatch');
  assert.deepEqual(review.packet_digests, packets.map((packet) => packet.digest), 'packet digest mismatch');

  const manifestRows = unique(manifest.value.results, 'query_id', 'manifest query');
  assert.equal(manifestRows.size, manifest.value.total_candidates, 'manifest query count mismatch');
  const normalizedQueries = new Map();
  for (const row of manifestRows.values()) {
    assert.equal(row.state, 'rank1_observed', `${row.query_id}: rank one was not observed`);
    assert(typeof row.rank1_url === 'string' && row.rank1_url, `${row.query_id}: rank1_url required`);
    assert(typeof row.raw_digest === 'string' && row.raw_digest, `${row.query_id}: raw digest required`);
    const normalized = normalizeQuery(row.query_to_test);
    assert(!normalizedQueries.has(normalized), `normalized query duplicate: ${row.query_to_test}`);
    normalizedQueries.set(normalized, row.query_id);
  }

  const packetQueries = [];
  const packetCandidateIds = new Set();
  for (const packet of packets) {
    assert.equal(packet.value.schema_version, 'routing-query-serp-review-packet.v1');
    for (const candidate of packet.value.candidates ?? []) {
      assert(!packetCandidateIds.has(candidate.article_candidate_id), `candidate appears in multiple packets: ${candidate.article_candidate_id}`);
      packetCandidateIds.add(candidate.article_candidate_id);
      for (const query of candidate.queries ?? []) packetQueries.push(query);
    }
  }
  const packetByQuery = unique(packetQueries, 'query_id', 'packet query');
  assert.deepEqual(new Set(packetByQuery.keys()), new Set(manifestRows.keys()), 'packets must cover every manifest query');

  const routingUnits = new Map();
  for (const candidate of routing.value.candidates ?? []) for (const unit of candidate.unit_reviews ?? []) {
    if (unit.query_to_test == null) continue;
    const key = `${candidate.article_candidate_id}:${unit.unit_id}`;
    assert(!routingUnits.has(key), `duplicate routed query unit: ${key}`);
    routingUnits.set(key, unit);
  }
  for (const query of packetByQuery.values()) {
    const observed = manifestRows.get(query.query_id);
    assert(observed, `${query.query_id}: manifest observation missing`);
    for (const field of ['article_candidate_id', 'unit_id', 'query_to_test', 'raw_digest', 'rank1_url']) assert.equal(query[field], observed[field], `${query.query_id}: ${field} mismatch`);
    const routed = routingUnits.get(`${query.article_candidate_id}:${query.unit_id}`);
    assert(routed, `${query.query_id}: routed source unit missing`);
    assert.equal(query.query_to_test, routed.query_to_test, `${query.query_id}: routed query text mismatch`);
  }

  const candidates = unique(review.candidates, 'article_candidate_id', 'review candidate');
  assert.deepEqual(new Set(candidates.keys()), packetCandidateIds, 'review candidate coverage mismatch');
  const queryReviews = [];
  const clusterReviews = [];
  for (const candidate of candidates.values()) {
    for (const row of candidate.query_reviews ?? []) {
      assert.equal(packetByQuery.get(row.query_id)?.article_candidate_id, candidate.article_candidate_id, `${row.query_id}: review candidate mismatch`);
      queryReviews.push(row);
    }
    for (const row of candidate.cluster_reviews ?? []) clusterReviews.push({ ...row, article_candidate_id: candidate.article_candidate_id });
  }
  const reviewByQuery = unique(queryReviews, 'query_id', 'query review');
  assert.deepEqual(new Set(reviewByQuery.keys()), new Set(packetByQuery.keys()), 'review must cover every observed query exactly once');
  const clusterById = unique(clusterReviews, 'article_cluster_id', 'article cluster');
  const memberOwners = new Map();
  const acceptedDecisions = new Set(['canonical_query', 'supporting_query', 'internal_link_query']);

  for (const row of reviewByQuery.values()) {
    const source = packetByQuery.get(row.query_id);
    assert.equal(row.unit_id, source.unit_id, `${row.query_id}: unit mismatch`);
    assert(['same_answer_artifact', 'different_intent', 'ambiguous'].includes(row.intent_state), `${row.query_id}: invalid intent state`);
    assert(['canonical_query', 'supporting_query', 'internal_link_query', 'reject', 'hold'].includes(row.decision), `${row.query_id}: invalid decision`);
    assert(typeof row.rationale === 'string' && row.rationale.trim(), `${row.query_id}: rationale required`);
    if (row.intent_state === 'different_intent') assert.equal(row.decision, 'reject', `${row.query_id}: different intent must be rejected`);
    if (row.intent_state === 'ambiguous') assert.equal(row.decision, 'hold', `${row.query_id}: ambiguous query must be held`);
    if (row.intent_state === 'same_answer_artifact') assert(acceptedDecisions.has(row.decision), `${row.query_id}: same artifact must have an accepted decision`);
    if (acceptedDecisions.has(row.decision)) {
      assert(typeof row.article_cluster_id === 'string' && row.article_cluster_id, `${row.query_id}: accepted query requires cluster`);
      assert(typeof row.canonical_query_id === 'string' && row.canonical_query_id, `${row.query_id}: accepted query requires canonical reference`);
    } else {
      assert.equal(row.article_cluster_id, null, `${row.query_id}: non-accepted query cannot have cluster`);
      assert.equal(row.canonical_query_id, null, `${row.query_id}: non-accepted query cannot have canonical reference`);
    }
  }

  for (const cluster of clusterById.values()) {
    assert(typeof cluster.reader_problem === 'string' && cluster.reader_problem.trim(), `${cluster.article_cluster_id}: reader problem required`);
    assert(typeof cluster.answer_artifact === 'string' && cluster.answer_artifact.trim(), `${cluster.article_cluster_id}: answer artifact required`);
    assert(typeof cluster.rationale === 'string' && cluster.rationale.trim(), `${cluster.article_cluster_id}: rationale required`);
    assert(Array.isArray(cluster.member_query_ids) && cluster.member_query_ids.length, `${cluster.article_cluster_id}: members required`);
    assert.equal(new Set(cluster.member_query_ids).size, cluster.member_query_ids.length, `${cluster.article_cluster_id}: duplicate member`);
    const members = cluster.member_query_ids.map((id) => {
      const member = reviewByQuery.get(id);
      assert(member, `${cluster.article_cluster_id}: unknown member ${id}`);
      assert.equal(member.article_cluster_id, cluster.article_cluster_id, `${id}: member cluster mismatch`);
      assert.equal(member.canonical_query_id, cluster.canonical_query_id, `${id}: canonical reference mismatch`);
      assert.equal(packetByQuery.get(id).article_candidate_id, cluster.article_candidate_id, `${id}: cluster crosses article candidate`);
      assert(!memberOwners.has(id), `${id}: query belongs to multiple clusters`);
      memberOwners.set(id, cluster.article_cluster_id);
      return member;
    });
    assert.equal(members.filter((row) => row.decision === 'canonical_query').length, 1, `${cluster.article_cluster_id}: exactly one canonical query required`);
    assert.equal(members.find((row) => row.decision === 'canonical_query').query_id, cluster.canonical_query_id, `${cluster.article_cluster_id}: canonical member mismatch`);
  }
  for (const row of queryReviews.filter((item) => acceptedDecisions.has(item.decision))) assert.equal(memberOwners.get(row.query_id), row.article_cluster_id, `${row.query_id}: accepted query missing from cluster`);

  const repeatedRank1 = new Map();
  for (const row of queryReviews.filter((item) => acceptedDecisions.has(item.decision))) {
    const source = manifestRows.get(row.query_id);
    const observations = repeatedRank1.get(source.rank1_url) ?? [];
    observations.push({ query_id: row.query_id, raw_digest: source.raw_digest, article_cluster_id: row.article_cluster_id });
    repeatedRank1.set(source.rank1_url, observations);
  }
  for (const observations of repeatedRank1.values()) assert.equal(new Set(observations.map((row) => row.query_id)).size, observations.length, 'rank-one observations must retain query identity');

  return {
    schema_version: 'routing-query-serp-review-verification.v1',
    summary: {
      observed_queries: manifestRows.size,
      reviewed_queries: queryReviews.length,
      reviewed_candidates: candidates.size,
      accepted_article_clusters: clusterById.size,
      canonical_queries: queryReviews.filter((row) => row.decision === 'canonical_query').length,
      intent_states: counts(queryReviews, 'intent_state', ['same_answer_artifact', 'different_intent', 'ambiguous']),
      decisions: counts(queryReviews, 'decision', ['canonical_query', 'supporting_query', 'internal_link_query', 'reject', 'hold']),
      shared_rank1_urls: [...repeatedRank1.values()].filter((rows) => rows.length > 1).length,
    },
    non_claims: [
      'An observed query and its rank-one result do not prove publication readiness or future ranking.',
      'Accepted clusters still require exact-page keyword and heading conjunction review.',
      'Search-result overlap is evidence for review, not proof of identical intent.',
    ],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [manifestPath, routingPath, reviewPath, ...packetPaths] = process.argv.slice(2);
  if (!manifestPath || !routingPath || !reviewPath || !packetPaths.length) throw new Error('usage: node scripts/verify-routing-query-serp-review.mjs MANIFEST ROUTING REVIEW PACKET...');
  const manifest = read(manifestPath); const routing = read(routingPath); const review = read(reviewPath);
  const packets = packetPaths.map(read);
  console.log(JSON.stringify(verifyRoutingQuerySerpReview({ ...manifest, digest: digest(manifest.bytes) }, { ...routing, digest: digest(routing.bytes) }, packets.map((packet) => ({ ...packet, digest: digest(packet.bytes) })), review.value), null, 2));
}
