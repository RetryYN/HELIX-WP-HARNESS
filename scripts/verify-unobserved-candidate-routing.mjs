import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (file) => { const bytes = fs.readFileSync(file); return { bytes, value: JSON.parse(bytes) }; };
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const mapUnique = (rows, key, label) => {
  const map = new Map();
  for (const row of rows ?? []) { assert(typeof row?.[key] === 'string' && row[key], `${label} requires ${key}`); assert(!map.has(row[key]), `duplicate ${label}: ${row[key]}`); map.set(row[key], row); }
  return map;
};
const rationale = (row, label) => assert(typeof row.rationale === 'string' && row.rationale.trim(), `${label} requires rationale`);
const normalizeQuery = (value) => value.normalize('NFKC').toLocaleLowerCase('ja').trim().replace(/\s+/g, ' ');

function expectedCandidateDisposition(units) {
  const dispositions = new Set(units.map((row) => row.disposition));
  const targets = new Set(units.map((row) => row.target_article_candidate_id).filter(Boolean));
  if (dispositions.size === 1 && dispositions.has('promote_query_candidate')) return 'promote';
  if ([...dispositions].every((value) => value === 'merge_into_article' || value === 'body_support') && targets.size === 1) return 'retire_to_existing';
  if (dispositions.size === 1 && dispositions.has('exclude')) return 'exclude';
  if (dispositions.size > 1 || targets.size > 1) return 'split';
  return 'hold';
}

export function verifyUnobservedCandidateRouting(ledger, observedReview, review) {
  assert.equal(review.schema_version, 'unobserved-candidate-routing-review-aggregate.v1');
  assert.equal(review.target_demand_ledger_digest, ledger.digest, 'ledger digest mismatch');
  assert.equal(review.observed_review_digest, observedReview.digest, 'observed review digest mismatch');
  const observedIds = new Set(ledger.value.candidates.filter((row) => row.observation_state === 'observed').map((row) => row.article_candidate_id));
  const sources = ledger.value.candidates.filter((row) => row.observation_state !== 'observed');
  const sourceByCandidate = mapUnique(sources, 'article_candidate_id', 'source candidate');
  const reviews = mapUnique(review.candidates, 'article_candidate_id', 'review candidate');
  assert.deepEqual(new Set(reviews.keys()), new Set(sourceByCandidate.keys()), 'review must cover every unobserved candidate');
  const results = [];
  for (const source of sources) {
    const candidate = reviews.get(source.article_candidate_id);
    assert(['promote', 'retire_to_existing', 'split', 'exclude', 'hold'].includes(candidate.candidate_disposition), `${source.article_candidate_id}: invalid candidate disposition`);
    assert(typeof candidate.candidate_rationale === 'string' && candidate.candidate_rationale.trim(), `${source.article_candidate_id}: candidate rationale required`);
    const sourceUnits = mapUnique(source.meaning_units, 'unit_id', `${source.article_candidate_id} source unit`);
    const units = mapUnique(candidate.unit_reviews, 'unit_id', `${source.article_candidate_id} unit review`);
    assert.deepEqual(new Set(units.keys()), new Set(sourceUnits.keys()), `${source.article_candidate_id}: unit coverage mismatch`);
    const demandById = mapUnique(source.target_demands, 'evidence_id', `${source.article_candidate_id} target demand`);
    for (const unit of units.values()) {
      const original = sourceUnits.get(unit.unit_id);
      assert(['promote_query_candidate', 'merge_into_article', 'body_support', 'internal_link', 'exclude', 'hold'].includes(unit.disposition), `${unit.unit_id}: invalid disposition`);
      rationale(unit, unit.unit_id);
      assert(Array.isArray(unit.evidence_ids), `${unit.unit_id}: evidence_ids required`);
      for (const evidenceId of unit.evidence_ids) {
        assert(original.demand_evidence_ids.includes(evidenceId), `${unit.unit_id}: evidence was not cited by the unit`);
        assert(demandById.has(evidenceId), `${unit.unit_id}: unknown evidence`);
      }
      if (unit.disposition === 'promote_query_candidate') {
        assert(unit.evidence_ids.length, `${unit.unit_id}: promotion requires evidence`);
        assert(typeof unit.query_to_test === 'string' && unit.query_to_test.trim(), `${unit.unit_id}: query_to_test required`);
        assert(unit.evidence_ids.some((id) => demandById.get(id).text === unit.query_to_test), `${unit.unit_id}: query_to_test must be verbatim observed demand`);
        assert(unit.target_article_candidate_id == null, `${unit.unit_id}: promotion cannot borrow an article target`);
      } else if (unit.disposition === 'internal_link' && unit.query_to_test != null) {
        assert(typeof unit.query_to_test === 'string' && unit.query_to_test.trim(), `${unit.unit_id}: query_to_test must be non-empty`);
        assert(unit.evidence_ids.some((id) => demandById.get(id).text === unit.query_to_test), `${unit.unit_id}: internal-link query must be verbatim observed demand`);
      } else {
        assert(unit.query_to_test == null, `${unit.unit_id}: disposition cannot propose a query`);
      }
      if (unit.disposition === 'merge_into_article' || unit.disposition === 'body_support') {
        assert(observedIds.has(unit.target_article_candidate_id), `${unit.unit_id}: target must be an observed article`);
        if (unit.disposition === 'merge_into_article') assert(unit.evidence_ids.length, `${unit.unit_id}: merge requires demand evidence`);
      } else assert(unit.target_article_candidate_id == null, `${unit.unit_id}: disposition cannot set target article`);
      if (unit.disposition === 'internal_link') assert(unit.evidence_ids.length, `${unit.unit_id}: internal link requires observed demand`);
    }
    const expected = expectedCandidateDisposition([...units.values()]);
    assert.equal(candidate.candidate_disposition, expected, `${source.article_candidate_id}: candidate disposition does not follow unit routes`);
    results.push({ article_candidate_id: source.article_candidate_id, candidate_disposition: expected, units: units.size, unit_counts: Object.fromEntries([...new Set([...units.values()].map((row) => row.disposition))].sort().map((state) => [state, [...units.values()].filter((row) => row.disposition === state).length])), promotion_queries: [...units.values()].filter((row) => row.disposition === 'promote_query_candidate').map((row) => ({ unit_id: row.unit_id, query_to_test: row.query_to_test })), internal_link_queries: [...units.values()].filter((row) => row.disposition === 'internal_link' && row.query_to_test != null).map((row) => ({ unit_id: row.unit_id, query_to_test: row.query_to_test })) });
  }
  const counts = Object.fromEntries(['promote', 'retire_to_existing', 'split', 'exclude', 'hold'].map((state) => [state, results.filter((row) => row.candidate_disposition === state).length]));
  const promotedUnits = results.flatMap((row) => row.promotion_queries).length;
  const internalLinkQueries = results.flatMap((row) => row.internal_link_queries).length;
  const existingQueries = new Set(ledger.value.candidates.filter((row) => row.observation_state === 'observed').map((row) => normalizeQuery(row.canonical_keyword)));
  const proposedQueries = new Map();
  for (const row of results) for (const query of [...row.promotion_queries, ...row.internal_link_queries]) {
    const normalized = normalizeQuery(query.query_to_test);
    assert(!existingQueries.has(normalized), `proposed query duplicates an observed canonical query: ${query.query_to_test}`);
    assert(!proposedQueries.has(normalized), `proposed query has multiple owners: ${query.query_to_test}`);
    proposedQueries.set(normalized, `${row.article_candidate_id}:${query.unit_id}`);
  }
  return {
    schema_version: 'unobserved-candidate-routing-verification.v1',
    candidates: results,
    summary: { observed_articles: observedIds.size, reviewed_unobserved_candidates: results.length, reviewed_units: results.reduce((sum, row) => sum + row.units, 0), candidate_dispositions: counts, promotion_queries_to_test: promotedUnits, internal_link_queries_to_test: internalLinkQueries, query_candidates_to_test: proposedQueries.size, canonical_query_observed_after_review: 0 },
    non_claims: ['A proposed query is not an observed canonical query.', 'Routing does not borrow a parent rank-one URL.', 'Search features are not observed user transitions.'],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [ledgerPath, observedPath, reviewPath] = process.argv.slice(2);
  if (!reviewPath) throw new Error('usage: node scripts/verify-unobserved-candidate-routing.mjs LEDGER OBSERVED_REVIEW ROUTING_REVIEW');
  const ledger = read(ledgerPath); const observed = read(observedPath); const review = read(reviewPath);
  console.log(JSON.stringify(verifyUnobservedCandidateRouting({ ...ledger, digest: digest(ledger.bytes) }, { ...observed, digest: digest(observed.bytes) }, review.value), null, 2));
}
