import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (file) => { const bytes = fs.readFileSync(file); return { bytes, value: JSON.parse(bytes) }; };
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const unique = (rows, key, label) => { const map = new Map(); for (const row of rows ?? []) { assert(row?.[key] != null, `${label} requires ${key}`); assert(!map.has(row[key]), `duplicate ${label}: ${row[key]}`); map.set(row[key], row); } return map; };
const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ja').trim().replace(/\s+/g, ' ');
const tally = (rows, key, states) => Object.fromEntries(states.map((state) => [state, rows.filter((row) => row[key] === state).length]));

export function verifyRoutingExactPageReview(ranked, headings, semantic, packets, review) {
  assert.equal(review.schema_version, 'routing-exact-page-review-aggregate.v1');
  assert.equal(review.ranked_manifest_digest, ranked.digest, 'ranked manifest digest mismatch');
  assert.equal(review.heading_manifest_digest, headings.digest, 'heading manifest digest mismatch');
  assert.equal(review.semantic_review_digest, semantic.digest, 'semantic review digest mismatch');
  assert.deepEqual(review.packet_digests, packets.map((row) => row.digest), 'packet digest mismatch');
  assert.equal(ranked.value.status, 'complete', 'ranked acquisition must be terminal');
  assert.equal(ranked.value.truncated_pages, 0, 'truncated exact-page corpus is not reviewable');
  const rankedJobs = unique(ranked.value.jobs, 'job_id', 'ranked job');
  const headingByUrl = unique(headings.value.pages, 'url', 'heading page');
  const packetPages = unique(packets.flatMap((packet) => packet.value.pages), 'job_id', 'packet page');
  assert.deepEqual(new Set(packetPages.keys()), new Set(rankedJobs.keys()), 'packets must cover every ranked page');
  const reviewPages = unique(review.pages, 'job_id', 'review page');
  assert.deepEqual(new Set(reviewPages.keys()), new Set(packetPages.keys()), 'review must cover every exact page');
  const queryReviews = new Map(semantic.value.candidates.flatMap((candidate) => candidate.query_reviews).map((row) => [row.query_id, row]));
  const keywordClasses = ['canonical_exact', 'same_answer_support', 'body_support', 'internal_link', 'different_intent', 'brand_navigation', 'ambiguous'];
  const headingClasses = ['supported', 'partial', 'gap', 'excluded'];
  const results = [];
  for (const [jobId, source] of packetPages) {
    const rankedJob = rankedJobs.get(jobId); const row = reviewPages.get(jobId);
    assert.equal(source.target_digest, rankedJob.target_digest, `${jobId}: target mismatch`);
    assert.equal(source.raw_digest, rankedJob.raw_digest, `${jobId}: raw evidence mismatch`);
    assert.equal(source.corpus_state, 'complete', `${jobId}: corpus incomplete`);
    assert.equal(source.acquired_keywords.length, rankedJob.observed_keyword_count, `${jobId}: acquired keyword count mismatch`);
    for (const observation of source.observations) assert.equal(queryReviews.get(observation.query_id)?.decision, 'canonical_query', `${jobId}: observation is not an accepted canonical query`);
    const sourceKeywords = unique(source.acquired_keywords, 'keyword_digest', `${jobId} source keyword`);
    const reviewedKeywords = unique(row.keyword_reviews, 'keyword_digest', `${jobId} reviewed keyword`);
    assert.deepEqual(new Set(reviewedKeywords.keys()), new Set(sourceKeywords.keys()), `${jobId}: keyword review coverage mismatch`);
    for (const item of reviewedKeywords.values()) { assert(keywordClasses.includes(item.class), `${jobId}: invalid keyword class`); assert(typeof item.rationale === 'string' && item.rationale.trim(), `${jobId}: keyword rationale required`); }
    const canonicalQueries = source.observations.map((observation) => observation.canonical_query);
    const exactObserved = canonicalQueries.some((query) => [...sourceKeywords.values()].some((keyword) => normalize(keyword.keyword) === normalize(query)));
    assert(['exact', 'semantic_support', 'absent'].includes(row.canonical_query_acquired_state), `${jobId}: invalid canonical acquisition state`);
    if (row.canonical_query_acquired_state === 'exact') assert(exactObserved, `${jobId}: canonical exact claim lacks exact keyword`);
    if (exactObserved) assert.notEqual(row.canonical_query_acquired_state, 'absent', `${jobId}: exact canonical query cannot be absent`);

    const headingSource = headingByUrl.get(source.target_url);
    assert(headingSource, `${jobId}: heading manifest row missing`);
    assert.equal(source.heading_evidence.status, headingSource.status, `${jobId}: heading state mismatch`);
    assert.equal(source.heading_evidence.raw_digest, headingSource.raw_digest ?? null, `${jobId}: heading raw digest mismatch`);
    const expectedHeadings = source.heading_evidence.headings.map((heading) => ({ ...heading, heading_digest: sha(heading.text) }));
    const sourceHeadingByPosition = unique(expectedHeadings, 'position', `${jobId} source heading`);
    const reviewedHeadings = unique(row.heading_reviews, 'position', `${jobId} reviewed heading`);
    assert.deepEqual(new Set(reviewedHeadings.keys()), new Set(sourceHeadingByPosition.keys()), `${jobId}: heading review coverage mismatch`);
    for (const item of reviewedHeadings.values()) { const original = sourceHeadingByPosition.get(item.position); assert.equal(item.level, original.level, `${jobId}: heading level mismatch`); assert.equal(item.heading_digest, original.heading_digest, `${jobId}: heading digest mismatch`); assert(headingClasses.includes(item.class), `${jobId}: invalid heading class`); assert(typeof item.rationale === 'string' && item.rationale.trim(), `${jobId}: heading rationale required`); }
    assert(typeof row.source_unit_supported === 'boolean', `${jobId}: source unit support required`); assert(typeof row.material_keyword_coverage === 'boolean', `${jobId}: material keyword coverage required`);
    assert(['pass', 'fail', 'missing'].includes(row.heading_alignment_state), `${jobId}: invalid heading alignment state`); assert(['pass', 'fail', 'hold'].includes(row.page_state), `${jobId}: invalid page state`); assert(typeof row.rationale === 'string' && row.rationale.trim(), `${jobId}: page rationale required`);
    const substantive = [...reviewedHeadings.values()].filter((item) => item.class !== 'excluded'); const aligned = substantive.filter((item) => item.class === 'supported' || item.class === 'partial').length; const alignment = substantive.length ? aligned / substantive.length : null;
    if (row.heading_alignment_state === 'pass') assert(alignment != null && alignment >= 0.9, `${jobId}: heading pass requires at least 90% substantive alignment`);
    if (!expectedHeadings.length) assert.equal(row.heading_alignment_state, 'missing', `${jobId}: absent headings must be missing`);
    if (row.page_state === 'pass') { assert(sourceKeywords.size > 0, `${jobId}: zero-keyword page cannot pass`); assert(expectedHeadings.length > 0, `${jobId}: missing-heading page cannot pass`); assert.notEqual(row.canonical_query_acquired_state, 'absent', `${jobId}: absent canonical support cannot pass`); assert.equal(row.source_unit_supported, true, `${jobId}: unsupported source unit cannot pass`); assert.equal(row.material_keyword_coverage, true, `${jobId}: incomplete material keyword coverage cannot pass`); assert.equal(row.heading_alignment_state, 'pass', `${jobId}: heading alignment must pass`); }
    results.push({ job_id: jobId, target_digest: source.target_digest, keywords: sourceKeywords.size, headings: expectedHeadings.length, canonical_query_acquired_state: row.canonical_query_acquired_state, source_unit_supported: row.source_unit_supported, material_keyword_coverage: row.material_keyword_coverage, heading_alignment_state: row.heading_alignment_state, substantive_headings: substantive.length, aligned_headings: aligned, heading_alignment_percent: alignment == null ? null : Number((alignment * 100).toFixed(2)), page_state: row.page_state, keyword_classes: tally([...reviewedKeywords.values()], 'class', keywordClasses), heading_classes: tally([...reviewedHeadings.values()], 'class', headingClasses) });
  }
  const acceptedQueryCount = semantic.value.candidates.flatMap((candidate) => candidate.query_reviews).filter((row) => row.decision === 'canonical_query').length;
  return { schema_version: 'routing-exact-page-review-verification.v1', pages: results, summary: { accepted_canonical_queries: acceptedQueryCount, exact_pages: results.length, complete_keyword_corpora: results.filter((row) => row.keywords >= 0).length, acquired_unique_keywords: results.reduce((sum, row) => sum + row.keywords, 0), reviewed_headings: results.reduce((sum, row) => sum + row.headings, 0), page_states: tally(results, 'page_state', ['pass', 'fail', 'hold']), final_pass_queries: results.filter((row) => row.page_state === 'pass').reduce((sum, row) => sum + packetPages.get(row.job_id).observations.length, 0), final_pass_percent_of_accepted: acceptedQueryCount ? Number((results.filter((row) => row.page_state === 'pass').reduce((sum, row) => sum + packetPages.get(row.job_id).observations.length, 0) / acceptedQueryCount * 100).toFixed(2)) : 0 }, non_claims: ['PASS is a minimum evidence conjunction, not a ranking guarantee.', 'Search-result features do not prove observed user transitions.', 'A held or failed page cannot lend its evidence to another article cluster.'] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [rankedPath, headingPath, semanticPath, reviewPath, ...packetPaths] = process.argv.slice(2); if (!reviewPath || !packetPaths.length) throw new Error('usage: node scripts/verify-routing-exact-page-review.mjs RANKED HEADINGS SEMANTIC REVIEW PACKET...');
  const ranked = read(rankedPath); const headings = read(headingPath); const semantic = read(semanticPath); const review = read(reviewPath); const packets = packetPaths.map(read);
  console.log(JSON.stringify(verifyRoutingExactPageReview({ ...ranked, digest: sha(ranked.bytes) }, { ...headings, digest: sha(headings.bytes) }, { ...semantic, digest: sha(semantic.bytes) }, packets.map((packet) => ({ ...packet, digest: sha(packet.bytes) })), review.value), null, 2));
}
