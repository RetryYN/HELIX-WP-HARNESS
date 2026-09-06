import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const [manifestPath, sourcePath, reviewPath] = process.argv.slice(2);
if (!manifestPath || !sourcePath || !reviewPath) {
  throw new Error('usage: node scripts/verify-rank1-keyword-semantic-conjunction.mjs MANIFEST SOURCE REVIEW');
}

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const read = (file) => {
  const bytes = fs.readFileSync(file);
  return { bytes, value: JSON.parse(bytes) };
};
const manifest = read(manifestPath);
const source = read(sourcePath);
const review = read(reviewPath);

assert.equal(review.value.schema_version, 'rank1-keyword-semantic-conjunction-review.v1');
assert.equal(review.value.manifest_digest, digest(manifest.bytes), 'review does not bind the current acquisition manifest');
assert.equal(review.value.source_digest, digest(source.bytes), 'review does not bind the current semantic source');
assert.equal(manifest.value.status, 'complete', 'acquisition manifest is not terminal');

const plans = new Map(source.value.plans.plans.map((plan) => [plan.article_candidate_id, plan]));
const jobs = new Map(manifest.value.jobs.map((job) => [job.job_id, job]));
const allowedClasses = new Set(['direct', 'supporting', 'internal_link', 'other_intent']);
const results = [];

for (const candidateReview of review.value.candidates) {
  const plan = plans.get(candidateReview.article_candidate_id);
  assert(plan, `unknown article candidate: ${candidateReview.article_candidate_id}`);
  const problemIds = new Set(plan.sections.map((section) => section.problem_id));
  const planned = new Map(candidateReview.planned_units.map((unit) => [unit.problem_id, unit]));
  assert.deepEqual(new Set(planned.keys()), problemIds, `${candidateReview.article_candidate_id}: planned-unit review must cover every semantic section exactly once`);

  const observed = new Set();
  let allCorporaComplete = true;
  for (const page of candidateReview.pages) {
    const job = jobs.get(page.job_id);
    assert(job, `${candidateReview.article_candidate_id}: unknown job ${page.job_id}`);
    assert(job.article_candidate_ids.includes(candidateReview.article_candidate_id), `${page.job_id}: URL is not evidence for candidate`);
    assert.equal(page.target_digest, job.target_digest, `${page.job_id}: target mismatch`);
    allCorporaComplete &&= job.corpus_state === 'complete';
    const expected = new Set(job.observed_keyword_digests || []);
    assert.deepEqual(new Set(page.keyword_reviews.map((item) => item.keyword_digest)), expected, `${page.job_id}: every acquired keyword must be classified exactly once`);
    for (const item of page.keyword_reviews) {
      assert(allowedClasses.has(item.classification), `${page.job_id}: invalid classification`);
      assert.equal(typeof item.material, 'boolean', `${page.job_id}: material flag required`);
      for (const problemId of item.matched_problem_ids) assert(problemIds.has(problemId), `${page.job_id}: unknown problem ${problemId}`);
      if (item.classification === 'direct' || item.classification === 'supporting') {
        assert(item.matched_problem_ids.length > 0, `${page.job_id}: in-article keyword has no matched meaning unit`);
      } else {
        assert.equal(item.matched_problem_ids.length, 0, `${page.job_id}: non-body keyword must not satisfy a meaning unit`);
      }
      observed.add(item.keyword_digest);
    }
  }

  const missingUnits = [];
  for (const [problemId, unit] of planned) {
    assert(['matched', 'missing'].includes(unit.state), `${problemId}: invalid state`);
    assert(unit.matched_keyword_digests.every((keyword) => observed.has(keyword)), `${problemId}: cites unobserved keyword`);
    if (unit.state === 'matched') assert(unit.matched_keyword_digests.length > 0, `${problemId}: matched without keyword evidence`);
    if (unit.state === 'missing') {
      assert.equal(unit.matched_keyword_digests.length, 0, `${problemId}: missing unit cites matches`);
      missingUnits.push(problemId);
    }
  }
  const materialUnexplained = candidateReview.pages.flatMap((page) => page.keyword_reviews)
    .filter((item) => item.material && !item.rationale?.trim()).map((item) => item.keyword_digest);
  const falseMerges = candidateReview.false_merges || [];
  const computedPass = allCorporaComplete && missingUnits.length === 0 && materialUnexplained.length === 0 && falseMerges.length === 0;
  assert.equal(candidateReview.verdict, computedPass ? 'PASS' : 'FAIL', `${candidateReview.article_candidate_id}: verdict contradicts evidence`);
  results.push({
    article_candidate_id: candidateReview.article_candidate_id,
    corpus_complete: allCorporaComplete,
    planned_meaning_units: problemIds.size,
    matched_meaning_units: problemIds.size - missingUnits.length,
    semantic_recall_percent: problemIds.size ? Math.round((problemIds.size - missingUnits.length) / problemIds.size * 10000) / 100 : null,
    material_unexplained_keywords: materialUnexplained.length,
    false_merges: falseMerges.length,
    verdict: computedPass ? 'PASS' : 'FAIL',
  });
}

const expectedCandidates = new Set(source.value.plans.plans.map((plan) => plan.article_candidate_id));
assert.deepEqual(new Set(review.value.candidates.map((item) => item.article_candidate_id)), expectedCandidates, 'review must cover every article candidate');
const passed = results.filter((item) => item.verdict === 'PASS').length;
console.log(JSON.stringify({
  schema_version: 'rank1-keyword-semantic-conjunction-verification.v1',
  pass_rule: 'Complete exact-page corpus AND every planned meaning unit matched AND every material acquired keyword classified with rationale AND zero false merges.',
  candidates: results,
  summary: { passed, total: results.length, conjunction_percent: results.length ? Math.round(passed / results.length * 10000) / 100 : 0 },
}, null, 2));
