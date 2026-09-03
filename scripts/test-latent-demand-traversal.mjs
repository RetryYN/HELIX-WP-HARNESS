import assert from "node:assert/strict";
import { buildLatentDemandTraversal } from "./latent-demand-traversal.mjs";

const evidence = (id, overrides = {}) => ({
  occurrence_id: id,
  group_id: "g1",
  task_id: "task-1",
  source_keyword: "seed",
  demand_type: "related_search",
  value: id === "o1" ? "A" : id === "o2" ? "B" : "A1",
  occurrence_order: Number(id.slice(1)) - 1,
  recursion_depth: id === "o3" || id === "o4" || id === "o5" ? 2 : 1,
  snapshot_digest: id.padEnd(64, "a"),
  observed_at: "2026-09-04T00:00:00Z",
  ...overrides,
});

const rows = [
  evidence("o1"),
  evidence("o2"),
  evidence("o3", {
    demand_type: "paa",
    value: "A1",
    seed_value: "A",
  }),
  evidence("o4", {
    demand_type: "paa",
    value: "B1",
    seed_value: "B",
  }),
  evidence("o5", {
    demand_type: "paa",
    value: "B1",
    seed_value: "A",
  }),
];
const groups = [{ id: "g1", site_id: "site-a" }];

const breadth = buildLatentDemandTraversal({
  siteId: "site-a",
  groups,
  occurrences: rows,
  strategy: "breadth_first",
  maxDepth: 2,
});
const depth = buildLatentDemandTraversal({
  siteId: "site-a",
  groups,
  occurrences: rows,
  strategy: "depth_first",
  maxDepth: 2,
});
assert.deepEqual(
  breadth.rows.map((row) => row.node.value),
  ["seed", "A", "B", "A1", "B1"],
);
assert.deepEqual(
  depth.rows.map((row) => row.node.value),
  ["seed", "A", "A1", "B1", "B"],
);
assert.equal(breadth.strategy_comparison.order_differed, true);
assert.equal(breadth.summary.disambiguation_state, "local_strategies_diverge_provider_trace_required");
assert.equal(breadth.summary.internal_algorithm_identified, false);
assert.equal(breadth.summary.provider_trace_available, false);
assert.equal(breadth.summary.multiple_parent_node_count, 1);
assert.equal(breadth.nodes.find((row) => row.value === "A")?.occurrence_count, 3);
assert.deepEqual(breadth.nodes.find((row) => row.value === "A")?.demand_types, ["paa", "related_search"]);
assert(breadth.edges.some((row) => row.occurrence_ids.includes("o5")));
assert(breadth.rows.every((row) => row.node.source_evidence_retained));
assert(breadth.rows.every((row) => !row.node.automatic_content_mutation));
assert.equal(breadth.external_acquisition_triggered, false);
assert.equal(breadth.lineage_digest, buildLatentDemandTraversal({
  siteId: "site-a",
  groups,
  occurrences: rows,
  strategy: "breadth_first",
  maxDepth: 2,
}).lineage_digest);
assert.equal(
  breadth.lineage_digest,
  buildLatentDemandTraversal({
    siteId: "site-a",
    groups,
    occurrences: [rows[4], rows[2], rows[0], rows[3], rows[1]],
    strategy: "breadth_first",
    maxDepth: 2,
  }).lineage_digest,
  "input row order must not change the retained-evidence digest",
);

const cycleRows = [
  evidence("c1", { value: "B", seed_value: "A", recursion_depth: 2 }),
  evidence("c2", { value: "C", seed_value: "B", recursion_depth: 2 }),
  evidence("c3", { value: "A", seed_value: "C", recursion_depth: 2 }),
];
const cycle = buildLatentDemandTraversal({
  siteId: "site-a",
  groups,
  occurrences: cycleRows,
  strategy: "breadth_first",
  maxDepth: 2,
});
assert.equal(cycle.summary.cycle_node_count, 3);
assert.equal(cycle.summary.review_required_node_count, 3);
assert(cycle.nodes.every((node) => node.cycle_detected));
assert(cycle.edges.every((edge) => edge.cycle_detected));

const shallow = buildLatentDemandTraversal({
  siteId: "site-a",
  groups,
  occurrences: rows,
  strategy: "breadth_first",
  maxDepth: 1,
});
assert.equal(shallow.summary.excluded_depth_count, 3);
assert.equal(shallow.summary.observed_max_depth, 1);
assert.equal(shallow.summary.disambiguation_state, "insufficient_retained_depth");
assert.throws(
  () => buildLatentDemandTraversal({ siteId: "site-a", groups, occurrences: rows, maxDepth: 3 }),
  /maxDepth/,
);
assert.throws(
  () => buildLatentDemandTraversal({ groups, occurrences: rows }),
  /siteId/,
);

console.log(
  "latent demand traversal: OK (retained evidence, deterministic BFS/DFS comparison, depth/multiple-parent gates, no provider claim)",
);
