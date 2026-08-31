import { createHash } from "node:crypto";

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const unique = (values) => [...new Set(values)];

export function buildPublicSourceCitationApplicationPackets(
  reviewPacket,
  structures,
) {
  const structuresByGroup = new Map(
    structures.map((row) => [row.group_id, row]),
  );
  const eligible = (reviewPacket.items ?? []).filter(
    (row) => row.claim_use_approved,
  );
  const blocked = (reviewPacket.items ?? [])
    .filter((row) => !row.claim_use_approved)
    .map((row) => ({
      review_id: row.review_id,
      claim_id: row.claim_id,
      group_id: row.group_id,
      editorial_progress_state: row.editorial_progress_state,
      blocker_codes: [
        row.editorial_progress_state === "unreviewed"
          ? "source_review_pending"
          : row.editorial_progress_state === "reviewer_disagreement"
            ? "source_review_disagreement"
            : "source_review_not_approved",
      ],
      review_digest: row.review_digest,
      progress_digest: row.progress_digest,
    }));
  const packets = [];
  for (const [groupId, reviews] of Map.groupBy(
    eligible,
    (row) => row.group_id,
  )) {
    const source =
      structuresByGroup.get(groupId)?.draft_package?.draft_revision;
    if (!source)
      throw new Error(
        `approved source review has no retained draft: ${groupId}`,
      );
    const claims = structuredClone(source.claims),
      sections = structuredClone(source.sections),
      citationRecommendations = structuredClone(
        source.citation_recommendations ?? [],
      ),
      placements = [];
    for (const review of reviews) {
      const claim = claims.find((row) => row.claim_id === review.claim_id),
        section = sections.find((row) => row.section_id === review.claim_id),
        paragraph = section?.paragraphs.find((row) =>
          row.claim_ids.includes(review.claim_id),
        );
      if (!claim || !section || !paragraph)
        throw new Error(
          `approved source review cannot resolve draft claim: ${review.claim_id}`,
        );
      const citationId = `public-source-citation:${digest({ review_id: review.review_id, url: review.url }).slice(0, 24)}`,
        recommendation = {
          citation_id: citationId,
          claim_id: review.claim_id,
          url: review.url,
          domain: new URL(review.url).hostname.replace(/^www\./u, ""),
          title: review.title,
          publisher: review.publisher,
          source_class: review.source_class,
          source_requirement: review.source_requirement,
          approval_state: "approved_for_claim_use",
          placement_state: "proposed_after_claim_paragraph",
          review_id: review.review_id,
          review_digest: review.review_digest,
          decision_digests: [...review.decision_digests],
          evidence_digest: review.evidence_digest,
          source_text_digest: review.source_text_digest,
          auto_apply: false,
          auto_publication: false,
        };
      citationRecommendations.push(recommendation);
      claim.citation_ids = unique([...(claim.citation_ids ?? []), citationId]);
      claim.evidence_ids = unique([
        ...(claim.evidence_ids ?? []),
        review.evidence_digest,
      ]);
      claim.verification_state =
        "source_review_approved_pending_application_review";
      section.evidence_ids = unique([
        ...(section.evidence_ids ?? []),
        review.evidence_digest,
      ]);
      placements.push({
        claim_id: review.claim_id,
        paragraph_id: paragraph.paragraph_id,
        citation_id: citationId,
        review_id: review.review_id,
        review_digest: review.review_digest,
        decision_digests: [...review.decision_digests],
        placement_state: "proposed_not_applied",
      });
    }
    const after = {
        title: source.title,
        sections,
        claims,
        evidence_ids: unique([
          ...source.evidence_ids,
          ...reviews.map((row) => row.evidence_digest),
        ]),
        citation_ids: unique([
          ...source.citation_ids,
          ...placements.map((row) => row.citation_id),
        ]),
        citation_recommendations: citationRecommendations,
        text: source.text,
        html: source.html,
      },
      base = {
        packet_id: `public-source-citation-application:${groupId}:${source.revision + 1}`,
        group_id: groupId,
        source_revision: source.revision,
        proposed_revision: source.revision + 1,
        source_revision_digest: source.revision_digest,
        review_packet_digest: reviewPacket.packet_digest,
        approved_review_ids: reviews.map((row) => row.review_id).sort(),
        placements,
        before: {
          evidence_ids: source.evidence_ids,
          citation_ids: source.citation_ids,
          citation_recommendations: source.citation_recommendations ?? [],
          text: source.text,
          html: source.html,
          revision_digest: source.revision_digest,
        },
        after: { ...after, artifact_digest: digest(after) },
        body_text_unchanged:
          after.text === source.text && after.html === source.html,
        review_state: "manual_citation_application_review_required",
        publication_gate_state:
          "blocked_pending_citation_application_and_publication_review",
        publication_blocker_codes: [
          "citation_application_review_pending",
          "claim_verification_review_pending",
          "publication_review_pending",
        ],
        artifact_applied: false,
        auto_apply: false,
        auto_approval: false,
        auto_publication: false,
      };
    if (!base.body_text_unchanged)
      throw new Error(`citation application mutated draft body: ${groupId}`);
    packets.push({ ...base, packet_digest: digest(base) });
  }
  packets.sort((a, b) => a.group_id.localeCompare(b.group_id));
  const summary = {
    eligible_review_count: eligible.length,
    blocked_review_count: blocked.length,
    packet_count: packets.length,
    group_count: new Set(packets.map((row) => row.group_id)).size,
    proposed_citation_count: packets.reduce(
      (sum, row) => sum + row.placements.length,
      0,
    ),
    body_mutation_count: 0,
    artifact_applied_count: 0,
    publication_unblocked_count: 0,
    auto_apply_count: 0,
    auto_approval_count: 0,
    auto_publication_count: 0,
  };
  return {
    packets,
    blocked_reviews: blocked,
    summary,
    policy: "public-source-citation-application-packet.v1",
    packet_set_digest: digest({ packets, blocked }),
  };
}
