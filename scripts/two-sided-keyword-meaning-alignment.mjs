import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const percent = (part, whole) => whole ? Math.round(part / whole * 10000) / 100 : 0;
const dispositions = new Set(['main', 'body', 'internal_link', 'separate_article', 'exclude', 'hold']);
const pageRelations = new Set(['common', 'page_only', 'context_only', 'other_intent']);
const headingClasses = new Set(['supported', 'partial', 'gap', 'excluded']);

function uniqueMap(rows, key, label) {
  assert(Array.isArray(rows), `${label} must be an array`);
  const map = new Map();
  for (const row of rows) {
    assert(typeof row?.[key] === 'string' && row[key], `${label} requires ${key}`);
    assert(!map.has(row[key]), `duplicate ${label} ${key}: ${row[key]}`);
    map.set(row[key], row);
  }
  return map;
}

function requireRationale(row, label) {
  assert(typeof row.rationale === 'string' && row.rationale.trim(), `${label} requires rationale`);
}

export function evaluateTwoSidedAlignment(packet) {
  assert.equal(packet.schema_version, 'two-sided-keyword-meaning-alignment.v1');
  assert(typeof packet.canonical_query === 'string' && packet.canonical_query.trim(), 'canonical_query required');
  assert.equal(packet.canonical_query_digest, sha256(packet.canonical_query), 'canonical query digest mismatch');
  for (const key of ['target_snapshot_digest', 'rank1_target_digest', 'page_snapshot_digest']) {
    assert(/^[a-f0-9]{64}$/.test(packet[key] ?? ''), `${key} must be a sha256 digest`);
  }

  const units = uniqueMap(packet.meaning_units, 'unit_id', 'meaning unit');
  const targetEvidence = uniqueMap(packet.target_demands, 'evidence_id', 'target demand');
  const pageKeywords = uniqueMap(packet.page_keywords, 'keyword_id', 'page keyword');
  const headings = uniqueMap(packet.heading_reviews, 'heading_id', 'heading review');
  const demandUnitIds = new Set();
  const editorialUnitIds = new Set();
  for (const unit of units.values()) {
    assert(['demand', 'editorial'].includes(unit.layer), `${unit.unit_id}: invalid layer`);
    requireRationale(unit, unit.unit_id);
    (unit.layer === 'demand' ? demandUnitIds : editorialUnitIds).add(unit.unit_id);
  }
  assert(demandUnitIds.size, 'at least one demand meaning unit required');

  const targetByUnit = new Map([...demandUnitIds].map((id) => [id, new Set()]));
  for (const row of targetEvidence.values()) {
    assert(typeof row.text === 'string' && row.text.trim(), `${row.evidence_id}: text required`);
    assert(typeof row.material === 'boolean', `${row.evidence_id}: material must be boolean`);
    assert(dispositions.has(row.disposition), `${row.evidence_id}: invalid disposition`);
    requireRationale(row, row.evidence_id);
    assert(Array.isArray(row.unit_ids), `${row.evidence_id}: unit_ids required`);
    for (const unitId of row.unit_ids) {
      assert(demandUnitIds.has(unitId), `${row.evidence_id}: target demand may cite only demand units`);
      targetByUnit.get(unitId).add(row.evidence_id);
    }
    if (row.material && !['exclude', 'hold'].includes(row.disposition)) {
      assert(row.unit_ids.length, `${row.evidence_id}: used material demand requires a demand unit`);
    }
  }

  const pageByUnit = new Map([...demandUnitIds].map((id) => [id, new Set()]));
  let materialPageKeywords = 0;
  for (const row of pageKeywords.values()) {
    assert(typeof row.text === 'string' && row.text.trim(), `${row.keyword_id}: text required`);
    assert(typeof row.material === 'boolean', `${row.keyword_id}: material must be boolean`);
    assert(pageRelations.has(row.relation), `${row.keyword_id}: invalid relation`);
    requireRationale(row, row.keyword_id);
    assert(Array.isArray(row.unit_ids), `${row.keyword_id}: unit_ids required`);
    if (row.material) materialPageKeywords += 1;
    if (row.relation === 'common') {
      assert(row.unit_ids.length, `${row.keyword_id}: common keyword requires a demand unit`);
      for (const unitId of row.unit_ids) {
        assert(demandUnitIds.has(unitId), `${row.keyword_id}: page keyword may cite only demand units`);
        pageByUnit.get(unitId).add(row.keyword_id);
      }
    } else {
      assert.equal(row.unit_ids.length, 0, `${row.keyword_id}: non-common keyword cannot satisfy demand`);
    }
  }

  const headingByUnit = new Map([...demandUnitIds].map((id) => [id, new Set()]));
  for (const row of headings.values()) {
    assert(headingClasses.has(row.classification), `${row.heading_id}: invalid classification`);
    requireRationale(row, row.heading_id);
    assert(Array.isArray(row.unit_ids), `${row.heading_id}: unit_ids required`);
    if (row.classification === 'supported' || row.classification === 'partial') {
      assert(row.unit_ids.length, `${row.heading_id}: aligned heading requires a demand unit`);
      for (const unitId of row.unit_ids) {
        assert(demandUnitIds.has(unitId), `${row.heading_id}: heading may cite only demand units`);
        headingByUnit.get(unitId).add(row.heading_id);
      }
    } else {
      assert.equal(row.unit_ids.length, 0, `${row.heading_id}: gap/excluded heading cannot satisfy demand`);
    }
  }

  for (const transition of packet.transitions ?? []) {
    assert.equal(transition.state, 'editorial_hypothesis', 'transition must remain an editorial hypothesis');
    assert(units.has(transition.from_unit_id) && units.has(transition.to_unit_id), 'transition references unknown unit');
    assert(Array.isArray(transition.evidence_ids) && transition.evidence_ids.length, 'transition requires evidence');
    for (const evidenceId of transition.evidence_ids) assert(targetEvidence.has(evidenceId), `transition references unknown evidence: ${evidenceId}`);
    requireRationale(transition, 'transition');
  }

  const demandResults = [...demandUnitIds].map((unitId) => ({
    unit_id: unitId,
    target_evidence_count: targetByUnit.get(unitId).size,
    common_page_keyword_count: pageByUnit.get(unitId).size,
    aligned_heading_count: headingByUnit.get(unitId).size,
    target_observed: targetByUnit.get(unitId).size > 0,
    page_keyword_agreement: pageByUnit.get(unitId).size > 0,
    heading_alignment: headingByUnit.get(unitId).size > 0,
  }));
  const targetObserved = demandResults.filter((row) => row.target_observed).length;
  const pageAgreed = demandResults.filter((row) => row.page_keyword_agreement).length;
  const headingAligned = demandResults.filter((row) => row.heading_alignment).length;
  const conjunction = demandResults.filter((row) => row.target_observed && row.page_keyword_agreement && row.heading_alignment).length;
  const falseMerges = packet.false_merges ?? [];
  assert(Array.isArray(falseMerges), 'false_merges must be an array');
  const summary = {
    demand_units: demandUnitIds.size,
    editorial_requirements: editorialUnitIds.size,
    material_target_demands: [...targetEvidence.values()].filter((row) => row.material).length,
    material_page_keywords: materialPageKeywords,
    target_observed_percent: percent(targetObserved, demandUnitIds.size),
    page_keyword_agreement_percent: percent(pageAgreed, demandUnitIds.size),
    heading_alignment_percent: percent(headingAligned, demandUnitIds.size),
    final_conjunction_percent: percent(conjunction, demandUnitIds.size),
    false_merge_count: falseMerges.length,
  };
  const pass = summary.target_observed_percent === 100
    && summary.page_keyword_agreement_percent >= 90
    && summary.heading_alignment_percent >= 90
    && summary.final_conjunction_percent >= 90
    && summary.false_merge_count === 0;
  return {
    schema_version: 'two-sided-keyword-meaning-alignment-result.v1',
    binding: {
      canonical_query_digest: packet.canonical_query_digest,
      target_snapshot_digest: packet.target_snapshot_digest,
      rank1_target_digest: packet.rank1_target_digest,
      page_snapshot_digest: packet.page_snapshot_digest,
    },
    thresholds: { target_observed_percent: 100, page_keyword_agreement_percent: 90, heading_alignment_percent: 90, final_conjunction_percent: 90, false_merge_count: 0 },
    summary,
    demand_units: demandResults,
    editorial_requirements: [...editorialUnitIds],
    verdict: pass ? 'PASS' : 'FAIL',
    non_claims: ['PASS is not a ranking guarantee.', 'Transitions are editorial hypotheses, not observed user journeys.', 'Editorial requirements are retained but excluded from search-demand coverage denominators.'],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const fs = await import('node:fs');
  const input = process.argv[2];
  if (!input) throw new Error('usage: node scripts/two-sided-keyword-meaning-alignment.mjs PACKET.json');
  console.log(JSON.stringify(evaluateTwoSidedAlignment(JSON.parse(fs.readFileSync(input, 'utf8'))), null, 2));
}
