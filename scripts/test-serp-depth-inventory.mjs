import assert from "node:assert/strict";
import {
  buildSerpDepthContentCoverage,
  buildSerpDepthInventory,
  projectSerpDepthInventory,
} from "./serp-depth-inventory.mjs";

const completeRows = Array.from({ length: 20 }, (_, index) => ({
    task_id: "complete",
    rank_absolute: index + 1,
    rank_group: index + 1,
    url: `https://example.test/${index + 1}`,
    domain: "example.test",
    title: `Result ${index + 1}`,
  })),
  organicResults = [
    { task_id: "over", rank_absolute: 1, url: "https://example.test/1" },
    { task_id: "over", rank_absolute: 10, url: "https://example.test/10" },
    { task_id: "over", rank_absolute: 11, url: "https://example.test/11" },
    ...completeRows,
  ],
  inventory = buildSerpDepthInventory(
    [
      {
        site_id: "site-a.example",
        group_id: "group-a",
        task_id: "over",
        keyword: "over depth",
        depth: 10,
        snapshot_digest: "a".repeat(64),
      },
      {
        site_id: "site-a.example",
        group_id: "group-a",
        task_id: "complete",
        keyword: "complete depth",
        depth: 20,
        observed_at: "2026-09-04T00:00:00Z",
      },
      {
        site_id: "site-a.example",
        group_id: "group-a",
        task_id: "empty",
        keyword: "empty depth",
        depth: 10,
      },
    ],
    organicResults,
  );

assert.equal(inventory.policy, "serp-depth-inventory.v1");
assert.equal(inventory.rows.length, 3);
assert.equal(inventory.rows[0].task_id, "complete");
const over = inventory.rows.find((row) => row.task_id === "over"),
  complete = inventory.rows.find((row) => row.task_id === "complete"),
  empty = inventory.rows.find((row) => row.task_id === "empty");
assert.equal(over.depth_state, "over_declared_depth_observed");
assert.equal(over.rank_11_20_row_count, 1);
assert.deepEqual(over.rank_11_20_evidence[0], {
  rank_absolute: 11,
  rank_group: null,
  url: "https://example.test/11",
  domain: null,
  title: null,
  evidence_id: "over:11",
});
assert.equal(over.target_depth_coverage.observed_slot_count, 3);
assert.equal(complete.depth_state, "target_depth_complete");
assert.equal(complete.target_depth_coverage.observed_slot_count, 20);
assert.equal(complete.rank_11_20_row_count, 10);
assert.equal(empty.depth_state, "no_rows_retained");
assert.equal(inventory.summary.task_with_rank_11_20_count, 2);
assert.equal(inventory.summary.rank_11_20_row_count, 11);
assert.equal(inventory.summary.target_depth_complete_count, 1);
assert.equal(inventory.target_depth_is_provider_request, false);
assert.equal(inventory.provider_depth_claim, false);
assert.equal(inventory.external_acquisition_triggered, false);
assert.equal(inventory.inventory_digest.length, 64);
const projected = projectSerpDepthInventory(inventory, "site-a.example");
assert.equal(projected.rows.length, 3);
assert.equal(projected.summary.task_count, 3);
assert.equal(projected.inventory_digest.length, 64);
assert.notEqual(projected.inventory_digest, inventory.inventory_digest);
const enriched = buildSerpDepthContentCoverage(inventory, {
  organicResults,
  pages: [
    {
      page_id: "page-11",
      url: "https://example.test/11",
      status: "ok",
    },
    {
      page_id: "failed-page-12",
      url: "https://example.test/12",
      status: "fetch_error",
    },
  ],
  pageTaskEvidence: [
    {
      task_id: "over",
      page_id: "page-11",
      best_rank: 11,
    },
    {
      task_id: "complete",
      page_id: "failed-page-12",
      best_rank: 12,
    },
  ],
  headings: [{ page_id: "page-11", position: 1, level: 2, text: "H2" }],
  pageTerms: [{ page_id: "page-11", term: "foo" }],
});
const enrichedOver = enriched.rows.find((row) => row.task_id === "over"),
  enrichedComplete = enriched.rows.find((row) => row.task_id === "complete");
assert.equal(enrichedOver.rank_11_20_content_state, "rank_11_20_content_observed");
assert.equal(enrichedOver.rank_11_20_parsed_row_count, 1);
assert.equal(enrichedOver.rank_11_20_unparsed_row_count, 0);
assert.equal(enrichedOver.rank_11_20_page_evidence_count, 1);
assert.equal(enrichedOver.rank_11_20_failed_page_evidence_count, 0);
assert.equal(enrichedOver.rank_11_20_heading_count, 1);
assert.equal(enrichedOver.rank_11_20_term_count, 1);
assert.equal(enrichedOver.rank_11_20_content_evidence[0].content_state, "page_evidence_retained");
assert.equal(enrichedComplete.rank_11_20_content_state, "rank_11_20_serp_only");
assert.equal(enrichedComplete.rank_11_20_parsed_row_count, 0);
assert.equal(enrichedComplete.rank_11_20_unparsed_row_count, 10);
assert.equal(enrichedComplete.rank_11_20_failed_page_evidence_count, 1);
assert.equal(enriched.content_summary.rank_11_20_serp_row_count, 11);
assert.equal(enriched.content_summary.rank_11_20_parsed_row_count, 1);
assert.equal(enriched.content_summary.rank_11_20_unparsed_row_count, 10);
assert.equal(enriched.content_summary.rank_11_20_heading_count, 1);
assert.equal(enriched.content_summary.rank_11_20_term_count, 1);
assert.equal(enriched.content_summary.rank_11_20_failed_page_evidence_count, 1);
assert.equal(enriched.content_summary.external_acquisition_triggered, false);
const enrichedProjected = projectSerpDepthInventory(enriched, "site-a.example");
assert.equal(enrichedProjected.content_summary.rank_11_20_parsed_row_count, 1);
assert.equal(enrichedProjected.content_summary.rank_11_20_unparsed_row_count, 10);
assert.equal(enrichedProjected.content_coverage_digest, enriched.content_coverage_digest);
console.log(
  "SERP depth inventory: OK (declared depth, retained rank 11-20 evidence, unobserved-slot boundary, digest)",
);
