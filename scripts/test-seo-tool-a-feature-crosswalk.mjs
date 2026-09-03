import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const crosswalk = JSON.parse(
    readFileSync("docs/research/seo-tool-a-feature-crosswalk.json", "utf8"),
  ),
  inventory = JSON.parse(
    readFileSync("docs/research/seo-tool-a-web-capability-inventory.json", "utf8"),
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
