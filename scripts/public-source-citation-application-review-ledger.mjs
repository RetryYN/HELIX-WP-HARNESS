import { createHash } from "node:crypto";

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const editorialStates = new Set([
  "approved_for_manual_application",
  "changes_requested",
  "rejected",
  "deferred",
]);

export function validateCitationApplicationReviewDecisions(packetOracle, input) {
  if (input?.schema_version !== "citation-application-review-decisions.v1")
    throw new Error("decision schema version mismatch");
  if (input.packet_set_digest !== packetOracle.packet_set_digest)
    throw new Error("citation application packet set digest mismatch");
  if (!/^[a-f0-9]{64}$/u.test(input.reviewer_digest ?? ""))
    throw new Error(
      "reviewer_digest must be a 64-character lowercase SHA-256",
    );
  const packetById = new Map(
      (packetOracle.packets ?? []).map((row) => [row.packet_id, row]),
    ),
    seen = new Set(),
    decisions = [];
  for (const decision of input.decisions ?? []) {
    if (seen.has(decision.packet_id))
      throw new Error(
        `duplicate citation application decision: ${decision.packet_id}`,
      );
    seen.add(decision.packet_id);
    const packet = packetById.get(decision.packet_id);
    if (!packet)
      throw new Error(`unknown citation application packet: ${decision.packet_id}`);
    if (decision.packet_digest !== packet.packet_digest)
      throw new Error(`stale citation application packet: ${decision.packet_id}`);
    if (!editorialStates.has(decision.editorial_state))
      throw new Error(`invalid editorial_state: ${decision.packet_id}`);
    for (const field of [
      "placement_lineage_reviewed",
      "source_decisions_reviewed",
      "body_unchanged_verified",
      "no_unsupported_claim_introduced",
    ])
      if (typeof decision[field] !== "boolean")
        throw new Error(`${field} must be boolean: ${decision.packet_id}`);
    if (
      decision.editorial_state === "approved_for_manual_application" &&
      (!decision.placement_lineage_reviewed ||
        !decision.source_decisions_reviewed ||
        !decision.body_unchanged_verified ||
        !decision.no_unsupported_claim_introduced ||
        !packet.body_text_unchanged)
    )
      throw new Error(
        `manual application approval prerequisites are incomplete: ${decision.packet_id}`,
      );
    if (!/^\d{4}-\d{2}-\d{2}T/u.test(decision.reviewed_at ?? ""))
      throw new Error(`reviewed_at must be ISO-like: ${decision.packet_id}`);
    const base = {
      packet_id: decision.packet_id,
      packet_digest: decision.packet_digest,
      group_id: packet.group_id,
      source_revision_digest: packet.source_revision_digest,
      reviewer_digest: input.reviewer_digest,
      editorial_state: decision.editorial_state,
      placement_lineage_reviewed: decision.placement_lineage_reviewed,
      source_decisions_reviewed: decision.source_decisions_reviewed,
      body_unchanged_verified: decision.body_unchanged_verified,
      no_unsupported_claim_introduced:
        decision.no_unsupported_claim_introduced,
      reviewed_at: decision.reviewed_at,
      notes: String(decision.notes ?? "").slice(0, 2000),
      artifact_applied: false,
      auto_apply: false,
      auto_publication: false,
    };
    decisions.push({ ...base, decision_digest: digest(base) });
  }
  const base = {
    schema_version: "citation-application-review-decisions.v1",
    packet_set_digest: packetOracle.packet_set_digest,
    reviewer_digest: input.reviewer_digest,
    decision_count: decisions.length,
    remaining_count: (packetOracle.packets ?? []).length - decisions.length,
    complete: decisions.length === (packetOracle.packets ?? []).length,
    artifact_applied: false,
    auto_apply: false,
    auto_publication: false,
    decisions,
  };
  return { ...base, decision_set_digest: digest(base) };
}

export function attachCitationApplicationReviewProgress(
  packetOracle,
  decisionSets,
  decisions,
) {
  const validSets = decisionSets.filter(
      (row) => row.packet_set_digest === packetOracle.packet_set_digest,
    ),
    matching = decisions.filter(
      (row) => row.packet_set_digest === packetOracle.packet_set_digest,
    ),
    byPacket = Map.groupBy(matching, (row) => row.packet_id),
    packets = (packetOracle.packets ?? []).map((packet) => {
      const reviews = byPacket.get(packet.packet_id) ?? [],
        states = [...new Set(reviews.map((row) => row.editorial_state))],
        editorialProgressState = !reviews.length
          ? "unreviewed"
          : states.length === 1
            ? states[0]
            : "reviewer_disagreement",
        manualApplicationApproved =
          editorialProgressState === "approved_for_manual_application" &&
          reviews.every(
            (row) =>
              row.placement_lineage_reviewed &&
              row.source_decisions_reviewed &&
              row.body_unchanged_verified &&
              row.no_unsupported_claim_introduced,
          ),
        base = {
          ...packet,
          editorial_progress_state: editorialProgressState,
          review_count: reviews.length,
          reviewer_count: new Set(reviews.map((row) => row.reviewer_digest))
            .size,
          decision_digests: reviews
            .map((row) => row.decision_digest)
            .sort(),
          manual_application_approved: manualApplicationApproved,
          publication_gate_state: manualApplicationApproved
            ? "blocked_pending_manual_application_and_publication_review"
            : "blocked_pending_citation_application_review",
          artifact_applied: false,
          auto_apply: false,
          auto_publication: false,
        };
      return { ...base, progress_digest: digest(base) };
    }),
    progress = {
      reviewer_count: new Set(validSets.map((row) => row.reviewer_digest)).size,
      decision_set_count: validSets.length,
      decision_count: matching.length,
      reviewed_packet_count: packets.filter((row) => row.review_count).length,
      unreviewed_packet_count: packets.filter((row) => !row.review_count).length,
      approved_for_manual_application_count: packets.filter(
        (row) => row.manual_application_approved,
      ).length,
      disagreement_count: packets.filter(
        (row) => row.editorial_progress_state === "reviewer_disagreement",
      ).length,
      artifact_applied_count: 0,
      publication_unblocked_count: 0,
      auto_apply_count: 0,
      auto_publication_count: 0,
    };
  return {
    ...packetOracle,
    packets,
    summary: { ...packetOracle.summary, ...progress },
    decision_progress: progress,
    progress_digest: digest(progress),
  };
}
