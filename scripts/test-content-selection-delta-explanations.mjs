import assert from "node:assert/strict";
import {buildContentSelectionDeltaExplanations} from "./content-selection-delta-explanations.mjs";

const candidate=(id,type,score,components,extra={})=>({candidate_id:id,content_type:type,text:id,ensemble_score:score,score_components:components,...extra});
const ensemble={candidate_rows:[
  candidate("to","title",50,{quality:20,demand:0}),candidate("tn","title",65,{quality:20,demand:15}),
  candidate("security-old","heading",10,{competitive:0,evidence:5},{heading_level:2,evidence_type:"question",text:"セキュリティ対策"}),
  candidate("salary-old","heading",40,{competitive:0,evidence:5},{heading_level:3,evidence_type:"competitor_term",text:"給与と年収"}),
  candidate("salary-new","heading",90,{competitive:15,evidence:10},{heading_level:3,evidence_type:"competitor_term",text:"給与・年収の比較"}),
  candidate("security-new","heading",60,{competitive:15,evidence:10},{heading_level:2,evidence_type:"question",text:"セキュリティ対策とは"}),
  candidate("unrelated-old","heading",20,{competitive:0},{heading_level:2,evidence_type:"question",text:"古い論点"}),
  candidate("unrelated-new","heading",30,{competitive:5},{heading_level:3,evidence_type:"competitor_term",text:"別の話題"}),
],group_rows:[{group_id:"g",main_keyword:"kw",title_selection_changed:true,current_title_candidate_id:"to",recommended_title_candidate_id:"tn",heading_remove_ids:["security-old","salary-old","unrelated-old"],heading_add_ids:["salary-new","security-new","unrelated-new"]}]};
const output=buildContentSelectionDeltaExplanations(ensemble),title=output.rows.find((row)=>row.content_type==="title"),headings=output.rows.filter((row)=>row.content_type==="heading"),byCurrent=new Map(headings.map((row)=>[row.current_candidate_id,row]));
assert.equal(output.rows.length,5);
assert.equal(output.summary.title_explanation_count,1);
assert.equal(output.summary.structurally_paired_heading_count,2);
assert.equal(output.summary.net_evidence_gain_count,3);
assert.equal(output.summary.deterministic_tie_break_count,0);
assert.equal(output.summary.unpaired_change_count,2);
assert.equal(title.reason_codes.includes("stronger_demand_history"),true);
assert.equal(byCurrent.get("security-old").recommended_candidate_id,"security-new","structural pairing must beat score-order pairing");
assert.equal(byCurrent.get("salary-old").recommended_candidate_id,"salary-new");
assert(headings.filter((row)=>row.pairing_method==="maximum_structural_similarity").every((row)=>row.pairing_components.heading_level_match&&row.pairing_components.evidence_type_match&&row.pairing_score>=70));
assert(output.rows.every((row)=>row.explanation_digest.length===64&&row.editor_decision_required&&!row.auto_apply));
console.log("content selection delta explanations: OK (optimal structural pairing, component gains/tradeoffs, no auto apply)");
