import assert from "node:assert/strict";
import observations from "../docs/research/priority-public-source-observations.json" with {type:"json"};
import {buildNewArticlePublicSourceEvidence} from "./new-article-public-source-evidence.mjs";
const manifest={rows:[{queries:observations.rows.map((row,index)=>({claim_id:row.claim_id,candidate_digest:row.candidate_digest,selected_query:row.query,priority_band:"P0",source_requirement:"primary_official_source_required",preferred_source_classes:["government","company_official","standards_body"]}))}]};
const evidence=buildNewArticlePublicSourceEvidence(manifest,observations);
assert.deepEqual(evidence.summary,{checked_claim_count:2,qualifying_candidate_count:1,no_qualifying_result_count:1,directly_supported_count:0,contextual_only_count:1,not_supported_count:1,requirement_satisfied_count:0,acquisition_cost_usd:0,external_public_review_executed_count:2,auto_approval_count:0,auto_publication_count:0});
assert(evidence.rows.every((row)=>row.evidence_digest.length===64&&row.source_text_digest.length===64&&!row.requirement_satisfied&&!row.auto_approval&&!row.auto_publication));
assert.throws(()=>buildNewArticlePublicSourceEvidence(manifest,{...observations,rows:[{...observations.rows[0],candidate_digest:"0".repeat(64)}]}),/candidate digest mismatch/);
console.log("new article public source evidence: OK (2 P0 checked, 0 falsely satisfied, $0)");
