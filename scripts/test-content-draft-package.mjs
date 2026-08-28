import assert from "node:assert/strict";
import {buildContentDraftPackages} from "./content-draft-package.mjs";

const group={id:"g1",main_keyword:"IT就活"};
const candidate=(id,type,level,text,evidenceId=id)=>({candidate_id:id,group_id:"g1",content_type:type,heading_level:level,text,evidence_ids:[`e-${evidenceId}`],generation:{variant_key:"test"},review:{review_state:"ready",quality_score:100,evidence_count:1}});
const rows=buildContentDraftPackages(
  [group],
  [candidate("t","title",null,"IT就活の完全ガイド"),candidate("h1","heading",2,"企業の選び方"),candidate("h2","heading",2,"選考対策"),candidate("h3","heading",3,"面接の準備","h1")],
  [{group_id:"g1",relation:"same_group",proposal_id:"p1"}],
  {aioReferences:[{group_id:"g1",citation_id:"a1",url:"https://example.com",domain:"example.com",title:"資料"}],actionSignals:[{group_id:"g1",task_id:"task1",signal_types:["visual"],recommended_formats:["original_images"],title_guidance:["画像需要を検証"],heading_guidance:["独自画像で具体例を示す"],evidence:[{evidence_type:"serp_feature_item",evidence_id:"item1"}],evidence_digest:"a".repeat(64)}]},
);
assert.equal(rows[0].generation_state,"brief_ready");assert.equal(rows[0].body_state,"not_generated");assert.equal(rows[0].package_version,"content-draft-package.v3");assert.equal(rows[0].input.outline_policy,"evidence-outline-selection.v1");assert.equal(rows[0].input.headings.find((row)=>row.level===3).parent_candidate_id,"h1");assert.equal(rows[0].input.citation_candidates[0].approval_state,"unreviewed");assert.deepEqual(rows[0].input.serp_action_signals[0].recommended_formats,["original_images"]);assert.equal(rows[0].input.serp_action_signals[0].evidence[0].evidence_id,"item1");assert.equal(rows[0].gates.find((gate)=>gate.gate==="citation_approval").status,"pending");assert.equal(rows[0].package_digest.length,64);
console.log("content draft package: OK (traceable outline, SERP item guidance, citation/fact gates, no fabricated body)");
