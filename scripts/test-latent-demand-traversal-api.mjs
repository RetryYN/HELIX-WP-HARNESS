import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  openDashboardDb,
  projectDashboard,
} from "./keyword-dashboard-db.mjs";
import { researchOpenApi, routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";

const dbPath = ".helix/keyword-dashboard.sqlite";
const fixtureData = {
  sites: [{ site_id: "site-a" }],
  groups: [{ id: "g1", site_id: "site-a" }],
  serp_demand_occurrences: [
    {
      occurrence_id: "fixture-o1",
      group_id: "g1",
      task_id: "fixture-task",
      source_keyword: "seed",
      demand_type: "related_search",
      value: "A",
      normalized_value: "a",
      occurrence_order: 0,
      recursion_depth: 1,
      snapshot_digest: "a".repeat(64),
      observed_at: "2026-09-04T00:00:00Z",
    },
    {
      occurrence_id: "fixture-o2",
      group_id: "g1",
      task_id: "fixture-task",
      source_keyword: "seed",
      demand_type: "paa",
      value: "A1",
      normalized_value: "a1",
      occurrence_order: 1,
      recursion_depth: 2,
      seed_value: "A",
      snapshot_digest: "b".repeat(64),
      observed_at: "2026-09-04T00:00:00Z",
    },
  ],
};
const db = existsSync(dbPath) ? openDashboardDb(dbPath) : null;
try {
  const data = db ? projectDashboard(db) : fixtureData;
  const site = data.sites.find((row) => data.groups.some((group) => group.site_id === row.site_id));
  assert(site);
  const url = new URL(
    `/api/v1/latent-demand-traversal?site_id=${site.site_id}&strategy=depth_first&max_depth=2&limit=100`,
    "http://localhost",
  );
  const api = routeResearchApi(url.pathname, url, data, db);
  assert.equal(api.status, 200);
  assert.equal(api.body.summary.site_id, site.site_id);
  assert.equal(api.body.strategy, "depth_first");
  assert.equal(api.body.summary.observed_max_depth, db ? 1 : 2);
  assert.equal(api.body.summary.depth_2_occurrence_count, db ? 0 : 1);
  assert.equal(
    api.body.summary.disambiguation_state,
    db ? "insufficient_retained_depth" : "local_strategies_same_order_provider_trace_required",
  );
  assert.equal(api.body.strategy_comparison.internal_algorithm_identified, false);
  assert.equal(api.body.strategy_comparison.provider_trace_available, false);
  assert.equal(
    api.body.identifiability_proof.identifiability_state,
    "not_identifiable_from_public_projection",
  );
  assert.equal(api.body.identifiability_proof.trace_order_differs, true);
  assert.equal(api.body.identifiability_proof.public_projection.equal, true);
  assert.equal(api.body.evidence_boundary.paid_request_executed, false);
  assert.equal(api.body.external_acquisition_triggered, false);
  assert(api.body.data.every((row) => row.strategy === "depth_first"));
  assert(api.body.data.every((row) => row.node?.source_evidence_retained));
  assert(api.body.data.every((row) => !row.node?.automatic_content_mutation));
  assert.match(researchOpenApi.paths["/latent-demand-traversal"].get.operationId, /latent_demand/);

  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "audit_latent_demand_traversal",
        arguments: { site_id: site.site_id, strategy: "breadth_first", max_depth: 2, limit: 10 },
      },
    },
    data,
  );
  assert.equal(mcp.result.isError, false);
  assert.equal(mcp.result.structuredContent.strategy, "breadth_first");
  assert.equal(mcp.result.structuredContent.provenance.external_acquisition_triggered, false);
  assert.equal(mcp.result.structuredContent.automatic_group_assignment, false);

  const badStrategy = new URL(
    `/api/v1/latent-demand-traversal?site_id=${site.site_id}&strategy=unknown`,
    "http://localhost",
  );
  assert.equal(routeResearchApi(badStrategy.pathname, badStrategy, data, db).status, 400);
  const badDepth = new URL(
    `/api/v1/latent-demand-traversal?site_id=${site.site_id}&max_depth=3`,
    "http://localhost",
  );
  assert.equal(routeResearchApi(badDepth.pathname, badDepth, data, db).status, 400);
  const badGroup = new URL(
    `/api/v1/latent-demand-traversal?site_id=${site.site_id}&group_id=missing`,
    "http://localhost",
  );
  assert.equal(routeResearchApi(badGroup.pathname, badGroup, data, db).status, 404);

  console.log(
    `latent demand traversal API/MCP: OK (${api.body.summary.matched_occurrence_count} retained occurrences, ${db ? "live DB" : "portable fixture"}, provider order unclaimed)`,
  );
} finally {
  db?.close();
}
