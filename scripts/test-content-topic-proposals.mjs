import assert from "node:assert/strict";
import { buildContentStructureCandidates, buildContentTopicProposals, buildEvidenceBoundGenerationCandidates } from "./content-topic-proposals.mjs";

const groups=[
  {id:"g1",main_keyword:"it 就活 エージェント",intent_keywords:["it 就活 エージェント 比較"]},
  {id:"g2",main_keyword:"it 就活 面接",intent_keywords:["it 就活 逆質問"]}
];
const occurrence=(id,group,type,value,normalized=value)=>({occurrence_id:id,group_id:group,task_id:`task-${id}`,demand_type:type,value,normalized_value:normalized,snapshot_digest:"a".repeat(64)});
const proposals=buildContentTopicProposals(groups,[
  occurrence("1","g1","paa","IT就活エージェントの選び方は？","it就活エージェントの選び方は?"),
  occurrence("2","g1","paa","IT就活エージェントの選び方は？","it就活エージェントの選び方は?"),
  occurrence("3","g1","related_search","IT就活 面接 質問","it就活 面接 質問"),
  occurrence("4","g1","related_search","まったく別の話題","まったく別の話題")
]);
assert.equal(proposals.length,3,"duplicate occurrences must aggregate without disappearing");
assert.equal(proposals.find((item)=>item.normalized_topic.includes("選び方")).occurrence_count,2);
assert.equal(proposals.find((item)=>item.normalized_topic.includes("選び方")).relation,"same_group");
assert.equal(proposals.find((item)=>item.normalized_topic.includes("面接")).relation,"cross_group");
assert.deepEqual(proposals.find((item)=>item.normalized_topic.includes("面接")).target_group_ids,["g2"]);
assert.equal(proposals.find((item)=>item.normalized_topic.includes("別の")).relation,"unmatched");
assert.ok(proposals.every((item)=>item.status==="proposed"&&item.evidence_digest.length===64));
const structures=buildContentStructureCandidates(groups,proposals);
assert.equal(structures.length,2);
assert.match(structures[0].title_candidate,/it 就活 エージェント/);
assert.ok(structures[0].heading_candidates.every((item)=>item.topic_proposal_id&&item.evidence_digest.length===64));
const generation=buildEvidenceBoundGenerationCandidates(groups,proposals,new Map([["g1",[
  {term:"選び方",page_count:3,title_count:2,heading_count:4,title_page_count:2,heading_page_count:3,evidence_page_ids:["p1","p2","p3"]},
  {term:"する",page_count:3,title_count:3,heading_count:3,title_page_count:3,heading_page_count:3,evidence_page_ids:["p1","p2","p3"]}
]]]),{featureItems:[
  {feature_item_id:"f-pas",group_id:"g1",feature_type:"people_also_search",text:"IT業界 就活サイト"},
  {feature_item_id:"f-image",group_id:"g1",feature_type:"images",text:"画像"},
  {feature_item_id:"f-video",group_id:"g1",feature_type:"video",title:"動画"},
  {feature_item_id:"f-kg",group_id:"g1",feature_type:"knowledge_graph",title:"IT就活"}
]});
assert.ok(generation.some((item)=>item.content_type==="heading"&&item.text==="it 就活 エージェントの選び方"&&item.evidence_type==="competitor_term"));
assert.ok(generation.some((item)=>item.content_type==="title"&&item.text==="it 就活 エージェントの選び方を解説"));
assert.ok(generation.some((item)=>item.generation.variant_key==="same_group_lexical:demand_explainer"));
assert.ok(generation.some((item)=>item.content_type==="title"&&item.text==="it 就活 エージェントとIT業界 就活サイトの違い・選び方"&&item.evidence_type==="serp_feature_item"&&item.evidence_ids[0]==="f-pas"));
assert.ok(generation.some((item)=>item.content_type==="heading"&&item.generation.variant_key==="serp_image_format"&&item.coverage.review_required));
assert.equal(generation.filter((item)=>item.evidence_type==="serp_feature_item").length,5);
assert.ok(generation.every((item)=>item.generation.generator_version==="evidence-bound-generation.v3"));
assert.ok(generation.every((item)=>item.generation.generator_kind==="deterministic_rule"&&item.generation.input_digest.length===64));
assert.ok(!generation.some((item)=>item.evidence_type==="competitor_term"&&item.text.includes("する")),"non-editorial co-occurrence terms must not enter competitor-derived structures");
assert.ok(generation.every((item)=>item.status==="proposed"&&item.candidate_digest.length===64&&item.evidence_ids.length>0));
const fallbackGeneration=buildEvidenceBoundGenerationCandidates([{id:"g3",main_keyword:"the suit company 就活"}],proposals.filter((item)=>item.relation!=="same_group").map((item)=>({...item,group_id:"g3"})),new Map());
assert.ok(fallbackGeneration.some((item)=>item.content_type==="heading"),"source-task demand must remain usable when lexical assignment has no same-group topics");
assert.ok(fallbackGeneration.every((item)=>item.coverage.topic_assignment_policy==="source_task_fallback"));
assert.ok(fallbackGeneration.every((item)=>item.generation.variant_key.startsWith("source_task_fallback:")));
console.log("content topic proposals: OK (same/cross/unmatched, occurrence preservation, evidence-bound candidates)");
