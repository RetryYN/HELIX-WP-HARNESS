import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const crosswalk = JSON.parse(
    readFileSync("docs/research/seo-tool-a-feature-crosswalk.json", "utf8"),
  ),
  inventory = JSON.parse(
    readFileSync("docs/research/seo-tool-a-web-capability-inventory.json", "utf8"),
  ),
  contractDrift = JSON.parse(
    readFileSync("docs/research/seo-tool-a-public-contract-drift.json", "utf8"),
  ),
  inventoryIds = new Set(inventory.capabilities.map((row) => row.id)),
  mappedIds = new Set(
    crosswalk.rows.flatMap((row) => row.inventory_capability_ids),
  ),
  unknownFunctionTargets = crosswalk.rows.flatMap((row) =>
    row.inventory_capability_ids.filter((id) => !inventoryIds.has(id)),
  ),
  unknownUpdateTargets = crosswalk.update_surface_rows.flatMap((row) =>
    row.inventory_capability_ids.filter((id) => !inventoryIds.has(id)),
  );
const expected2026UpdateIds = [
  "mcp_plan_floor",
  "chat_integration_listing",
  "question_search_formal",
  "connector_listing",
  "ai_model_latest_2026_08",
  "bulk_site_formal",
  "mcp_oauth",
  "ai_model_latest_2026_07",
  "site_search_formal",
  "regional_mobile_rank",
  "credit_usage_history",
  "openapi_3_1_1",
  "typeahead_associated_terms",
  "api_key_label_and_usage",
  "plan_tiers_and_auto_charge",
  "mcp_public_release",
  "typeahead_suggestions",
  "bulk_keyword_trend_four_years",
  "first_seen_range",
  "influx_graph_refresh",
  "public_api_release",
  "data_output_release",
  "ai_model_latest_2026_03",
  "bulk_processing_speed",
];
const updateIdentity = (row) =>
  `${row.published_at}\0${row.summary}\0${[...(row.inventory_capability_ids ?? row.capability_ids ?? [])].sort().join(",")}`;

assert.equal(crosswalk.schema_version, "seo-tool-a-feature-crosswalk.v1");
assert.equal(crosswalk.baseline_evidence_cutoff, inventory.evidence_cutoff);
assert.equal(unknownFunctionTargets.length, 0);
assert.equal(unknownUpdateTargets.length, 0);
assert.equal(crosswalk.rows.length, crosswalk.summary.function_surface_count);
assert.equal(
  crosswalk.rows.filter((row) => row.mapping_state === "mapped").length,
  crosswalk.summary.mapped_function_surface_count,
);
assert.equal(
  crosswalk.rows.filter((row) => row.mapping_state !== "mapped").length,
  crosswalk.summary.unmapped_function_surface_count,
);
assert.equal(crosswalk.summary.unmapped_function_surface_count, 0);
assert.equal(crosswalk.update_surface_rows.length, crosswalk.summary.update_surface_count);
assert.equal(
  crosswalk.update_surface_rows.filter((row) => row.mapping_state === "mapped")
    .length,
  crosswalk.summary.mapped_update_surface_count,
);
assert.equal(crosswalk.summary.unmapped_update_surface_count, 0);
assert.equal(new Set(crosswalk.update_surface_rows.map((row) => row.update_id)).size, crosswalk.update_surface_rows.length);
assert.deepEqual(
  [...new Set(crosswalk.update_surface_rows.map((row) => row.update_id))].sort(),
  [...expected2026UpdateIds].sort(),
  "all 2026 update surfaces shown by the source page must be represented",
);
assert.deepEqual(
  crosswalk.update_surface_rows.map(updateIdentity).sort(),
  [
    ...(contractDrift.public_update_history.post_cutoff_updates ?? []),
    ...(contractDrift.public_update_history.recent_context_updates ?? []),
  ].map(updateIdentity).sort(),
  "crosswalk and freshness audit must expose the same update surfaces",
);
assert.equal(
  crosswalk.update_surface_rows.filter((row) => row.after_baseline).length,
  crosswalk.summary.post_cutoff_update_count,
);
assert.deepEqual(
  [...mappedIds].sort(),
  [...inventoryIds].sort(),
  "every inventory capability must have at least one public crosswalk source",
);
assert.equal(crosswalk.summary.coverage_complete, true);
assert.equal(crosswalk.summary.mapping_review_required, true);
assert.equal(crosswalk.rows.some((row) => row.mapping_kind === "umbrella"), true);
assert.equal(crosswalk.rows.some((row) => row.mapping_kind === "exact"), true);
console.log(
  `SeoToolA feature crosswalk: OK (${crosswalk.summary.function_surface_count} function surfaces, ${crosswalk.summary.update_surface_count} update surfaces, ${crosswalk.summary.inventory_coverage_count}/${inventoryIds.size} inventory capabilities mapped, unmapped 0)`,
);
