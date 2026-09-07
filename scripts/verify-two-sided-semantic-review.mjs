import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (file) => { const bytes = fs.readFileSync(file); return { bytes, value: JSON.parse(bytes) }; };
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const percent = (part, whole) => whole ? Math.round(part / whole * 10000) / 100 : 0;
const mapUnique = (rows, key, label) => {
  const map = new Map();
  for (const row of rows ?? []) {
    assert(typeof row?.[key] === 'string' && row[key], `${label} requires ${key}`);
    assert(!map.has(row[key]), `duplicate ${label}: ${row[key]}`);
    map.set(row[key], row);
  }
  return map;
};
const rationale = (row, label) => assert(typeof row.rationale === 'string' && row.rationale.trim(), `${label} requires rationale`);
const pct = (values, predicate) => percent(values.filter(predicate).length, values.length);
function auditStory(unitIds, transitions, label) {
  if (unitIds.size === 1) return { transition_count: transitions.length, story_unit_coverage_percent: 100, story_connected: true };
  const adjacency = new Map([...unitIds].map((id) => [id, new Set()]));
  const directed = new Map([...unitIds].map((id) => [id, []]));
  const edgeIds = new Set();
  const covered = new Set();
  for (const row of transitions) {
    assert.notEqual(row.from_unit_id, row.to_unit_id, `${label}: self transition`);
    const edgeId = `${row.from_unit_id}\0${row.to_unit_id}`;
    assert(!edgeIds.has(edgeId), `${label}: duplicate transition`);
    edgeIds.add(edgeId); covered.add(row.from_unit_id); covered.add(row.to_unit_id);
    adjacency.get(row.from_unit_id).add(row.to_unit_id); adjacency.get(row.to_unit_id).add(row.from_unit_id);
    directed.get(row.from_unit_id).push(row.to_unit_id);
  }
  const visiting = new Set(); const visited = new Set();
  const visit = (id) => { assert(!visiting.has(id), `${label}: transition cycle`); if (visited.has(id)) return; visiting.add(id); for (const next of directed.get(id)) visit(next); visiting.delete(id); visited.add(id); };
  for (const id of unitIds) visit(id);
  const reached = new Set(); const queue = [unitIds.values().next().value];
  while (queue.length) { const id = queue.shift(); if (reached.has(id)) continue; reached.add(id); queue.push(...adjacency.get(id)); }
  return { transition_count: transitions.length, story_unit_coverage_percent: percent(covered.size, unitIds.size), story_connected: reached.size === unitIds.size };
}

export function verifyTwoSidedReview(ledger, keywordSource, headingSource, review) {
  assert.equal(review.schema_version, 'two-sided-semantic-review-aggregate.v1');
  assert.equal(review.target_demand_ledger_digest, ledger.digest, 'target demand ledger digest mismatch');
  assert.equal(review.acquired_keyword_review_digest, keywordSource.digest, 'acquired keyword review digest mismatch');
  assert.equal(review.heading_review_digest, headingSource.digest, 'heading review digest mismatch');
  const expectedCandidates = ledger.value.candidates.filter((row) => row.observation_state === 'observed');
  const reviewed = mapUnique(review.candidates, 'article_candidate_id', 'review candidate');
  assert.deepEqual(new Set(reviewed.keys()), new Set(expectedCandidates.map((row) => row.article_candidate_id)), 'review must cover every observed candidate');
  const keywordCandidates = mapUnique(keywordSource.value.candidates, 'article_candidate_id', 'keyword source candidate');
  const headingCandidates = mapUnique(headingSource.value.candidates, 'article_candidate_id', 'heading source candidate');
  const results = [];

  for (const source of expectedCandidates) {
    const candidate = reviewed.get(source.article_candidate_id);
    const sourceUnits = mapUnique(source.meaning_units, 'unit_id', `${source.article_candidate_id} source unit`);
    const units = mapUnique(candidate.unit_reviews, 'unit_id', `${source.article_candidate_id} unit review`);
    assert.deepEqual(new Set(units.keys()), new Set(sourceUnits.keys()), `${source.article_candidate_id}: unit coverage mismatch`);
    const demandUnitIds = new Set();
    let editorialRequirements = 0;
    for (const unit of units.values()) {
      assert(['demand', 'editorial', 'mixed'].includes(unit.layer), `${unit.unit_id}: invalid layer`);
      rationale(unit, unit.unit_id);
      assert(Array.isArray(unit.editorial_requirements), `${unit.unit_id}: editorial_requirements required`);
      assert(Array.isArray(unit.supporting_target_evidence_ids), `${unit.unit_id}: supporting evidence required`);
      if (unit.layer === 'demand' || unit.layer === 'mixed') {
        assert(typeof unit.demand_core === 'string' && unit.demand_core.trim(), `${unit.unit_id}: demand_core required`);
        assert(unit.supporting_target_evidence_ids.length, `${unit.unit_id}: demand layer requires observed target evidence`);
        demandUnitIds.add(unit.unit_id);
      } else assert(unit.demand_core == null, `${unit.unit_id}: editorial unit cannot define demand_core`);
      if (unit.layer === 'mixed') assert(unit.editorial_requirements.length, `${unit.unit_id}: mixed unit requires editorial requirements`);
      if (unit.layer === 'editorial') assert(unit.editorial_requirements.length, `${unit.unit_id}: editorial unit requires retained requirements`);
      editorialRequirements += unit.editorial_requirements.length;
    }
    assert(demandUnitIds.size, `${source.article_candidate_id}: no demand units`);

    const sourceDemands = mapUnique(source.target_demands, 'evidence_id', `${source.article_candidate_id} source demand`);
    const demands = mapUnique(candidate.target_demand_reviews, 'evidence_id', `${source.article_candidate_id} demand review`);
    assert.deepEqual(new Set(demands.keys()), new Set(sourceDemands.keys()), `${source.article_candidate_id}: target demand coverage mismatch`);
    for (const row of demands.values()) {
      assert(typeof row.material === 'boolean', `${row.evidence_id}: material required`);
      assert(['main', 'body', 'internal_link', 'separate_article', 'exclude', 'hold'].includes(row.disposition), `${row.evidence_id}: invalid disposition`);
      rationale(row, row.evidence_id);
      assert(Array.isArray(row.matched_unit_ids), `${row.evidence_id}: matched_unit_ids required`);
      for (const unitId of row.matched_unit_ids) {
        assert(demandUnitIds.has(unitId), `${row.evidence_id}: target demand cites non-demand unit`);
        assert(units.get(unitId).supporting_target_evidence_ids.includes(row.evidence_id), `${row.evidence_id}: unit evidence back-reference missing`);
      }
      if (row.material && ['main', 'body'].includes(row.disposition)) assert(row.matched_unit_ids.length, `${row.evidence_id}: used material demand requires a unit`);
      else assert.equal(row.matched_unit_ids.length, 0, `${row.evidence_id}: non-body disposition cannot merge into article`);
    }
    for (const unit of units.values()) {
      for (const evidenceId of unit.supporting_target_evidence_ids) {
        assert(sourceDemands.has(evidenceId), `${unit.unit_id}: unknown target evidence ${evidenceId}`);
        assert(demands.get(evidenceId).matched_unit_ids.includes(unit.unit_id), `${unit.unit_id}: target evidence back-reference missing`);
      }
    }

    const sourceKeywordRows = (keywordCandidates.get(source.article_candidate_id)?.pages ?? []).flatMap((page) => page.keyword_reviews);
    const expectedKeywords = mapUnique(sourceKeywordRows.map((row) => ({ ...row, keyword_id: row.keyword_digest })), 'keyword_id', `${source.article_candidate_id} source keyword`);
    const keywords = mapUnique(candidate.acquired_keyword_reviews, 'keyword_id', `${source.article_candidate_id} acquired keyword review`);
    assert.deepEqual(new Set(keywords.keys()), new Set(expectedKeywords.keys()), `${source.article_candidate_id}: acquired keyword coverage mismatch`);
    const pageUnits = new Set();
    for (const row of keywords.values()) {
      assert.equal(row.text, expectedKeywords.get(row.keyword_id).keyword, `${row.keyword_id}: acquired keyword text mismatch`);
      assert(typeof row.material === 'boolean', `${row.keyword_id}: material required`);
      assert(['common', 'page_only', 'context_only', 'other_intent'].includes(row.relation), `${row.keyword_id}: invalid relation`);
      rationale(row, row.keyword_id);
      assert(Array.isArray(row.matched_unit_ids), `${row.keyword_id}: matched_unit_ids required`);
      if (row.relation === 'common') {
        assert(row.matched_unit_ids.length, `${row.keyword_id}: common keyword requires a unit`);
        for (const unitId of row.matched_unit_ids) { assert(demandUnitIds.has(unitId), `${row.keyword_id}: keyword cites non-demand unit`); pageUnits.add(unitId); }
      } else assert.equal(row.matched_unit_ids.length, 0, `${row.keyword_id}: non-common keyword cannot satisfy demand`);
    }

    const sourceHeading = headingCandidates.get(source.article_candidate_id);
    const expectedHeadingRows = sourceHeading?.observation_state === 'reviewed' ? sourceHeading.heading_reviews : [];
    const expectedHeadings = mapUnique(expectedHeadingRows.map((row) => ({ ...row, heading_id: `${sourceHeading.target_digest}:${row.position}` })), 'heading_id', `${source.article_candidate_id} source heading`);
    const headings = mapUnique(candidate.heading_reviews, 'heading_id', `${source.article_candidate_id} heading review`);
    assert.deepEqual(new Set(headings.keys()), new Set(expectedHeadings.keys()), `${source.article_candidate_id}: heading coverage mismatch`);
    const headingUnits = new Set();
    for (const row of headings.values()) {
      const original = expectedHeadings.get(row.heading_id);
      assert.equal(row.position, original.position, `${row.heading_id}: heading position mismatch`);
      assert(['supported', 'partial', 'gap', 'excluded'].includes(row.classification), `${row.heading_id}: invalid classification`);
      rationale(row, row.heading_id);
      assert(Array.isArray(row.matched_unit_ids), `${row.heading_id}: matched_unit_ids required`);
      if (row.classification === 'supported' || row.classification === 'partial') {
        assert(row.matched_unit_ids.length, `${row.heading_id}: aligned heading requires a unit`);
        for (const unitId of row.matched_unit_ids) { assert(demandUnitIds.has(unitId), `${row.heading_id}: heading cites non-demand unit`); headingUnits.add(unitId); }
      } else assert.equal(row.matched_unit_ids.length, 0, `${row.heading_id}: gap/excluded cannot satisfy demand`);
    }
    const transitions = candidate.transitions ?? [];
    for (const row of transitions) {
      assert.equal(row.state, 'editorial_hypothesis', `${source.article_candidate_id}: transition must remain hypothetical`);
      assert(demandUnitIds.has(row.from_unit_id) && demandUnitIds.has(row.to_unit_id), `${source.article_candidate_id}: transition cites non-demand unit`);
      assert(Array.isArray(row.evidence_ids) && row.evidence_ids.length, `${source.article_candidate_id}: transition evidence required`);
      for (const evidenceId of row.evidence_ids) assert(sourceDemands.has(evidenceId), `${source.article_candidate_id}: transition cites unknown evidence`);
      rationale(row, `${source.article_candidate_id} transition`);
    }
    const story = auditStory(demandUnitIds, transitions, source.article_candidate_id);
    assert(Array.isArray(candidate.false_merges), `${source.article_candidate_id}: false_merges required`);
    let rejectedFalseMerges = 0;
    let unresolvedFalseMerges = 0;
    for (const row of candidate.false_merges) {
      assert(['rejected_demand_entailment', 'unresolved'].includes(row.kind), `${source.article_candidate_id}: invalid false merge state`);
      assert(units.has(row.unit_id), `${source.article_candidate_id}: false merge cites unknown unit`);
      assert(Array.isArray(row.evidence_ids) && row.evidence_ids.length, `${source.article_candidate_id}: false merge evidence required`);
      for (const evidenceId of row.evidence_ids) assert(sourceDemands.has(evidenceId), `${source.article_candidate_id}: false merge cites unknown evidence`);
      rationale(row, `${source.article_candidate_id} false merge`);
      if (row.kind === 'rejected_demand_entailment') rejectedFalseMerges += 1;
      else unresolvedFalseMerges += 1;
    }
    const demandRows = [...demandUnitIds].map((unitId) => ({ unit_id: unitId, page_keyword_agreement: pageUnits.has(unitId), heading_alignment: headingUnits.has(unitId), conjunction: pageUnits.has(unitId) && headingUnits.has(unitId) }));
    const metrics = {
      demand_units: demandRows.length,
      editorial_requirements: editorialRequirements,
      target_demand_rows: demands.size,
      acquired_keywords: keywords.size,
      headings: headings.size,
      page_keyword_agreement_percent: pct(demandRows, (row) => row.page_keyword_agreement),
      heading_alignment_percent: pct(demandRows, (row) => row.heading_alignment),
      conjunction_percent: pct(demandRows, (row) => row.conjunction),
      rejected_false_merge_count: rejectedFalseMerges,
      unresolved_false_merge_count: unresolvedFalseMerges,
      ...story,
    };
    const pass = metrics.page_keyword_agreement_percent >= 90 && metrics.heading_alignment_percent >= 90 && metrics.conjunction_percent >= 90 && metrics.unresolved_false_merge_count === 0 && metrics.story_unit_coverage_percent === 100 && metrics.story_connected;
    results.push({ article_candidate_id: source.article_candidate_id, ...metrics, verdict: pass ? 'PASS' : 'FAIL' });
  }
  const passed = results.filter((row) => row.verdict === 'PASS').length;
  const totalCandidates = ledger.value.candidates.length;
  return {
    schema_version: 'two-sided-semantic-review-verification.v1',
    thresholds: { page_keyword_agreement_percent: 90, heading_alignment_percent: 90, conjunction_percent: 90, unresolved_false_merge_count: 0, story_unit_coverage_percent: 100, story_connected: true },
    candidates: results,
    summary: { total_candidates: totalCandidates, reviewed_candidates: results.length, review_coverage_percent: percent(results.length, totalCandidates), unobserved_candidates: totalCandidates - results.length, passed_candidates: passed, reviewed_candidate_pass_percent: percent(passed, expectedCandidates.length), candidate_pass_percent: percent(passed, totalCandidates), demand_units: results.reduce((sum, row) => sum + row.demand_units, 0), editorial_requirements: results.reduce((sum, row) => sum + row.editorial_requirements, 0), target_demand_rows: results.reduce((sum, row) => sum + row.target_demand_rows, 0), acquired_keywords: results.reduce((sum, row) => sum + row.acquired_keywords, 0), headings: results.reduce((sum, row) => sum + row.headings, 0), transitions: results.reduce((sum, row) => sum + row.transition_count, 0), story_ready_candidates: results.filter((row) => row.story_connected && row.story_unit_coverage_percent === 100).length, rejected_false_merges: results.reduce((sum, row) => sum + row.rejected_false_merge_count, 0), unresolved_false_merges: results.reduce((sum, row) => sum + row.unresolved_false_merge_count, 0) },
    non_claims: ['PASS is not a ranking guarantee or publication approval.', 'Transitions are editorial hypotheses, not observed journeys.', 'Unobserved canonical queries are excluded from review but remain incomplete.'],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [ledgerPath, keywordPath, headingPath, reviewPath] = process.argv.slice(2);
  if (!reviewPath) throw new Error('usage: node scripts/verify-two-sided-semantic-review.mjs LEDGER KEYWORDS HEADINGS REVIEW');
  const ledger = read(ledgerPath); const keywords = read(keywordPath); const headings = read(headingPath); const review = read(reviewPath);
  console.log(JSON.stringify(verifyTwoSidedReview({ ...ledger, digest: digest(ledger.bytes) }, { ...keywords, digest: digest(keywords.bytes) }, { ...headings, digest: digest(headings.bytes) }, review.value), null, 2));
}
