import assert from "node:assert/strict";
import {buildPublicSourceReviewDecisionExport} from "../docs/prototypes/wp-ops-dashboard/public-source-review-export.mjs";

const decision={review_id:"review:claim-1",review_digest:"a".repeat(64),editorial_state:"approved_for_claim_use",source_identity_verified:true,source_requirement_verified:true,claim_direct_support_verified:true,reviewed_at:"2026-08-31T00:00:00Z",notes:""};
const payload=await buildPublicSourceReviewDecisionExport("b".repeat(64),"reviewer",[decision]);
assert.equal(payload.schema_version,"public-source-review-decisions.v1");
assert.equal(payload.reviewer_digest.length,64);
assert.equal(payload.decisions[0],decision);
await assert.rejects(()=>buildPublicSourceReviewDecisionExport("b".repeat(64),"",[decision]));
await assert.rejects(()=>buildPublicSourceReviewDecisionExport("bad","reviewer",[decision]));
await assert.rejects(()=>buildPublicSourceReviewDecisionExport("b".repeat(64),"reviewer",[]));
console.log("public-source review UI export: OK (hashed reviewer, digest-bound payload, no direct mutation)");
