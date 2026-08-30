import assert from "node:assert/strict";
import {loadPublicSynonymEvidence} from "./public-synonym-evidence.mjs";

const evidence=loadPublicSynonymEvidence();
assert.equal(evidence.summary.pair_count,11753);
assert.equal(evidence.summary.human_reviewed_pair_count,11753);
assert(evidence.summary.unique_term_count>5000);
assert.equal(evidence.summary.auto_replacement_count,0);
assert.equal(evidence.source.pair_file_sha256,"d8a017df64945559aa3c8f713efba96c52cada3055558135762f76c482339a9e");
assert(evidence.rows.every((row)=>row.pair_id.length===64&&row.evidence_digest.length===64&&row.context_review_required&&!row.auto_replacement));
assert(evidence.rows.some((row)=>[row.left_term,row.right_term].includes("トラブル")));
console.log(`public synonym evidence: OK (${evidence.summary.pair_count} human-reviewed pairs, ${evidence.summary.unique_term_count} terms, $0)`);
