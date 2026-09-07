import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (file) => {
  const bytes = fs.readFileSync(file);
  return { bytes, value: JSON.parse(bytes) };
};
const unique = (values) => [...new Set(values)];

export function projectTargetDemandLedger(source, targets, bindings = {}) {
  const plans = source?.plans?.plans;
  const packets = source?.packets;
  const assignments = targets?.assignments;
  assert(Array.isArray(plans) && Array.isArray(packets) && Array.isArray(assignments), 'plans, packets, and assignments are required');
  const packetByTask = new Map();
  for (const packet of packets) {
    assert(typeof packet.task_id === 'string' && packet.task_id, 'packet task_id required');
    assert(!packetByTask.has(packet.task_id), `duplicate packet task: ${packet.task_id}`);
    packetByTask.set(packet.task_id, packet);
  }
  const targetByCandidate = new Map();
  for (const target of assignments) {
    assert(typeof target.article_candidate_id === 'string' && target.article_candidate_id, 'target candidate id required');
    assert(!targetByCandidate.has(target.article_candidate_id), `duplicate target candidate: ${target.article_candidate_id}`);
    targetByCandidate.set(target.article_candidate_id, target);
  }
  assert.deepEqual(new Set(plans.map((row) => row.article_candidate_id)), new Set(targetByCandidate.keys()), 'targets must cover every plan');

  const candidates = plans.map((plan) => {
    const target = targetByCandidate.get(plan.article_candidate_id);
    const unitIds = new Set();
    const sourceTaskIds = [];
    const evidenceToUnits = new Map();
    const meaningUnits = plan.sections.map((section) => {
      assert(typeof section.problem_id === 'string' && section.problem_id, `${plan.article_candidate_id}: problem_id required`);
      assert(!unitIds.has(section.problem_id), `${plan.article_candidate_id}: duplicate problem_id ${section.problem_id}`);
      unitIds.add(section.problem_id);
      const taskIds = unique(section.source_task_ids ?? []);
      assert(taskIds.length, `${section.problem_id}: source task required`);
      sourceTaskIds.push(...taskIds);
      const evidenceIds = unique((section.evidence ?? []).flatMap((row) => row.evidence_ids ?? []));
      for (const evidenceId of evidenceIds) {
        if (!evidenceToUnits.has(evidenceId)) evidenceToUnits.set(evidenceId, new Set());
        evidenceToUnits.get(evidenceId).add(section.problem_id);
      }
      return {
        unit_id: section.problem_id,
        reader_condition: section.reader_condition,
        question_to_resolve: section.question_to_resolve,
        answer_scope: section.answer_scope,
        expected_reader_outcomes: section.expected_reader_outcomes ?? [],
        source_task_ids: taskIds,
        evidence_ids: evidenceIds,
        demand_evidence_ids: [],
        other_evidence_ids: [],
        layer_state: 'review_required',
        demand_core: null,
        editorial_requirements: [],
      };
    });
    const taskIds = unique(sourceTaskIds);
    const demandRows = [];
    for (const taskId of taskIds) {
      const packet = packetByTask.get(taskId);
      assert(packet, `${plan.article_candidate_id}: missing source packet ${taskId}`);
      for (const observation of packet.demand_observations ?? []) {
        assert(typeof observation.evidence_id === 'string' && observation.evidence_id, `${taskId}: evidence_id required`);
        demandRows.push({
          evidence_id: observation.evidence_id,
          task_id: taskId,
          source_keyword: observation.source_keyword ?? packet.keyword,
          kind: observation.kind,
          text: observation.text,
          observed_at: observation.observed_at,
          snapshot_digest: observation.snapshot_digest,
          recursion_depth: observation.recursion_depth,
          cited_by_unit_ids: [...(evidenceToUnits.get(observation.evidence_id) ?? [])],
          review_state: 'review_required',
          disposition: null,
          rationale: null,
        });
      }
    }
    const demandIds = demandRows.map((row) => row.evidence_id);
    assert.equal(new Set(demandIds).size, demandIds.length, `${plan.article_candidate_id}: duplicate demand evidence across source tasks`);
    const demandIdSet = new Set(demandIds);
    for (const unit of meaningUnits) {
      unit.demand_evidence_ids = unit.evidence_ids.filter((evidenceId) => demandIdSet.has(evidenceId));
      unit.other_evidence_ids = unit.evidence_ids.filter((evidenceId) => !demandIdSet.has(evidenceId));
    }
    const observed = target.state === 'observed';
    if (observed) {
      assert(taskIds.includes(target.task_id), `${plan.article_candidate_id}: canonical task is outside article source tasks`);
      assert(typeof target.keyword === 'string' && target.keyword, `${plan.article_candidate_id}: canonical keyword required`);
      assert(typeof target.rank1_url === 'string' && target.rank1_url, `${plan.article_candidate_id}: rank1 target required`);
    }
    return {
      article_candidate_id: plan.article_candidate_id,
      observation_state: observed ? 'observed' : 'canonical_query_not_observed',
      canonical_task_id: observed ? target.task_id : null,
      canonical_keyword: observed ? target.keyword : null,
      rank1_target: observed ? target.rank1_url : null,
      source_task_ids: taskIds,
      meaning_units: meaningUnits,
      target_demands: demandRows,
      review_state: 'review_required',
    };
  });
  return {
    schema_version: 'target-demand-ledger.v1',
    source_digest: bindings.source_digest ?? null,
    canonical_targets_digest: bindings.canonical_targets_digest ?? null,
    candidates,
    summary: {
      candidates: candidates.length,
      observed_candidates: candidates.filter((row) => row.observation_state === 'observed').length,
      unobserved_candidates: candidates.filter((row) => row.observation_state !== 'observed').length,
      meaning_units: candidates.reduce((sum, row) => sum + row.meaning_units.length, 0),
      target_demand_contexts: candidates.reduce((sum, row) => sum + row.target_demands.length, 0),
      reviewed_candidates: 0,
    },
    non_claims: [
      'A source query shared by candidates is reviewed separately in each article context.',
      'Only the canonical query supplies the rank-one target; other source queries do not lend their rank-one URLs.',
      'Demand observations are search features, not observed user transitions.',
    ],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [sourcePath, targetsPath] = process.argv.slice(2);
  if (!sourcePath || !targetsPath) throw new Error('usage: node scripts/project-target-demand-ledger.mjs SOURCE.json TARGETS.json');
  const source = read(sourcePath);
  const targets = read(targetsPath);
  console.log(JSON.stringify(projectTargetDemandLedger(source.value, targets.value, {
    source_digest: digest(source.bytes),
    canonical_targets_digest: digest(targets.bytes),
  }), null, 2));
}
