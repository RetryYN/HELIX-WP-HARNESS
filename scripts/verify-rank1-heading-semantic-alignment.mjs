import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const [headingManifestPath, sourcePath, targetsPath, reviewPath] = process.argv.slice(2);
if (!headingManifestPath || !sourcePath || !targetsPath || !reviewPath) throw new Error('usage: node scripts/verify-rank1-heading-semantic-alignment.mjs HEADING_MANIFEST SOURCE CANONICAL_TARGETS REVIEW');
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const read = (file) => { const bytes = fs.readFileSync(file); return { bytes, value: JSON.parse(bytes) }; };
const headingManifest = read(headingManifestPath);
const source = read(sourcePath);
const targets = read(targetsPath);
const review = read(reviewPath);
assert.equal(review.value.schema_version, 'canonical-rank1-heading-review.v1');
assert.equal(review.value.heading_manifest_digest, digest(headingManifest.bytes), 'review does not bind heading evidence');
assert.equal(review.value.source_digest, digest(source.bytes), 'review does not bind semantic source');
assert.equal(review.value.canonical_targets_digest, digest(targets.bytes), 'review does not bind canonical targets');
const plans = new Map(source.value.plans.plans.map((row) => [row.article_candidate_id, row]));
const targetByCandidate = new Map(targets.value.assignments.map((row) => [row.article_candidate_id, row]));
const evidenceByCandidate = new Map(headingManifest.value.rows.map((row) => [row.article_candidate_id, row]));
const allowedHeadingClasses = new Set(['supported', 'partial', 'gap', 'excluded']);
const results = [];
const round = (value) => Math.round(value * 100) / 100;
for (const candidate of review.value.candidates) {
  const plan = plans.get(candidate.article_candidate_id);
  const target = targetByCandidate.get(candidate.article_candidate_id);
  const evidence = evidenceByCandidate.get(candidate.article_candidate_id);
  assert(plan && target, `unknown candidate: ${candidate.article_candidate_id}`);
  const problems = new Set(plan.sections.map((row) => row.problem_id));
  assert.deepEqual(new Set(candidate.planned_units.map((row) => row.problem_id)), problems, `${candidate.article_candidate_id}: planned units incomplete`);
  if (candidate.observation_state === 'reviewed') {
    assert.equal(target.state, 'observed', `${candidate.article_candidate_id}: reviewed without canonical query`);
    assert.equal(evidence?.status, 'ok', `${candidate.article_candidate_id}: reviewed without fetched page`);
    assert.equal(candidate.target_digest, evidence.target_digest, `${candidate.article_candidate_id}: target mismatch`);
    assert.equal(candidate.snapshot_digest, evidence.raw_digest, `${candidate.article_candidate_id}: snapshot mismatch`);
    const expected = new Map(evidence.headings.filter((row) => row.level >= 2).map((row) => [row.position, row]));
    assert.equal(expected.size, evidence.headings.filter((row) => row.level >= 2).length, `${candidate.article_candidate_id}: duplicate evidence heading positions`);
    assert.equal(new Set(candidate.heading_reviews.map((row) => row.position)).size, candidate.heading_reviews.length, `${candidate.article_candidate_id}: duplicate heading reviews`);
    assert.deepEqual(new Set(candidate.heading_reviews.map((row) => row.position)), new Set(expected.keys()), `${candidate.article_candidate_id}: every H2-H6 heading must be reviewed once`);
    const supportByProblem = new Map([...problems].map((problemId) => [problemId, new Set()]));
    const fullSupportByProblem = new Map([...problems].map((problemId) => [problemId, new Set()]));
    for (const row of candidate.heading_reviews) {
      const original = expected.get(row.position);
      assert(original, `${candidate.article_candidate_id}: unknown heading position`);
      assert.equal(row.level, original.level, `${candidate.article_candidate_id}:${row.position}: level mismatch`);
      assert.equal(row.text, original.text, `${candidate.article_candidate_id}:${row.position}: text mismatch`);
      assert(allowedHeadingClasses.has(row.classification), `${candidate.article_candidate_id}:${row.position}: invalid classification`);
      assert(row.rationale?.trim(), `${candidate.article_candidate_id}:${row.position}: rationale required`);
      for (const problemId of row.matched_problem_ids) assert(problems.has(problemId), `${candidate.article_candidate_id}:${row.position}: unknown problem`);
      if (row.classification === 'supported' || row.classification === 'partial') {
        assert(row.matched_problem_ids.length, `${candidate.article_candidate_id}:${row.position}: aligned heading requires problem ids`);
        for (const problemId of row.matched_problem_ids) {
          supportByProblem.get(problemId).add(`${candidate.target_digest}:${row.position}`);
          if (row.classification === 'supported') fullSupportByProblem.get(problemId).add(`${candidate.target_digest}:${row.position}`);
        }
      } else assert.equal(row.matched_problem_ids.length, 0, `${candidate.article_candidate_id}:${row.position}: gap/excluded cannot satisfy a unit`);
    }
    for (const unit of candidate.planned_units) {
      assert(['supported', 'partial', 'missing'].includes(unit.state), `${unit.problem_id}: invalid planned-unit state`);
      const cited = new Set((unit.supporting_heading_positions ?? []).map((row) => typeof row === 'number' ? `${candidate.target_digest}:${row}` : `${row.target_digest ?? candidate.target_digest}:${row.position}`));
      assert.deepEqual(cited, supportByProblem.get(unit.problem_id), `${unit.problem_id}: heading citation set mismatch`);
      assert.equal(unit.state === 'missing', cited.size === 0, `${unit.problem_id}: state contradicts heading evidence`);
      assert(unit.state !== 'supported' || fullSupportByProblem.get(unit.problem_id).size > 0, `${unit.problem_id}: supported requires at least one fully supporting heading`);
    }
    const substantive = candidate.heading_reviews.filter((row) => row.classification !== 'excluded').length;
    const supported = candidate.heading_reviews.filter((row) => row.classification === 'supported').length;
    const partial = candidate.heading_reviews.filter((row) => row.classification === 'partial').length;
    const gap = candidate.heading_reviews.filter((row) => row.classification === 'gap').length;
    const unitSupported = candidate.planned_units.filter((row) => row.state === 'supported').length;
    const unitPartial = candidate.planned_units.filter((row) => row.state === 'partial').length;
    const unitMissing = candidate.planned_units.filter((row) => row.state === 'missing').length;
    const headingPercent = substantive ? round((supported + partial) / substantive * 100) : null;
    const unitPercent = candidate.planned_units.length ? round((unitSupported + unitPartial) / candidate.planned_units.length * 100) : null;
    const computed = { substantive_heading_count: substantive, supported_count: supported, partial_count: partial, gap_count: gap, heading_supported_or_partial_percent: headingPercent, planned_units_supported: unitSupported, planned_units_partial: unitPartial, planned_units_missing: unitMissing, planned_unit_supported_or_partial_percent: unitPercent };
    for (const [key, value] of Object.entries(computed)) assert.equal(candidate.metrics?.[key], value, `${candidate.article_candidate_id}: metric mismatch ${key}`);
    const pass = headingPercent != null && headingPercent >= 90 && unitPercent != null && unitPercent >= 90;
    results.push({ article_candidate_id: candidate.article_candidate_id, observation_state: candidate.observation_state, ...computed, verdict: pass ? 'PASS' : 'FAIL' });
  } else {
    assert(['main_keyword_not_observed', 'heading_fetch_failed'].includes(candidate.observation_state), `${candidate.article_candidate_id}: invalid non-review state`);
    assert.equal(candidate.heading_reviews.length, 0, `${candidate.article_candidate_id}: unreviewed state cites headings`);
    assert(candidate.planned_units.every((row) => row.state === 'missing' && !(row.supporting_heading_positions ?? []).length), `${candidate.article_candidate_id}: unreviewed state must keep units missing`);
    results.push({ article_candidate_id: candidate.article_candidate_id, observation_state: candidate.observation_state, substantive_heading_count: 0, supported_count: 0, partial_count: 0, gap_count: 0, heading_supported_or_partial_percent: null, planned_units_supported: 0, planned_units_partial: 0, planned_units_missing: candidate.planned_units.length, planned_unit_supported_or_partial_percent: 0, verdict: 'FAIL' });
  }
}
assert.equal(new Set(review.value.candidates.map((row) => row.article_candidate_id)).size, review.value.candidates.length, 'review contains duplicate article candidates');
assert.deepEqual(new Set(review.value.candidates.map((row) => row.article_candidate_id)), new Set(plans.keys()), 'review must cover every article candidate');
const passed = results.filter((row) => row.verdict === 'PASS').length;
console.log(JSON.stringify({ schema_version: 'canonical-rank1-heading-alignment-verification.v1', threshold: { heading_supported_or_partial_percent: 90, planned_unit_supported_or_partial_percent: 90 }, non_claims: ['Heading alignment is not a ranking guarantee.', 'Partial support does not prove complete body coverage.'], candidates: results, summary: { passed, total: results.length, alignment_percent: round(passed / results.length * 100), reviewed: results.filter((row) => row.observation_state === 'reviewed').length } }, null, 2));
