import assert from "node:assert/strict";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";
const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db),
    site = data.sites[0],
    oracle = site.observed_site_keyword_opportunities,
    url = new URL(
      `/api/v1/observed-site-keyword-opportunities?site_id=${site.site_id}&review_route=review_existing_group_expansion&limit=100`,
      "http://localhost",
    ),
    api = routeResearchApi(url.pathname, url, data, db);
  assert.equal(api.status, 200);
  for (const [field, value] of Object.entries(oracle.summary))
    assert.deepEqual(api.body.summary[field], value);
  const expectedRouteCount = oracle.rows.filter(
    (row) => row.review_route === "review_existing_group_expansion",
  ).length;
  assert.equal(api.body.meta.total, expectedRouteCount);
  assert(
    api.body.data.every(
      (row) =>
        row.target_observation_state ===
          "not_observed_for_target_within_retained_depth" &&
        !row.target_confirmed_unranked &&
        !row.full_market_gap_claimed &&
        row.estimated_traffic == null,
    ),
  );
  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "review_observed_site_keyword_opportunities",
        arguments: {
          site_id: site.site_id,
          review_route: "review_existing_group_expansion",
          limit: 100,
        },
      },
    },
    data,
  );
  assert.equal(
    mcp.result.structuredContent.meta.total,
    expectedRouteCount,
  );
  assert.equal(
    mcp.result.structuredContent.provenance.external_acquisition_triggered,
    false,
  );
  console.log(
    `observed site keyword opportunities API/MCP: OK (${oracle.summary.opportunity_count} reviews, ${oracle.summary.multi_neighbor_opportunity_count} multi-neighbor, evidence-mode exact, no unranked/full-market inference)`,
  );
} finally {
  db.close();
}
