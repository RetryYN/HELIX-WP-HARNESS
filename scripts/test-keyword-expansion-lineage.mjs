import assert from "node:assert/strict";
import { buildKeywordExpansionLineage, expansionDispositionStates } from "./keyword-expansion-lineage.mjs";

const inventory = [
  {
    site_id: "site-a",
    source_keyword_id: "kw:1",
    source_sheet: "sheet",
    source_row: 2,
    raw_keyword: "IT 就活",
    processing_state: "SERP取得済み",
    search_volume: 100,
    evidence_digest: "source-digest-1",
  },
  {
    site_id: "site-a",
    source_keyword_id: "kw:2",
    source_sheet: "sheet",
    source_row: 3,
    raw_keyword: "IT 就活 未取得",
    processing_state: "SERP未取得",
    search_volume: 10,
    evidence_digest: "source-digest-2",
  },
  {
    site_id: "site-a",
    source_keyword_id: "kw:3",
    source_sheet: "sheet",
    source_row: 4,
    raw_keyword: "孤立候補",
    processing_state: "SERP取得済み",
    search_volume: 1,
    evidence_digest: "source-digest-3",
  },
  {
    site_id: "other",
    source_keyword_id: "kw:other",
    source_sheet: "sheet",
    source_row: 2,
    raw_keyword: "別サイト",
    processing_state: "SERP取得済み",
  },
];

const hierarchy = [
  {
    site_id: "site-a",
    source_keyword_id: "kw:1",
    parent_source_keyword_id: null,
    depth: 0,
    relation: "root",
    raw_keyword: "IT 就活",
    normalized_terms: ["it", "就活"],
    evidence_digest: "hierarchy-1",
  },
  {
    site_id: "site-a",
    source_keyword_id: "kw:2",
    parent_source_keyword_id: "kw:1",
    depth: 1,
    relation: "child",
    raw_keyword: "IT 就活 未取得",
    normalized_terms: ["it", "就活", "未取得"],
    evidence_digest: "hierarchy-2",
  },
  {
    site_id: "site-a",
    source_keyword_id: "kw:3",
    parent_source_keyword_id: null,
    depth: 0,
    relation: "root",
    raw_keyword: "孤立候補",
    normalized_terms: ["孤立候補"],
    evidence_digest: "hierarchy-3",
  },
];

const groups = [
  {
    id: "group:1",
    site_id: "site-a",
    main_keyword: "IT 就活",
    display_keyword: "IT 就活",
    intent_keywords: ["IT 就活 未取得"],
    sibling_keywords: [],
    comparison_keywords: ["IT 就活", "IT 就活 未取得"],
    resolution_state: "resolved",
    state: "未施策",
  },
];

const occurrences = [
  {
    occurrence_id: "occ:1",
    group_id: "group:1",
    task_id: "task:1",
    source_keyword: "IT 就活",
    demand_type: "paa",
    value: "IT就活で何をする？",
    normalized_value: "it就活で何をする?",
    occurrence_order: 0,
    serp_item_rank: 1,
    recursion_depth: 1,
    snapshot_digest: "snapshot-1",
    observed_at: "2026-09-01T00:00:00Z",
  },
];
const demands = [
  {
    demand_type: "paa",
    normalized_value: "it就活で何をする?",
    representative_value: "IT就活で何をする？",
    occurrence_count: 1,
    importance_score: 80,
    max_recursion_depth: 1,
  },
];
const topics = [
  {
    proposal_id: "topic:1",
    group_id: "group:1",
    display_topic: "IT就活の進め方",
    normalized_topic: "it就活の進め方",
    topic_kind: "paa",
    relation: "same_group",
    occurrence_count: 1,
    priority_score: 50,
    status: "proposed",
    evidence_occurrence_ids: ["occ:1"],
    evidence_digest: "topic-digest",
  },
];
const questions = [
  {
    question_id: "question:1",
    group_id: "group:1",
    question_text: "IT就活で何をする？",
    candidate_kind: "observed_question",
    source_topic_id: "topic:1",
    source_kind: "paa",
    review_state: "ready",
    evidence_digest: "question-digest",
  },
];
const candidates = [
  {
    candidate_id: "candidate:1",
    group_id: "group:1",
    content_type: "title",
    text: "IT就活の進め方",
    evidence_type: "serp_demand",
    evidence_ids: ["topic:1"],
    status: "proposed",
    candidate_digest: "candidate-digest",
    review: { review_state: "needs_review" },
  },
];

const result = buildKeywordExpansionLineage({
  siteId: "site-a",
  keywordInventory: inventory,
  keywordHierarchy: hierarchy,
  groups,
  relatedBoundaries: [
    {
      source_keyword_id: "kw:2",
      boundary_state: "multi_group_tie_review",
      review_required: true,
      assignment_state: "proposal_only_not_applied",
      candidates: [
        {
          group_id: "group:1",
          rank: 1,
          proposal_score: 12,
          evidence_digest: "proposal-digest",
        },
      ],
      evidence_digest: "boundary-digest",
    },
  ],
  demandOccurrences: occurrences,
  demands,
  topics,
  questions,
  candidates,
  lexicalIndex: {
    associations: [
      {
        term: "it",
        associated_term: "就活",
        pair_support: 2,
        cosine_score: 0.5,
        rank: 1,
        evidence_source_keyword_ids: ["kw:1"],
        evidence_digest: "association-digest",
      },
    ],
  },
  synonymRows: [
    {
      left_term: "就活",
      left_normalized: "就活",
      right_term: "就職活動",
      right_normalized: "就職活動",
      relation_state: "human_reviewed_synonym_pair",
      context_review_required: true,
      source_id: "synonym:1",
      source_row: 1,
      evidence_digest: "synonym-digest",
    },
  ],
  taskMetadata: [{ task_id: "task:failed", result_keyword: "孤立候補", status_code: 50000, status_message: "failed" }],
});

assert.equal(result.summary.source_keyword_count, 3);
assert.equal(result.summary.normalized_keyword_count, 3);
assert.equal(result.summary.coverage_row_count, 3);
assert.equal(result.summary.edge_type_counts.observed_demand, 1);
assert.equal(result.summary.edge_type_counts.hierarchy_parent, 1);
assert.equal(result.summary.review_required_edge_count > 0, true);
for (const state of expansionDispositionStates) assert.equal(state in result.summary.source_disposition_counts, true);
assert.equal(result.coverage.find((row) => row.source_keyword_id === "kw:2").disposition_state, "not_acquired");
assert.equal(result.coverage.find((row) => row.source_keyword_id === "kw:3").disposition_state, "failed");
assert.equal(result.coverage.find((row) => row.source_keyword_id === "kw:1").disposition_state, "retained");
assert.equal(result.surface_coverage.find((row) => row.surface === "external_autocomplete").disposition_state, "not_acquired");
assert(result.edges.some((row) => row.edge_type === "topic_evidence" && row.occurrence_id === "occ:1"));
assert(result.edges.every((row) => row.evidence_digest.length === 64));
assert(result.nodes.every((row) => row.node_digest.length === 64));
const repeat = buildKeywordExpansionLineage({
  siteId: "site-a",
  keywordInventory: inventory,
  keywordHierarchy: hierarchy,
  groups,
  demandOccurrences: occurrences,
  demands,
  topics,
  questions,
  candidates,
  lexicalIndex: { associations: [] },
});
assert.equal(result.lineage_digest.length, 64);
assert.notEqual(result.lineage_digest, repeat.lineage_digest);
const filtered = buildKeywordExpansionLineage({
  siteId: "site-a",
  keywordInventory: inventory,
  keywordHierarchy: hierarchy,
  groups,
  demandOccurrences: occurrences,
  demands,
  query: "IT 就活",
});
assert(filtered.nodes.some((row) => row.node_type === "source_keyword"));
assert(filtered.edges.every((row) => row.from_node_id || row.to_node_id));
console.log(`keyword expansion lineage: OK (${result.summary.node_count} nodes, ${result.summary.edge_count} edges, ${result.summary.coverage_row_count} coverage rows)`);
