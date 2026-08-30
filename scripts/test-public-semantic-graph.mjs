import assert from "node:assert/strict";
import {loadPublicSemanticGraph,semanticRelationLabels} from "./public-semantic-graph.mjs";

const graph=loadPublicSemanticGraph();
assert.equal(graph.summary.sense_count,158058);assert.equal(graph.summary.unique_word_count,93834);assert.equal(graph.summary.synset_count,57238);assert.equal(graph.summary.relation_count,115295);assert.equal(graph.summary.relation_type_count,21);assert.equal(graph.summary.acquisition_cost_usd,0);assert.equal(graph.summary.auto_content_mutation_count,0);assert.deepEqual(new Set(graph.relations.map((row)=>row.relation_type)),new Set(Object.keys(semanticRelationLabels)));assert(graph.senses.every((row)=>row.sense_id.length===64&&row.evidence_digest.length===64));assert(graph.relations.every((row)=>row.relation_id.length===64&&row.evidence_digest.length===64));
console.log("public semantic graph: OK (93,834 words, 57,238 synsets, 115,295 typed edges, $0)");
