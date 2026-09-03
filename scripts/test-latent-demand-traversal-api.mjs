import assert from "node:assert/strict";
import {
  openDashboardDb,
  projectDashboard,
} from "./keyword-dashboard-db.mjs";
import { researchOpenApi, routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";

const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db);
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
  assert.equal(api.body.summary.observed_max_depth, 1);
  assert.equal(api.body.summary.depth_2_occurrence_count, 0);
  assert.equal(api.body.summary.disambiguation_state, "insufficient_retained_depth");
  assert.equal(api.body.strategy_comparison.internal_algorithm_identified, false);
  assert.equal(api.body.strategy_comparison.provider_trace_available, false);
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
    `latent demand traversal API/MCP: OK (${api.body.summary.matched_occurrence_count} retained occurrences, depth2 absent, provider order unclaimed)`,
  );
} finally {
  db.close();
}
