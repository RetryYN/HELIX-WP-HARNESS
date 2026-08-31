import assert from "node:assert/strict";
import { buildContentReadinessOracle } from "./content-readiness-oracle.mjs";

const groups = [{ id: "g", main_keyword: "IT就活", wp_article_id: null }],
  structures = [
    {
      group_id: "g",
      composition: {
        review_state: "ready",
        selected_heading_ids: [],
        composition_digest: "c",
      },
      draft_package: {
        draft_revision: {
          revision_digest: "d",
          review: {
            claim_count: 1,
            verified_claim_count: 1,
            citation_candidate_count: 1,
            approved_citation_count: 1,
          },
        },
      },
    },
  ],
  titles = {
    rows: [
      {
        group_id: "g",
        repair_id: "t",
        review_state: "ready_for_editor_review",
      },
    ],
  },
  headings = { rows: [] },
  topology = { rows: [] },
  baseTask = {
    task_id: "semantic-resolution:g:concept",
    group_id: "g",
    sense_evidence_readiness_state: "unique_path_supported_sense",
  };
const pendingPacket = {
    packet_digest: "a".repeat(64),
    items: [{ ...baseTask, resolution_progress_state: "unreviewed" }],
  },
  pending = buildContentReadinessOracle(
    groups,
    structures,
    titles,
    headings,
    topology,
    { rows: [] },
    { rows: [] },
    { group_rows: [] },
    pendingPacket,
  ).rows[0];
assert.equal(pending.publication_state, "editor_review_required");
assert(pending.review_codes.includes("semantic_sense_resolution"));
assert.equal(pending.semantic_resolution.pending_count, 1);
assert.deepEqual(pending.semantic_resolution.pending_task_ids, [
  baseTask.task_id,
]);
assert.equal(
  pending.semantic_resolution.decision_packet_digest,
  pendingPacket.packet_digest,
);
assert.equal(pending.semantic_resolution.context_relevance_inferred, false);
assert.equal(pending.semantic_resolution.auto_approval, false);
const approvedPacket = {
    packet_digest: "b".repeat(64),
    items: [
      {
        ...baseTask,
        resolution_progress_state: "resolved_editor_approved_for_consideration",
      },
    ],
  },
  approved = buildContentReadinessOracle(
    groups,
    structures,
    titles,
    headings,
    topology,
    { rows: [] },
    { rows: [] },
    { group_rows: [] },
    approvedPacket,
  ).rows[0];
assert(!approved.review_codes.includes("semantic_sense_resolution"));
assert.equal(approved.semantic_resolution.pending_count, 0);
assert.equal(
  approved.semantic_resolution.progress_counts
    .resolved_editor_approved_for_consideration,
  1,
);
assert.equal(approved.policy, "content-readiness-oracle.v5");
console.log(
  "content semantic readiness gate: OK (pending tasks fail closed, approved decisions retain packet lineage, no auto approval)",
);
