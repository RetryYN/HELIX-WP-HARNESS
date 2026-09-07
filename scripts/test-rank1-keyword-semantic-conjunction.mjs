import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-conjunction-'));
const write = (name, value) => { const file = path.join(dir, name); fs.writeFileSync(file, JSON.stringify(value)); return file; };
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source = write('source.json', { plans: { plans: [{ article_candidate_id: 'article-a', sections: [{ problem_id: 'p1' }, { problem_id: 'p2' }] }] } });
const manifest = write('manifest.json', { status: 'complete', jobs: [{ job_id: 'j1', target_digest: 'url1', article_candidate_ids: ['article-a'], corpus_state: 'complete', observed_keyword_digests: ['k1', 'k2'] }] });
const base = { schema_version: 'rank1-keyword-semantic-conjunction-review.v1', manifest_digest: digest(manifest), source_digest: digest(source), candidates: [{ article_candidate_id: 'article-a', pages: [{ job_id: 'j1', target_digest: 'url1', keyword_reviews: [{ keyword_digest: 'k1', classification: 'direct', material: true, matched_problem_ids: ['p1'], rationale: 'same answer' }, { keyword_digest: 'k2', classification: 'supporting', material: true, matched_problem_ids: ['p2'], rationale: 'same transition' }] }], planned_units: [{ problem_id: 'p1', state: 'matched', matched_keyword_digests: ['k1'] }, { problem_id: 'p2', state: 'matched', matched_keyword_digests: ['k2'] }], false_merges: [], verdict: 'PASS' }] };
const run = (review) => spawnSync(process.execPath, ['scripts/verify-rank1-keyword-semantic-conjunction.mjs', manifest, source, write(`review-${Math.random()}.json`, review)], { cwd: process.cwd(), encoding: 'utf8' });
const pass = run(base);
assert.equal(pass.status, 0, pass.stderr);
const passed = JSON.parse(pass.stdout);
assert.equal(passed.summary.conjunction_percent, 100);
assert.equal(passed.gate_level, 'minimum_operational_acceptance');
assert(passed.non_claims.includes('PASS is not a ranking guarantee.'));

const missing = structuredClone(base);
missing.candidates[0].pages[0].keyword_reviews[1] = { keyword_digest: 'k2', classification: 'context_only', material: true, matched_problem_ids: [], rationale: 'relevant but does not entail p2' };
missing.candidates[0].planned_units[1] = { problem_id: 'p2', state: 'missing', matched_keyword_digests: [] };
missing.candidates[0].verdict = 'FAIL';
assert.equal(run(missing).status, 0, 'an honest FAIL is a valid reviewed result');

const dishonest = structuredClone(missing);
dishonest.candidates[0].verdict = 'PASS';
assert.notEqual(run(dishonest).status, 0, 'cannot claim PASS with a missing meaning unit');

const omitted = structuredClone(base);
omitted.candidates[0].pages[0].keyword_reviews.pop();
assert.notEqual(run(omitted).status, 0, 'cannot omit an acquired keyword from classification');

const contextual = structuredClone(base);
contextual.candidates[0].pages[0].keyword_reviews[1] = { keyword_digest: 'k2', classification: 'context_only', material: true, matched_problem_ids: [], rationale: 'relevant context without unit entailment' };
contextual.candidates[0].planned_units[1] = { problem_id: 'p2', state: 'missing', matched_keyword_digests: [] };
contextual.candidates[0].verdict = 'FAIL';
assert.equal(run(contextual).status, 0, 'context-only demand must remain classifiable without falsely matching a planned unit');

const contextualExploit = structuredClone(contextual);
contextualExploit.candidates[0].planned_units[1] = { problem_id: 'p2', state: 'matched', matched_keyword_digests: ['k2'] };
contextualExploit.candidates[0].verdict = 'PASS';
assert.notEqual(run(contextualExploit).status, 0, 'context-only digest cannot be cited as a matched meaning unit');

const wrongProblemExploit = structuredClone(base);
wrongProblemExploit.candidates[0].planned_units[0] = { problem_id: 'p1', state: 'matched', matched_keyword_digests: ['k2'] };
assert.notEqual(run(wrongProblemExploit).status, 0, 'a direct/supporting digest cannot satisfy a different problem id');

const omittedSupportExploit = structuredClone(base);
omittedSupportExploit.candidates[0].planned_units[1] = { problem_id: 'p2', state: 'missing', matched_keyword_digests: [] };
omittedSupportExploit.candidates[0].verdict = 'FAIL';
assert.notEqual(run(omittedSupportExploit).status, 0, 'planned units cannot omit direct/supporting keyword evidence');
console.log('rank1 keyword semantic conjunction: OK');
