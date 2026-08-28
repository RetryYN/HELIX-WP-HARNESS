import assert from "node:assert/strict";
import {buildContentPlanCoherence} from "./content-plan-coherence.mjs";

const review=(quality_score,review_state="ready")=>({quality_score,review_state,evidence_count:1,character_count:30,oracle:{evidence_reference_resolved:true}}),groups=[{id:"g1",main_keyword:"IT 就活"},{id:"g2",main_keyword:"IT 面接"}],candidates=[
  {candidate_id:"t1",group_id:"g1",content_type:"title",text:"IT就活の企業選びと面接対策・完全保存版をわかりやすく解説",evidence_ids:["e1"],review:review(95)},
  {candidate_id:"t2",group_id:"g1",content_type:"title",text:"IT就活ガイド",evidence_ids:["e2"],review:review(80,"needs_review")},
  {candidate_id:"t3",group_id:"g1",content_type:"title",text:"IT就活の企業選びと面接対策",evidence_ids:["e1"],review:review(92)},
  {candidate_id:"h1",group_id:"g1",content_type:"heading",heading_level:2,text:"IT就活の企業選び",evidence_ids:["e1"],review:review(90)},
  {candidate_id:"h2",group_id:"g1",content_type:"heading",heading_level:3,text:"面接対策",evidence_ids:["e3"],review:review(88)}
],outlines=[{group_id:"g1",status:"outline_ready",policy:"evidence-outline-selection.v1",sections:[{...candidates[2],children:[candidates[3]]}]}],rows=buildContentPlanCoherence(groups,candidates,outlines);
assert.equal(rows.length,2);assert.equal(rows[0].baseline_title_candidate_id,"t1");assert.equal(rows[0].title_candidate_id,"t3");assert.equal(rows[0].metrics.selection_changed,true);assert.equal(rows[0].metrics.title_quality_delta,-3);assert.ok(rows[0].metrics.title_outline_lexical_coverage_delta>0);assert.equal(rows[0].metrics.shared_evidence_count,1);assert.equal(rows[0].metrics.title_evidence_coverage,1);assert.equal(rows[0].metrics.selected_heading_count,2);assert.equal(rows[0].policy,"content-plan-coherence.v2");assert.equal(rows[0].auto_approval,false);assert.equal(rows[0].status,"proposed");assert.equal(rows[0].composition_digest.length,64);assert.equal(rows[1].review_state,"blocked");assert.ok(rows[1].issues.includes("title_unavailable")&&rows[1].issues.includes("outline_unavailable"));
console.log("content plan coherence: OK (quality-floor joint title/outline optimization, evidence/lexical deltas, no auto-approval)");
