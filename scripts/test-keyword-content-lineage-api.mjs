import assert from "node:assert/strict";
import {
  researchOpenApi,
  routeResearchApi,
} from "./keyword-dashboard-api.mjs";

const data = {
  sites: [
    {
      site_id: "site-a",
      keyword_lineage_ledger: {
        rows: [
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
        ],
      },
      ai_question_candidates: [],
      content_readiness_oracle: {
        rows: [
          {
            group_id: "g1",
            publication_state: "blocked",
            blocker_codes: ["claim_verification"],
            review_codes: [],
            auto_approval: false,
            auto_publication: false,
            readiness_digest: "b".repeat(64),
          },
        ],
      },
    },
  ],
  groups: [
    {
      id: "g1",
      site_id: "site-a",
      main_keyword: "主語",
      display_keyword: "主語",
      resolution_state: "resolved",
    },
    { id: "g2", site_id: "site-b", main_keyword: "別サイト" },
  ],
  keyword_inventory: [
    {
      site_id: "site-a",
      source_keyword_id: "source-1",
      raw_keyword: "主語",
      normalized_keyword: "主語",
      processing_state: "取得済",
    },
  ],
  serp_demands: [
    {
      group_ids: ["g1"],
      demand_type: "paa",
      representative_value: "主語とは?",
      occurrence_count: 1,
      source_keywords: ["主語"],
    },
  ],
  serp_demand_occurrences: [
    {
      occurrence_id: "occ-demand",
      group_id: "g1",
      demand_type: "paa",
      value: "主語とは?",
      normalized_value: "主語とは?",
    },
  ],
  content_topic_proposals: [
    {
      group_id: "g1",
      proposal_id: "topic-1",
      topic_kind: "paa",
      display_topic: "主語とは?",
      relation: "same_group",
      occurrence_count: 1,
      task_count: 1,
      priority_score: 80,
      status: "proposed",
      evidence_digest: "c".repeat(64),
      evidence_occurrence_ids: ["occ-1"],
    },
  ],
  content_structure_candidates: [
    {
      group_id: "g1",
      title_candidate: "主語の意味",
      status: "proposed",
      candidate_digest: "d".repeat(64),
      source_topic_ids: ["topic-1"],
      heading_candidates: [],
    },
  ],
  content_generation_candidates: [
    {
      group_id: "g1",
      candidate_id: "title-1",
      content_type: "title",
      text: "主語の意味",
      evidence_type: "serp_demand",
      evidence_ids: ["topic-1"],
      status: "proposed",
      candidate_digest: "e".repeat(64),
      review: { review_state: "ready", review_digest: "f".repeat(64) },
    },
  ],
  content_outlines: [],
};

const route = (path) => {
  const url = new URL(path, "http://localhost");
  return routeResearchApi(url.pathname, url, data);
};

assert.ok(researchOpenApi.paths["/keyword-content-lineage"]?.get);
const response = route(
  "/api/v1/keyword-content-lineage?site_id=site-a&q=%E4%B8%BB%E8%AA%9E&limit=10",
);
assert.equal(response.status, 200);
assert.equal(response.body.meta.total, 1);
assert.equal(response.body.data[0].site_id, "site-a");
assert.equal(response.body.data[0].stages.demand.state, "observed");
assert.deepEqual(
  response.body.data[0].demand_observations[0].evidence_occurrence_ids,
  ["occ-demand"],
);
assert.equal(response.body.data[0].stages.title_and_headings.title_count, 1);
assert.equal(response.body.data[0].stages.publication.state, "blocked");
assert.equal(response.body.automatic_group_assignment, false);
assert.equal(response.body.automatic_generation, false);
assert.equal(response.body.automatic_content_mutation, false);
assert.equal(response.body.automatic_publication, false);
assert.equal(response.body.external_acquisition_triggered, false);
assert.equal(
  route("/api/v1/keyword-content-lineage?site_id=site-a&group_id=g2").body.meta.total,
  0,
);
assert.equal(route("/api/v1/keyword-content-lineage").status, 400);
assert.equal(route("/api/v1/keyword-content-lineage?site_id=missing").status, 404);
console.log(
  "keyword content lineage API: OK (site scope, demand/title gate lineage, fail-closed mutation flags)",
);
