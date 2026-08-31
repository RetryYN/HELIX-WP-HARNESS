import assert from "node:assert/strict";
import {
  attachCitationApplicationReviewProgress,
  validateCitationApplicationReviewDecisions,
} from "./public-source-citation-application-review-ledger.mjs";

const packet = {
    packet_id: "public-source-citation-application:g:2",
    packet_digest: "a".repeat(64),
    group_id: "g",
    source_revision_digest: "b".repeat(64),
    body_text_unchanged: true,
  },
  oracle = {
    packets: [packet],
    blocked_reviews: [],
    summary: { packet_count: 1 },
    packet_set_digest: "c".repeat(64),
  },
  input = {
    schema_version: "citation-application-review-decisions.v1",
    packet_set_digest: oracle.packet_set_digest,
    reviewer_digest: "d".repeat(64),
    decisions: [
      {
        packet_id: packet.packet_id,
        packet_digest: packet.packet_digest,
        editorial_state: "approved_for_manual_application",
        placement_lineage_reviewed: true,
        source_decisions_reviewed: true,
        body_unchanged_verified: true,
        no_unsupported_claim_introduced: true,
        reviewed_at: "2026-08-31T15:00:00.000Z",
        notes: "manual application may proceed after separate execution review",
      },
    ],
  },
  validated = validateCitationApplicationReviewDecisions(oracle, input);
assert.equal(validated.decision_count, 1);
assert.equal(validated.complete, true);
assert.equal(validated.decisions[0].artifact_applied, false);
assert.equal(validated.decisions[0].auto_apply, false);
assert.equal(validated.decisions[0].auto_publication, false);
const attached = attachCitationApplicationReviewProgress(
  oracle,
  [validated],
  validated.decisions.map((row) => ({
    ...row,
    packet_set_digest: oracle.packet_set_digest,
  })),
);
assert.equal(attached.packets[0].manual_application_approved, true);
assert.equal(
  attached.packets[0].publication_gate_state,
  "blocked_pending_manual_application_and_publication_review",
);
assert.equal(attached.summary.artifact_applied_count, 0);
assert.equal(attached.summary.publication_unblocked_count, 0);
for (const field of [
  "placement_lineage_reviewed",
  "source_decisions_reviewed",
  "body_unchanged_verified",
  "no_unsupported_claim_introduced",
]) {
  assert.throws(
    () =>
      validateCitationApplicationReviewDecisions(oracle, {
        ...input,
        decisions: [{ ...input.decisions[0], [field]: false }],
      }),
    /approval prerequisites/u,
  );
}
assert.throws(
  () =>
    validateCitationApplicationReviewDecisions(oracle, {
      ...input,
      packet_set_digest: "e".repeat(64),
    }),
  /packet set digest mismatch/u,
);
assert.throws(
  () =>
    validateCitationApplicationReviewDecisions(oracle, {
      ...input,
      decisions: [...input.decisions, input.decisions[0]],
    }),
  /duplicate/u,
);
console.log(
  "citation application review ledger: OK (digest-bound approval prerequisites, progress, zero apply/publication)",
);
