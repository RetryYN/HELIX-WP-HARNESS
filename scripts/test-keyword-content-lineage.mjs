import assert from "node:assert/strict";
import { buildKeywordContentLineage } from "./keyword-content-lineage.mjs";

const input = {
  siteId: "site-a",
  groups: [
    {
      id: "g1",
      site_id: "site-a",
      main_keyword: "主語",
      display_keyword: "主 語",
      resolution_state: "resolved",
    },
    {
      id: "g2",
      site_id: "site-b",
      main_keyword: "別サイト",
      resolution_state: "resolved",
    },
  ],
  keywordInventory: [
    {
      site_id: "site-a",
      source_keyword_id: "source-1",
      raw_keyword: "主語",
      normalized_keyword: "主語",
      processing_state: "取得済",
    },
  ],
  keywordLineageRows: [
    {
      site_id: "site-a",
      source_keyword_id: "source-1",
      raw_keyword: "主語",
      normalized_keyword: "主語",
      processing_state: "取得済",
      lineage_state: "acquired_unique_group",
      exact_group_ids: ["g1"],
      proposal_group_ids: [],
      source_sheet: "sheet",
      source_row: 2,
      evidence_digest: "a".repeat(64),
    },
    {
      site_id: "site-a",
      source_keyword_id: "source-2",
      raw_keyword: "主語 方法",
      normalized_keyword: "主語 方法",
      processing_state: "SERP未取得",
      lineage_state: "unacquired_recommendation_connected",
      exact_group_ids: [],
      proposal_group_ids: ["g1"],
      source_sheet: "sheet",
      source_row: 3,
      evidence_digest: "b".repeat(64),
    },
  ],
  demands: [
    {
      group_ids: ["g1"],
      demand_type: "paa",
      representative_value: "主語とは?",
      occurrence_count: 2,
      importance_score: 30,
      source_keywords: ["主語"],
      task_count: 1,
    },
  ],
  occurrences: [
    {
      occurrence_id: "occ-demand",
      group_id: "g1",
      demand_type: "paa",
      value: "主語とは?",
      normalized_value: "主語とは?",
    },
  ],
  topics: [
    {
      group_id: "g1",
      proposal_id: "topic-1",
      topic_kind: "paa",
      display_topic: "主語とは?",
      relation: "same_group",
      occurrence_count: 2,
      task_count: 1,
      priority_score: 80,
      status: "proposed",
      evidence_digest: "c".repeat(64),
      evidence_occurrence_ids: ["occ-1"],
    },
  ],
  questions: [
    {
      group_id: "g1",
      question_id: "question-1",
      question_text: "主語とは?",
      candidate_kind: "observed_question",
      source_topic_id: "topic-1",
      review_state: "needs_review",
      evidence_occurrence_ids: ["occ-1"],
      evidence_digest: "d".repeat(64),
    },
  ],
  structures: [
    {
      group_id: "g1",
      title_candidate: "主語の意味と使い方",
      status: "proposed",
      candidate_digest: "e".repeat(64),
      source_topic_ids: ["topic-1"],
      heading_candidates: [
        {
          level: 2,
          text: "主語とは?",
          topic_proposal_id: "topic-1",
          evidence_digest: "f".repeat(64),
        },
      ],
    },
  ],
  candidates: [
    {
      candidate_id: "title-1",
      group_id: "g1",
      content_type: "title",
      text: "主語の意味と使い方",
      evidence_type: "serp_demand",
      evidence_ids: ["topic-1"],
      status: "proposed",
      candidate_digest: "1".repeat(64),
      review: { review_state: "ready", review_digest: "2".repeat(64) },
    },
    {
      candidate_id: "heading-1",
      group_id: "g1",
      content_type: "heading",
      heading_level: 2,
      text: "主語とは?",
      evidence_type: "serp_demand",
      evidence_ids: ["topic-1"],
      status: "proposed",
      candidate_digest: "3".repeat(64),
      review: { review_state: "needs_review", review_digest: "4".repeat(64) },
    },
  ],
  outlines: [
    {
      group_id: "g1",
      status: "outline_ready",
      selected_count: 1,
      h2_count: 1,
      h3_count: 0,
      candidate_count: 1,
      omitted_candidate_count: 0,
      evidence_id_count: 1,
      policy: "outline.v1",
      sections: [
        {
          candidate_id: "heading-1",
          content_type: "heading",
          heading_level: 2,
          text: "主語とは?",
          evidence_type: "serp_demand",
          evidence_ids: ["topic-1"],
          status: "proposed",
          candidate_digest: "3".repeat(64),
          review: { review_state: "needs_review", review_digest: "4".repeat(64) },
          outline_position: 1,
          children: [],
        },
      ],
    },
  ],
  readinessRows: [
    {
      group_id: "g1",
      publication_state: "blocked",
      blocker_codes: ["claim_verification"],
      review_codes: ["title_editor_review"],
      auto_approval: false,
      auto_publication: false,
      readiness_digest: "5".repeat(64),
    },
  ],
};

const result = buildKeywordContentLineage(input);
assert.equal(result.rows.length, 1);
assert.equal(result.rows[0].group_id, "g1");
assert.equal(result.rows[0].source_keywords.length, 1);
assert.equal(result.rows[0].proposed_keywords.length, 1);
assert.equal(result.rows[0].stages.source_keywords.state, "retained");
assert.equal(result.rows[0].stages.source_keywords.unacquired_count, 0);
assert.equal(result.rows[0].stages.demand.state, "observed");
assert.deepEqual(
  result.rows[0].demand_observations[0].evidence_occurrence_ids,
  ["occ-demand"],
);
assert.deepEqual(
  result.rows[0].question_candidates[0].evidence_occurrence_ids,
  ["occ-1"],
);
assert.deepEqual(result.rows[0].outline.selected_candidate_ids, ["heading-1"]);
assert.equal(result.rows[0].stages.title_and_headings.title_count, 1);
assert.equal(result.rows[0].stages.title_and_headings.heading_count, 1);
assert.equal(result.rows[0].stages.publication.state, "blocked");
assert.equal(result.rows[0].automatic_content_mutation, false);
assert.equal(result.summary.external_acquisition_triggered, false);
assert.equal(
  buildKeywordContentLineage(input).lineage_digest,
  result.lineage_digest,
);
assert.equal(buildKeywordContentLineage({ ...input, query: "主語とは" }).rows.length, 1);
assert.equal(buildKeywordContentLineage({ ...input, query: "存在しない" }).rows.length, 0);
assert.equal(buildKeywordContentLineage({ ...input, groupId: "missing" }).rows.length, 0);
assert.throws(() => buildKeywordContentLineage(), /siteId is required/);
console.log(
  "keyword content lineage: OK (source→demand→title/heading→publication gate, deterministic digest, no mutation)",
);
