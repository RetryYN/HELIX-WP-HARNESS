import assert from "node:assert/strict";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";
const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db),
    site = data.sites[0],
    oracle = site.keyword_lineage_ledger,
    url = new URL(
      `/api/v1/keyword-lineage?site_id=${encodeURIComponent(site.site_id)}&limit=100`,
      "http://localhost",
    ),
    api = routeResearchApi(url.pathname, url, data, db),
    summary = api.body.summary;
  assert.equal(api.status, 200);
  assert.equal(api.body.meta.total, oracle.rows.length);
  for (const [field, value] of Object.entries(oracle.summary))
    assert.deepEqual(summary[field], value);
  assert.equal(api.body.source_rows_losslessly_retained, true);
  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "audit_keyword_lineage",
        arguments: { site_id: site.site_id, duplicates: "true", limit: 100 },
      },
    },
    data,
  );
  assert.equal(
    mcp.result.structuredContent.meta.total,
    oracle.summary.normalized_duplicate_row_count,
  );
  const contentLineageUrl = new URL(
      `/api/v1/keyword-content-lineage?site_id=${encodeURIComponent(site.site_id)}&group_id=${encodeURIComponent(data.groups.find((row) => row.site_id === site.site_id)?.id ?? "")}&limit=1`,
      "http://localhost",
    ),
    contentLineage = routeResearchApi(
      contentLineageUrl.pathname,
      contentLineageUrl,
      data,
      db,
    );
  assert.equal(contentLineage.status, 200);
  assert.equal(contentLineage.body.meta.total, 1);
  assert.equal(contentLineage.body.data[0].site_id, site.site_id);
  assert.equal(contentLineage.body.data[0].stages.publication.state, "blocked");
  assert.equal(contentLineage.body.automatic_content_mutation, false);
  console.log(
    `keyword lineage API/MCP: OK (${oracle.rows.length.toLocaleString()} lossless source rows, content lineage stages, ${oracle.summary.acquired_unique_group_count} acquired group links, zero anomalies)`,
  );
} finally {
  db.close();
}
