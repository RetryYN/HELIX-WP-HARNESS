import assert from "node:assert/strict";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";
const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db),
    site = data.sites[0],
    oracle = site.observed_keyword_content_routing,
    url = new URL(
      `/api/v1/observed-keyword-content-routing?site_id=${site.site_id}&action=review_existing_article_expansion&limit=100`,
      "http://localhost",
    ),
    api = routeResearchApi(url.pathname, url, data, db);
  assert.equal(api.status, 200);
  for (const [field, value] of Object.entries(oracle.summary))
    assert.deepEqual(api.body.summary[field], value);
  assert.equal(
    api.body.meta.total,
    oracle.rows.filter(
      (row) => row.action === "review_existing_article_expansion",
    ).length,
  );
  assert(
    api.body.data.every(
      (row) =>
        row.wp_article_ids.length &&
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
        name: "review_observed_keyword_content_routing",
        arguments: {
          site_id: site.site_id,
          action: "review_new_article",
          limit: 100,
        },
      },
    },
    data,
  );
  assert.equal(
    mcp.result.structuredContent.meta.total,
    oracle.rows.filter(
      (row) => row.action === "review_new_article",
    ).length,
  );
  assert.equal(
    mcp.result.structuredContent.provenance.external_acquisition_triggered,
    false,
  );
  console.log(
    `observed keyword content routing API/MCP: OK (${oracle.summary.existing_article_expansion_review_count} existing expansions, ${oracle.summary.new_article_review_count} new article reviews, zero mutation/publication)`,
  );
} finally {
  db.close();
}
