import assert from "node:assert/strict";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";
const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db),
    site = data.sites[0],
    url = new URL(
      `/api/v1/observed-site-keyword-opportunities?site_id=${site.site_id}&review_route=review_existing_group_expansion&limit=100`,
      "http://localhost",
    ),
    api = routeResearchApi(url.pathname, url, data, db);
  const completedLocalRemediation =
      site.acquisition_remediation_execution?.accepted_task_count === 96,
    expectedOpportunityCount = completedLocalRemediation ? 85 : 86,
    expectedMultiNeighborCount = completedLocalRemediation ? 48 : 50;
  assert.equal(api.status, 200);
  assert.equal(api.body.summary.target_domain, site.domain);
  assert.equal(
    api.body.summary.target_observed_keyword_count,
    1,
    "owned SERP observations must survive public-domain normalization",
  );
  assert.equal(api.body.summary.opportunity_count, expectedOpportunityCount);
  assert.equal(
    api.body.summary.multi_neighbor_opportunity_count,
    expectedMultiNeighborCount,
  );
  assert.equal(api.body.summary.observed_neighbor_domain_count, 8);
  assert.equal(api.body.meta.total, expectedOpportunityCount);
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
    expectedOpportunityCount,
  );
  assert.equal(
    mcp.result.structuredContent.provenance.external_acquisition_triggered,
    false,
  );
  console.log(
    `observed site keyword opportunities API/MCP: OK (${expectedOpportunityCount} reviews, ${expectedMultiNeighborCount} multi-neighbor, evidence-mode exact, no unranked/full-market inference)`,
  );
} finally {
  db.close();
}
