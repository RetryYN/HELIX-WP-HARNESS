import assert from "node:assert/strict";
import {buildTitleSerpPatternOracle} from "./title-serp-pattern-oracle.mjs";

const unresolved = buildTitleSerpPatternOracle(
  [{ id: "pending", main_keyword: null }],
  [{ candidate_id: "pending-title", group_id: "pending", content_type: "title", text: "確認中のタイトル" }],
  [{ page_id: "unrelated", title: "別グループのタイトル" }],
  [{ group_id: "other", page_id: "unrelated", best_rank: 1 }],
);
assert.equal(unresolved.rows.length, 1);
assert.equal(unresolved.rows[0].candidate_id, "pending-title");
assert.equal(unresolved.rows[0].review_state, "needs_review");
assert(unresolved.rows[0].issues.includes("competitor_title_evidence_missing"));
assert.equal(unresolved.rows[0].observed_title_count, 0);
assert.equal(unresolved.benchmarks[0].main_keyword, null);
assert.deepEqual(unresolved.rows[0].pattern_support, []);
const observedUnresolved = buildTitleSerpPatternOracle(
  [{ id: "pending", main_keyword: null }],
  [{ candidate_id: "pending-title", group_id: "pending", content_type: "title", text: "確認中のタイトル" }],
  [{ page_id: "retained", title: "保持されたタイトル" }],
  [{ group_id: "pending", page_id: "retained", best_rank: 1 }],
);
assert.equal(observedUnresolved.benchmarks[0].observed_title_count, 1);
assert.equal(observedUnresolved.rows[0].observed_title_count, 1);
assert.equal(observedUnresolved.rows[0].candidate_flags.main_keyword_state, "unresolved");
assert(observedUnresolved.rows[0].issues.includes("main_keyword_unresolved"));
assert(!observedUnresolved.rows[0].issues.includes("competitor_title_evidence_missing"));
assert.equal(observedUnresolved.rows[0].review_state, "needs_review");

const groups=[{id:"g1",main_keyword:"転職 面接"}],pages=[{page_id:"p1",title:"転職 面接の準備｜5つのポイント"},{page_id:"p2",title:"転職 面接で聞かれる質問とは？"}],evidence=[{group_id:"g1",page_id:"p1",best_rank:1},{group_id:"g1",page_id:"p2",best_rank:2}],candidates=[{candidate_id:"c1",group_id:"g1",content_type:"title",text:"転職 面接の準備｜質問を解説"},{candidate_id:"c2",group_id:"g1",content_type:"title",text:"完全に別のテーマ【保存版】"}],oracle=buildTitleSerpPatternOracle(groups,candidates,pages,evidence),supported=oracle.rows.find((row)=>row.candidate_id==="c1"),review=oracle.rows.find((row)=>row.candidate_id==="c2");
assert.equal(oracle.benchmarks[0].observed_title_count,2);assert.equal(oracle.benchmarks[0].main_keyword_states.leading,2);assert.equal(oracle.benchmarks[0].question_count,1);assert.equal(oracle.benchmarks[0].number_count,1);assert(supported.pattern_support.includes("separator_pattern_observed"));assert(review.issues.includes("main_keyword_absent"));assert(review.issues.includes("bracket_pattern_unobserved"));assert.equal(review.ranking_effect_inferred,false);assert.equal(review.evidence_digest.length,64);console.log("title SERP pattern oracle: OK (observed morphology, candidate review, no ranking causality)");
