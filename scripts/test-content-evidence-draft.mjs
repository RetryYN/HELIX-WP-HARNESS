import assert from "node:assert/strict";
import {buildEvidenceDraftRevision} from "./content-evidence-draft.mjs";

const input={group_id:"g1",generation_state:"brief_ready",package_digest:"a".repeat(64),input:{main_keyword:"IT就活",title:"IT就活の進め方",headings:[{candidate_id:"h1",level:2,text:"企業の選び方",evidence_ids:["e2","e1"]},{candidate_id:"h2",level:3,text:"比較する項目",evidence_ids:["e3"],parent_candidate_id:"h1"}],citation_candidates:[{citation_id:"c1"}]}};
const draft=buildEvidenceDraftRevision(input);
assert.equal(draft.renderer_version,"content-evidence-draft.v1");
assert.equal(draft.sections.length,2);assert.equal(draft.claims.length,3);
assert.deepEqual(draft.evidence_ids,["e1","e2","e3"]);assert.deepEqual(draft.citation_ids,["c1"]);
assert.equal(draft.review.publication_state,"blocked");assert.equal(draft.review.auto_approval,false);assert.equal(draft.review.verified_claim_count,0);
assert(draft.review.reason_codes.includes("primary_source_verification_pending"));assert(draft.review.reason_codes.includes("citation_approval_pending"));
assert.match(draft.text,/\[evidence: e2, e1\]/);assert.match(draft.html,/<h3>比較する項目<\/h3>/);assert.equal(draft.revision_digest.length,64);
assert.equal(buildEvidenceDraftRevision({...input,generation_state:"blocked"}),null);
console.log("content evidence draft: OK (claim evidence, primary-source gate, text/HTML, no auto-approval)");
