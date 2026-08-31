import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildCitationApplicationReviewDecisionExport } from "../docs/prototypes/wp-ops-dashboard/citation-application-review-export.mjs";

globalThis.crypto ??= webcrypto;
const payload = await buildCitationApplicationReviewDecisionExport(
  "a".repeat(64),
  "reviewer-one",
  [
    {
      packet_id: "packet:1",
      packet_digest: "b".repeat(64),
      editorial_state: "deferred",
      placement_lineage_reviewed: false,
      source_decisions_reviewed: false,
      body_unchanged_verified: false,
      no_unsupported_claim_introduced: false,
      reviewed_at: "2026-09-01T00:00:00.000Z",
      notes: "",
    },
  ],
);
assert.equal(payload.schema_version, "citation-application-review-decisions.v1");
assert.equal(payload.reviewer_digest.length, 64);
assert(!JSON.stringify(payload).includes("reviewer-one"));
assert.equal(payload.decisions.length, 1);
await assert.rejects(
  () => buildCitationApplicationReviewDecisionExport("a".repeat(64), "", [{}]),
  /reviewer identifier/u,
);
const app = readFileSync(
    "docs/prototypes/wp-ops-dashboard/app.js",
    "utf8",
  ),
  html = readFileSync(
    "docs/prototypes/wp-ops-dashboard/index.html",
    "utf8",
  );
assert.match(app, /public_source_citation_application_packets/u);
assert.doesNotMatch(app, /public_source_citation_applications(?!_packets)/u);
for (const id of [
  "citation-application-reviewer-id",
  "citation-application-review-export",
  "citation-application-review-rows",
])
  assert.match(html, new RegExp(`id="${id}"`, "u"));
console.log(
  "citation application review UI export: OK (hashed reviewer, digest-bound payload, no direct mutation)",
);
