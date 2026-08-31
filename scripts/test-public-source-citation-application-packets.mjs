import assert from "node:assert/strict";
import { buildPublicSourceCitationApplicationPackets } from "./public-source-citation-application-packets.mjs";

const source = {
    revision: 1,
    revision_digest: "a".repeat(64),
    title: "Title",
    sections: [
      {
        section_id: "c",
        paragraphs: [{ paragraph_id: "p", text: "Body", claim_ids: ["c"] }],
        evidence_ids: ["e"],
      },
    ],
    claims: [
      {
        claim_id: "c",
        text: "Body",
        evidence_ids: ["e"],
        citation_ids: [],
        verification_state: "pending_primary_source",
      },
    ],
    evidence_ids: ["e"],
    citation_ids: [],
    citation_recommendations: [],
    text: "Title\nBody",
    html: "<article>Body</article>",
  },
  structure = { group_id: "g", draft_package: { draft_revision: source } },
  approved = {
    review_id: "public-source-review:c",
    claim_id: "c",
    group_id: "g",
    url: "https://official.example/source",
    title: "Source",
    publisher: "Publisher",
    source_class: "government",
    source_requirement: "official",
    review_digest: "b".repeat(64),
    decision_digests: ["d".repeat(64)],
    evidence_digest: "e".repeat(64),
    source_text_digest: "f".repeat(64),
    editorial_progress_state: "approved_for_claim_use",
    claim_use_approved: true,
    progress_digest: "1".repeat(64),
  },
  packet = { packet_digest: "2".repeat(64), items: [approved] },
  result = buildPublicSourceCitationApplicationPackets(packet, [structure]),
  out = result.packets[0];
assert.equal(result.summary.packet_count, 1);
assert.equal(result.summary.proposed_citation_count, 1);
assert.equal(out.proposed_revision, 2);
assert.equal(out.placements[0].paragraph_id, "p");
assert.equal(out.after.claims[0].citation_ids.length, 1);
assert(out.after.claims[0].evidence_ids.includes(approved.evidence_digest));
assert.equal(out.after.text, source.text);
assert.equal(out.after.html, source.html);
assert(
  out.body_text_unchanged &&
    !out.artifact_applied &&
    !out.auto_apply &&
    !out.auto_publication,
);
assert.equal(
  out.publication_gate_state,
  "blocked_pending_citation_application_and_publication_review",
);
const pending = buildPublicSourceCitationApplicationPackets(
  {
    ...packet,
    items: [
      {
        ...approved,
        claim_use_approved: false,
        editorial_progress_state: "unreviewed",
      },
    ],
  },
  [structure],
);
assert.equal(pending.summary.packet_count, 0);
assert.equal(
  pending.blocked_reviews[0].blocker_codes[0],
  "source_review_pending",
);
assert.throws(
  () => buildPublicSourceCitationApplicationPackets(packet, []),
  /no retained draft/u,
);
assert.throws(
  () =>
    buildPublicSourceCitationApplicationPackets(packet, [
      {
        group_id: "g",
        draft_package: { draft_revision: { ...source, claims: [] } },
      },
    ]),
  /cannot resolve/u,
);
console.log(
  "public source citation application packets: OK (approved-only, claim/paragraph lineage, body unchanged, no apply/publication)",
);
