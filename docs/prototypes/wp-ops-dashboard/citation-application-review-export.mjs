const sha256Hex = async (value) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export async function buildCitationApplicationReviewDecisionExport(
  packetSetDigest,
  reviewerIdentifier,
  decisions,
) {
  const reviewer = String(reviewerIdentifier ?? "").trim();
  if (!reviewer) throw new Error("reviewer identifier is required");
  if (!/^[a-f0-9]{64}$/u.test(packetSetDigest ?? ""))
    throw new Error("citation application packet set digest is required");
  if (!decisions?.length)
    throw new Error("at least one citation application decision is required");
  return {
    schema_version: "citation-application-review-decisions.v1",
    packet_set_digest: packetSetDigest,
    reviewer_digest: await sha256Hex(
      `helix-citation-application-reviewer.v1\0${reviewer}`,
    ),
    decisions,
  };
}
