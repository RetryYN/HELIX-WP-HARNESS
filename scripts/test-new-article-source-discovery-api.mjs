import assert from "node:assert/strict";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";
const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db),
    site = data.sites[0],
    oracle = site.new_article_source_discovery_manifest,
    url = new URL(
      `/api/v1/new-article-source-discovery-manifest?site_id=${site.site_id}&limit=100`,
      "http://localhost",
    ),
    api = routeResearchApi(url.pathname, url, data, db);
  assert.equal(api.status, 200);
  for (const field of [
    "brief_count",
    "claim_count",
    "p0_claim_count",
    "unique_selected_query_count",
    "duplicate_query_suppressed_count",
    "lifetime_remaining_after_selected_plan_usd",
  ])
    assert.equal(api.body.summary[field], oracle.summary[field]);
  assert.deepEqual(
    api.body.summary.source_requirement_counts,
    oracle.summary.source_requirement_counts,
  );
  assert.equal(api.body.summary.execution_authorized_count, 0);
  assert(
    api.body.data.every(
      (row) =>
        row.budget_allocation_state === "unpriced_unallocated" &&
        row.price_verification_required &&
        !row.execution_authorized &&
        !row.external_discovery_executed,
    ),
  );
  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "inspect_new_article_source_discovery",
        arguments: { site_id: site.site_id, limit: 100 },
      },
    },
    data,
  );
  assert.equal(mcp.result.structuredContent.meta.total, oracle.rows.length);
  assert.equal(
    mcp.result.structuredContent.provenance.external_acquisition_triggered,
    false,
  );
  console.log(
    `new article source discovery API/MCP: OK (${oracle.summary.brief_count} briefs, ${oracle.summary.claim_count} claims, unpriced and unallocated, zero execution)`,
  );
} finally {
  db.close();
}
