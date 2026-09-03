import assert from "node:assert/strict";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";

const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db),
    site = data.sites[0],
    oracle = site.generation_quality_oracle,
    url = new URL(
      `/api/v1/generation-quality-oracle?site_id=${encodeURIComponent(site.site_id)}&limit=100`,
      "http://localhost",
    ),
    api = routeResearchApi(url.pathname, url, data, db);

  assert.equal(api.status, 200);
  assert.equal(api.body.policy, "generation-quality-oracle.v1");
  assert.equal(api.body.meta.total, oracle.rows.length);
  assert.equal(api.body.summary.candidate_count, oracle.summary.candidate_count);
  assert.equal(
    api.body.summary.blocked_deterministic_gate_count,
    oracle.summary.blocked_deterministic_gate_count,
  );
  assert.equal(api.body.oracle_digest, oracle.oracle_digest);
  assert(api.body.data.length <= 100);
  assert(
    api.body.data.every(
      (row) =>
        /^[a-f0-9]{64}$/u.test(row.quality_digest) &&
        row.human_quality_proven === false &&
        row.ranking_effect_inferred === false &&
        row.auto_selection === false &&
        row.auto_content_mutation === false,
    ),
  );
  assert.equal(api.body.provenance.external_acquisition_triggered, false);

  const listed = handleMcpMessage(
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      data,
    ),
    tool = listed.result.tools.find(
      (entry) => entry.name === "audit_generation_quality",
    );
  assert(tool);
  assert.deepEqual(tool.inputSchema.required, ["site_id"]);

  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "audit_generation_quality",
        arguments: {
          site_id: site.site_id,
          state: "blocked_deterministic_gate",
          limit: 10,
        },
      },
    },
    data,
  );
  assert.equal(mcp.result.isError, false);
  assert.equal(
    mcp.result.structuredContent.meta.total,
    oracle.rows.filter(
      (row) => row.review_state === "blocked_deterministic_gate",
    ).length,
  );
  assert.equal(mcp.result.structuredContent.human_quality_proven, false);
  assert.equal(
    mcp.result.structuredContent.provenance.external_acquisition_triggered,
    false,
  );
  console.log(
    `generation quality oracle API/MCP: OK (${oracle.rows.length} candidates, ${oracle.summary.blocked_deterministic_gate_count} deterministic blocks, human/ranking claims remain false)`,
  );
} finally {
  db.close();
}
