import assert from "node:assert/strict";
import {buildKeywordBoundaryOracle} from "./keyword-boundary-oracle.mjs";

const legacy=(id,overlap,same=false)=>({kind:"serp_pair",source_task_id:`${id}a`,target_task_id:`${id}b`,source_group_id:`${id}g1`,target_group_id:same?`${id}g1`:`${id}g2`,source_keyword:`${id} left`,target_keyword:`${id} right`,current_same_group:same,shared_url_count:overlap*10,overlap_ratio:overlap,review_required:true,evidence_digest:id.repeat(64).slice(0,64)}),intent=(id,score,same=false)=>({left_task_id:`${id}a`,right_task_id:`${id}b`,left_group_id:`${id}g1`,right_group_id:same?`${id}g1`:`${id}g2`,left_keyword:`${id} left`,right_keyword:`${id} right`,current_same_group:same,intent_similarity_score:score,components:{domain_similarity:score},review_required:true,pair_digest:id.toUpperCase().repeat(64).slice(0,64)});
const result=buildKeywordBoundaryOracle([legacy("a",.6),legacy("b",.4),legacy("c",.2,true)],[intent("a",.7),intent("b",.7),intent("c",.2,true)]);
assert.deepEqual(result.rows.map((row)=>row.decision),["merge_consensus_review","split_consensus_review","merge_signal_conflict_review"]);
assert.equal(result.summary.review_count,3);assert.equal(result.summary.merge_consensus_count,1);assert.equal(result.summary.split_consensus_count,1);assert.equal(result.summary.signal_conflict_count,1);assert.ok(result.rows.every((row)=>row.boundary_digest.length===64&&row.review_required&&!row.auto_mutation));
console.log("keyword boundary oracle: OK (URL/intent consensus, conflicts, review-only actions)");
