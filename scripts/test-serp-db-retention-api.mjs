import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";

const audit = JSON.parse(
  readFileSync(
    "docs/prototypes/wp-ops-dashboard/serp-db-retention-audit.json",
    "utf8",
  ),
);
const data = { sites: [], serp_db_retention: audit };
const request = (query) => {
  const url = new URL(`/api/v1/serp-db-retention?${query}`, "http://localhost");
  return routeResearchApi(url.pathname, url, data);
};
const summary = request("view=summary");
assert.equal(summary.status, 200);
assert.equal(summary.body.schema_version, "serp-db-retention-audit.v1");
assert.equal(summary.body.summary.scope_summary.length, 3);
assert.equal(summary.body.summary.dropped_nonempty_field_count > 0, true);
assert.equal(summary.body.integrity.organic_row_match, true);
const drops = request("view=drops&scope=unconnected&severity=dropped_nonempty&limit=100");
assert.equal(drops.status, 200);
assert(drops.body.meta.total > 0);
assert(drops.body.data.every((row) => row.scope === "unconnected" && row.severity === "dropped_nonempty"));
assert(drops.body.data.some((row) => row.field === "organic.description"));
const retained = request("view=fields&scope=connected&severity=retained&q=organic.description&limit=100");
assert.equal(retained.status, 200);
assert.equal(retained.body.meta.total, 1);
assert.equal(retained.body.data[0].retention_state, "exact_structured");
assert.equal(request("view=unknown").status, 400);
assert.equal(request("scope=unknown").status, 400);
assert.equal(request("severity=unknown").status, 400);
const listed = handleMcpMessage(
  { jsonrpc: "2.0", id: 1, method: "tools/list" },
  data,
);
const tool = listed.result.tools.find(
  (item) => item.name === "audit_serp_db_retention",
);
assert(tool);
assert.deepEqual(tool.inputSchema.properties.view.enum, ["summary", "fields", "drops"]);
assert.deepEqual(tool.inputSchema.properties.scope.enum, ["all", "connected", "unconnected"]);
const called = handleMcpMessage(
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "audit_serp_db_retention",
      arguments: { view: "drops", scope: "unconnected", severity: "dropped_nonempty", limit: 100 },
    },
  },
  data,
);
assert.equal(called.result.isError, false);
assert.equal(called.result.structuredContent.meta.total, drops.body.meta.total);
assert.equal(called.result.structuredContent.provenance.external_acquisition_triggered, false);
console.log("SERP DB retention API/MCP: OK (summary, exact/drop filters, integrity, and read-only tool contract)");
