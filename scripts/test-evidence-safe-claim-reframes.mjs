import assert from "node:assert/strict";
import observations from "../docs/research/priority-public-source-observations.json" with {type:"json"};
import {buildEvidenceSafeClaimReframes} from "./evidence-safe-claim-reframes.mjs";

const evidence={rows:observations.rows.map((row)=>({...row,group_id:row.claim_id.split(":section:")[0],priority_band:"P2",source_requirement:"independent_corroboration_required",evidence_digest:"e".repeat(64)}))},result=buildEvidenceSafeClaimReframes(evidence);
assert.equal(result.summary.unsupported_claim_count,8);assert.equal(result.summary.classified_claim_count,8);assert.equal(result.summary.unclassified_count,0);assert.deepEqual(result.summary.failure_kind_counts,{private_quantitative_fact:2,entity_disambiguation_required:2,unknowable_personal_intent:1,institution_specific_rule:1,unbounded_future_outcome:1,anecdotal_generalization:1});assert(result.rows.every((row)=>row.unsupported_answer_removed&&!row.factual_answer_inferred&&!row.auto_replacement&&!row.auto_approval&&!row.auto_publication&&!row.external_acquisition_triggered&&row.reframe_digest.length===64));assert.equal(new Set(result.rows.map((row)=>row.claim_id)).size,8);assert.equal(result.reframe_set_digest.length,64);
console.log("evidence-safe claim reframes: OK (8/8 classified, unsupported answers removed, editor review only)");
