import assert from "node:assert/strict";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";
const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db),
    site = data.sites[0],
    oracle = site.observed_opportunity_content_coverage_gate,
    url = new URL(
      `/api/v1/observed-opportunity-content-coverage?site_id=${site.site_id}&review_action=monitor_existing_coverage&limit=100`,
      "http://localhost",
    ),
    api = routeResearchApi(url.pathname, url, data, db);
  assert.equal(api.status, 200);
  for (const [field, value] of Object.entries(oracle.summary))
    assert.deepEqual(api.body.summary[field], value);
  assert.equal(
    api.body.meta.total,
    oracle.rows.filter(
      (row) => row.review_action === "monitor_existing_coverage",
    ).length,
  );
  assert(
    api.body.data.every(
      (row) =>
        row.query_matches.length &&
        !row.automatic_content_mutation &&
        !row.auto_publication &&
        !row.ranking_effect_inferred,
    ),
  );
  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "review_observed_opportunity_content_coverage",
        arguments: {
          site_id: site.site_id,
          review_action: "review_content_coverage_gap",
          limit: 100,
        },
      },
    },
    data,
  );
  assert.equal(
    mcp.result.structuredContent.meta.total,
    oracle.rows.filter(
      (row) => row.review_action === "review_content_coverage_gap",
    ).length,
  );
  assert.equal(
    mcp.result.structuredContent.provenance.external_acquisition_triggered,
    false,
  );
  console.log(
    `observed opportunity content coverage API/MCP: OK (${oracle.summary.observed_query_coverage_count} query-covered, ${oracle.summary.strong_content_coverage_without_query_count} strong, ${oracle.summary.partial_content_coverage_review_count} gap reviews, ${oracle.summary.new_article_review_count} new)`,
  );
} finally {
  db.close();
}
