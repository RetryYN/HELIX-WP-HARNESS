import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { routeResearchApi, researchOpenApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";
import { buildSerpDepthInventory } from "./serp-depth-inventory.mjs";

const dbPath = process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite",
  db = existsSync(dbPath) ? openDashboardDb(dbPath) : null,
  fallbackInventory = buildSerpDepthInventory(
    [
      {
        site_id: "portable-site",
        group_id: "portable-group",
        task_id: "portable-over",
        keyword: "portable over depth",
        depth: 10,
      },
      {
        site_id: "portable-site",
        group_id: "portable-group",
        task_id: "portable-empty",
        keyword: "portable empty",
        depth: 10,
      },
    ],
    [
      {
        task_id: "portable-over",
        rank_absolute: 1,
        url: "https://portable.example/one",
      },
      {
        task_id: "portable-over",
        rank_absolute: 11,
        url: "https://portable.example/eleven",
      },
    ],
  ),
  data = db
    ? projectDashboard(db)
    : {
        sites: [
          {
            site_id: "portable-site",
            label: "Portable test site",
            domain: "portable.example",
            serp_depth_inventory: {
              ...fallbackInventory,
              rows: fallbackInventory.rows,
            },
          },
        ],
      };

try {
  const site = data.sites[0],
    inventory = site.serp_depth_inventory,
    url = new URL(
      `/api/v1/serp-depth-inventory?site_id=${encodeURIComponent(site.site_id)}&state=over_declared_depth_observed&limit=100`,
      "http://localhost",
    ),
    api = routeResearchApi(url.pathname, url, data, db);
  assert.equal(researchOpenApi.paths["/serp-depth-inventory"].get.operationId, "helix_serp_depth_inventory");
  assert.equal(api.status, 200);
  assert.equal(api.body.policy, "serp-depth-inventory.v1");
  assert.equal(api.body.meta.total, inventory.rows.filter((row) => row.depth_state === "over_declared_depth_observed").length);
  assert.equal(api.body.summary.rank_11_20_row_count, inventory.summary.rank_11_20_row_count);
  assert(api.body.data.every((row) => row.depth_state === "over_declared_depth_observed"));
  assert(api.body.data.every((row) => row.rank_11_20_evidence.every((item) => item.evidence_id.includes(":"))));
  assert.equal(api.body.target_depth_is_provider_request, false);
  assert.equal(api.body.unobserved_rank_slots_are_not_unranked_claims, true);
  assert.equal(api.body.provenance.external_acquisition_triggered, false);
  if (db) {
    assert.equal(api.body.content_summary.rank_11_20_serp_row_count, 98);
    assert.equal(api.body.content_summary.rank_11_20_parsed_row_count, 2);
    assert.equal(api.body.content_summary.rank_11_20_unparsed_row_count, 96);
    assert.equal(api.body.content_summary.rank_11_20_page_evidence_count, 2);
    assert.equal(api.body.content_summary.rank_11_20_failed_page_evidence_count, 0);
    assert.equal(api.body.content_coverage_digest.length, 64);
    assert(
      api.body.data.every(
        (row) =>
          [
            "rank_11_20_serp_only",
            "rank_11_20_content_observed",
          ].includes(row.rank_11_20_content_state),
      ),
    );
    assert.equal(
      api.body.data.filter(
        (row) => row.rank_11_20_content_state === "rank_11_20_content_observed",
      ).length,
      2,
    );
  } else {
    assert.equal(api.body.content_summary, null);
    assert.equal(api.body.content_coverage_digest, null);
  }

  const summaryUrl = new URL(
      `/api/v1/serp-depth-inventory?site_id=${encodeURIComponent(site.site_id)}&view=summary`,
      "http://localhost",
    ),
    summary = routeResearchApi(summaryUrl.pathname, summaryUrl, data, db);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.filters.view, "summary");
  assert.equal(summary.body.meta, undefined);
  assert.equal(summary.body.summary.task_count, inventory.summary.task_count);

  const listed = handleMcpMessage(
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      data,
    ),
    tool = listed.result.tools.find(
      (entry) => entry.name === "audit_serp_depth_inventory",
    );
  assert(tool);
  assert.deepEqual(tool.inputSchema.required, ["site_id"]);
  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "audit_serp_depth_inventory",
        arguments: {
          site_id: site.site_id,
          state: "over_declared_depth_observed",
          limit: 10,
        },
      },
    },
    data,
  );
  assert.equal(mcp.result.isError, false);
  assert.equal(
    mcp.result.structuredContent.meta.total,
    inventory.rows.filter((row) => row.depth_state === "over_declared_depth_observed").length,
  );
  assert.equal(mcp.result.structuredContent.provider_depth_claim, false);
  assert.equal(
    mcp.result.structuredContent.provenance.external_acquisition_triggered,
    false,
  );
  console.log(
    `SERP depth inventory API/MCP: OK (${inventory.summary.task_count} tasks, ${inventory.summary.rank_11_20_row_count} retained rank 11-20 rows, ${db ? "live DB" : "portable fixture"})`,
  );
} finally {
  db?.close();
}
