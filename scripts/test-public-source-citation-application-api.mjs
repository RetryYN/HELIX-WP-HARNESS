import assert from "node:assert/strict";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { researchOpenApi, routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";

const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const dashboard = projectDashboard(db),
    site = dashboard.sites[0],
    oracle = site.public_source_citation_application_packets,
    request = (view) => {
      const url = new URL(
        `/api/v1/public-source-citation-application-packets?site_id=${site.site_id}&view=${view}&limit=100`,
        "http://localhost",
      );
      return routeResearchApi(url.pathname, url, dashboard, db);
    },
    packets = request("packets"),
    blocked = request("blocked");
  assert.equal(researchOpenApi.info.version, "2.117.0");
  assert.equal(packets.status, 200);
  assert.equal(packets.body.meta.total, oracle.summary.packet_count);
  assert.equal(blocked.body.meta.total, oracle.summary.blocked_review_count);
  assert.equal(oracle.summary.body_mutation_count, 0);
  assert.equal(oracle.summary.artifact_applied_count, 0);
  assert.equal(oracle.summary.publication_unblocked_count, 0);
  assert.equal(packets.body.artifact_applied, false);
  assert.equal(packets.body.auto_apply, false);
  assert.equal(packets.body.auto_publication, false);
  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "review_public_source_citation_applications",
        arguments: { site_id: site.site_id, view: "blocked", limit: 100 },
      },
    },
    dashboard,
  );
  assert.equal(
    mcp.result.structuredContent.meta.total,
    oracle.summary.blocked_review_count,
  );
  assert.equal(mcp.result.structuredContent.auto_publication, false);
  assert(
    site.content_readiness_oracle.rows.some((row) =>
      row.gates.some(
        (gate) => gate.gate === "public_source_citation_application",
      ),
    ),
  );
  console.log(
    `public source citation application API/MCP: OK (${oracle.summary.packet_count} packets, ${oracle.summary.blocked_review_count} blocked, zero mutation/publication)`,
  );
} finally {
  db.close();
}
