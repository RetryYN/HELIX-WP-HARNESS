import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { evaluateTwoSidedAlignment } from './two-sided-keyword-meaning-alignment.mjs';

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const query = 'main query';
const base = {
  schema_version: 'two-sided-keyword-meaning-alignment.v1',
  canonical_query: query,
  canonical_query_digest: digest(query),
  target_snapshot_digest: digest('target'),
  rank1_target_digest: digest('url'),
  page_snapshot_digest: digest('page'),
  meaning_units: [
    { unit_id: 'd1', layer: 'demand', rationale: 'observed question' },
    { unit_id: 'e1', layer: 'editorial', rationale: 'citation safety requirement' },
  ],
  target_demands: [{ evidence_id: 't1', text: 'related question', material: true, disposition: 'body', unit_ids: ['d1'], rationale: 'same reader and answer' }],
  page_keywords: [{ keyword_id: 'k1', text: 'ranked query', material: true, relation: 'common', unit_ids: ['d1'], rationale: 'same demand meaning' }],
  heading_reviews: [{ heading_id: 'h1', classification: 'partial', unit_ids: ['d1'], rationale: 'heading answers the observed question' }],
  transitions: [{ from_unit_id: 'd1', to_unit_id: 'e1', state: 'editorial_hypothesis', evidence_ids: ['t1'], rationale: 'editorial ordering only' }],
  false_merges: [],
};

const pass = evaluateTwoSidedAlignment(base);
assert.equal(pass.verdict, 'PASS');
assert.equal(pass.summary.demand_units, 1);
assert.equal(pass.summary.editorial_requirements, 1);
assert.equal(pass.summary.final_conjunction_percent, 100);

const missingPage = structuredClone(base);
missingPage.page_keywords[0] = { ...missingPage.page_keywords[0], relation: 'context_only', unit_ids: [] };
assert.equal(evaluateTwoSidedAlignment(missingPage).verdict, 'FAIL');

const hiddenMaterial = structuredClone(base);
delete hiddenMaterial.target_demands[0].disposition;
assert.throws(() => evaluateTwoSidedAlignment(hiddenMaterial));

const fakeTransition = structuredClone(base);
fakeTransition.transitions[0].state = 'observed';
assert.throws(() => evaluateTwoSidedAlignment(fakeTransition));

const editorialInflation = structuredClone(base);
editorialInflation.heading_reviews[0].unit_ids = ['e1'];
assert.throws(() => evaluateTwoSidedAlignment(editorialInflation));

const falseMerge = structuredClone(base);
falseMerge.false_merges = [{ left: 'd1', right: 'x' }];
assert.equal(evaluateTwoSidedAlignment(falseMerge).verdict, 'FAIL');

console.log('two-sided keyword meaning alignment: OK');
