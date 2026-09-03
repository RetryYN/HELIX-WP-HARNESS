import assert from "node:assert/strict";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";

const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db);
  const site = data.sites[0];
  const expected = site.keyword_expansion_lineage;
  const base = new URL(
    `/api/v1/keyword-expansion-lineage?site_id=${encodeURIComponent(site.site_id)}`,
    "http://localhost",
  );
  const nodes = routeResearchApi(base.pathname, base, data, db);
  assert.equal(nodes.status, 200);
  assert.equal(nodes.body.view, "nodes");
  assert.equal(nodes.body.meta.total, expected.nodes.length);
  assert.equal(nodes.body.summary.node_count, expected.summary.node_count);
  assert.equal(nodes.body.source_rows_losslessly_retained, true);
  assert.equal(nodes.body.raw_external_payload_synthesized, false);
  assert.equal(nodes.body.external_acquisition_triggered, false);
  assert.equal(nodes.body.data.every((row) => row.site_id === site.site_id), true);

  const edgesUrl = new URL(base);
  edgesUrl.searchParams.set("view", "edges");
  edgesUrl.searchParams.set("edge_type", "observed_demand");
  const edges = routeResearchApi(edgesUrl.pathname, edgesUrl, data, db);
  assert.equal(edges.status, 200);
  assert.equal(
    edges.body.meta.total,
    expected.edges.filter((row) => row.edge_type === "observed_demand").length,
  );
  assert(edges.body.data.every((row) => row.edge_type === "observed_demand"));
  assert(edges.body.data.every((row) => row.evidence_digest.length === 64));

  const coverageUrl = new URL(base);
  coverageUrl.searchParams.set("view", "coverage");
  coverageUrl.searchParams.set("disposition", "not_acquired");
  const coverage = routeResearchApi(coverageUrl.pathname, coverageUrl, data, db);
  assert.equal(coverage.status, 200);
  assert.equal(
    coverage.body.meta.total,
    expected.coverage.filter((row) => row.disposition_state === "not_acquired").length,
  );
  assert(coverage.body.data.every((row) => row.disposition_state === "not_acquired"));

  const surfaceUrl = new URL(base);
  surfaceUrl.searchParams.set("view", "surfaces");
  const surfaces = routeResearchApi(surfaceUrl.pathname, surfaceUrl, data, db);
  assert.equal(surfaces.status, 200);
  assert.equal(surfaces.body.meta.total, expected.surface_coverage.length);
  assert(surfaces.body.data.some((row) => row.surface === "external_autocomplete"));

  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "audit_keyword_expansion_lineage",
        arguments: { site_id: site.site_id, view: "coverage", disposition: "zero", limit: 100 },
      },
    },
    data,
  );
  assert.equal(mcp.result.isError, false);
  assert.equal(
    mcp.result.structuredContent.meta.total,
    expected.coverage.filter((row) => row.disposition_state === "zero").length,
  );
  const listed = handleMcpMessage(
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    data,
  );
  assert(
    listed.result.tools.some((tool) => tool.name === "audit_keyword_expansion_lineage"),
  );
  console.log(
    `keyword expansion lineage API/MCP: OK (${expected.summary.node_count} nodes, ${expected.summary.edge_count} edges, ${expected.summary.zero_expansion_source_keyword_count} zero, ${expected.summary.external_surface_not_acquired_count} external surfaces not acquired)`,
  );
} finally {
  db.close();
}
