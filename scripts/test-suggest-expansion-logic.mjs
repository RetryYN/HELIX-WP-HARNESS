import assert from "node:assert/strict";
import { buildSuggestEvidenceOracle } from "./suggest-evidence-oracle.mjs";
import {
  APPEND_FAMILIES,
  SUGGEST_CLASSES,
  SUGGEST_ENGINES,
  buildSuggestExpansionLogic,
} from "./suggest-expansion-logic.mjs";

const sourceRows = [
  {
    site_id: "site-a",
    source_keyword_id: "kw-1",
    raw_keyword: "SEO 対策",
    source_sheet: "seed",
    source_row: 2,
    source_location: "seed:2",
    search_volume: 100,
    processing_state: "SERP未取得",
  },
  {
    site_id: "site-a",
    source_keyword_id: "kw-2",
    raw_keyword: "seo　対策",
    source_sheet: "seed-copy",
    source_row: 3,
    source_location: "seed-copy:3",
    search_volume: 80,
    processing_state: "取得済",
  },
  {
    site_id: "site-a",
    source_keyword_id: "kw-3",
    raw_keyword: "転職",
    source_sheet: "seed",
    source_row: 4,
    source_location: "seed:4",
    search_volume: 60,
    processing_state: "SERP未取得",
  },
];
const evidence = buildSuggestEvidenceOracle(sourceRows);
const result = buildSuggestExpansionLogic({
  siteId: "site-a",
  sourceRows,
  suggestEvidence: evidence,
});
const repeat = buildSuggestExpansionLogic({
  siteId: "site-a",
  sourceRows,
  suggestEvidence: evidence,
});

assert.equal(result.seeds.length, 2);
assert.equal(result.summary.source_row_count, 3);
assert.equal(result.frontier.length, 8);
assert.deepEqual(result.summary.frontier_class_counts, {
  "0": 2,
  "1": 2,
  "2": 2,
  "3": 2,
});
assert.equal(result.engines.length, 8);
assert.equal(result.summary.engine_not_acquired_count, 8);
assert.equal(result.frontier.every((row) => row.state === "plan_only_not_acquired"), true);
assert.equal(result.frontier.filter((row) => row.suggest_class === 2).every((row) => row.append_families.length === APPEND_FAMILIES.length), true);
assert.equal(result.frontier.filter((row) => row.suggest_class === 0).every((row) => row.append_families.length === 0), true);
assert.equal(result.contract.request.defaults.increase_keyword, false);
assert.equal(result.contract.credit.per_request, 1.5);
assert.deepEqual(
  result.classes.map((row) => row.value),
  SUGGEST_CLASSES.map((row) => row.value),
);
assert.deepEqual(
  result.engines.map((row) => row.mode),
  SUGGEST_ENGINES.map((row) => row.mode),
);
assert.notDeepEqual(
  result.traversal.traces[0].node_order,
  result.traversal.traces[1].node_order,
);
assert.equal(result.traversal.comparison.provider_internal_algorithm_proven, false);
assert.equal(result.traversal.comparison.disambiguation_required, true);
assert.equal(result.summary.observed_external_result_count, 0);
assert.equal(result.external_acquisition_triggered, false);
assert.equal(result.auto_assignment, false);
assert.equal(result.auto_generation, false);
assert.equal(result.auto_publication, false);
assert.equal(result.lineage_digest, repeat.lineage_digest);
assert.equal(result.seeds[0].source_rows.length > 0, true);
console.log("suggest expansion logic: OK (classes, retained seed lineage, plan-only frontier, BFS/DFS ambiguity, no acquisition)");
