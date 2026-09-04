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
const data = {
  sites: [],
  serp_db_retention: audit,
  raw_snapshot_inventory: [
    {
      task_id: "t1",
      snapshot_digest: "d".repeat(64),
      item_types: ["organic"],
    },
  ],
  raw_snapshot_payloads: [
    {
      task_id: "t1",
      payload_digest: "d".repeat(64),
      payload_bytes: 24,
      storage_policy: "raw_snapshot_verbatim",
      payload: { tasks: [{ id: "t1", result: [{ items: [] }] }] },
    },
  ],
};
const request = (query) => {
  const url = new URL(`/api/v1/serp-db-retention?${query}`, "http://localhost");
  return routeResearchApi(url.pathname, url, data);
};
const summary = request("view=summary");
assert.equal(summary.status, 200);
assert.equal(summary.body.schema_version, "serp-db-retention-audit.v1");
assert.equal(summary.body.summary.scope_summary.length, 3);
assert.equal(summary.body.summary.dropped_nonempty_field_count, 0);
assert.equal(summary.body.integrity.organic_row_match, true);
assert.equal(summary.body.integrity.raw_payload_match, true);
assert.equal(summary.body.database_counts.raw_snapshot_payloads, 110);
const drops = request("view=drops&scope=unconnected&severity=dropped_nonempty&limit=100");
assert.equal(drops.status, 200);
assert.equal(drops.body.meta.total, 0);
const retainedRaw = request("view=fields&scope=unconnected&severity=retained&q=organic.description&limit=100");
assert.equal(retainedRaw.status, 200);
assert.equal(retainedRaw.body.meta.total, 1);
assert.equal(retainedRaw.body.data[0].retention_state, "exact_raw_snapshot_payload");
const retained = request("view=fields&scope=connected&severity=retained&q=organic.description&limit=100");
assert.equal(retained.status, 200);
assert.equal(retained.body.meta.total, 1);
assert.equal(retained.body.data[0].retention_state, "exact_structured");
assert.equal(request("view=unknown").status, 400);
assert.equal(request("scope=unknown").status, 400);
assert.equal(request("severity=unknown").status, 400);
const rawSummary = routeResearchApi(
  "/api/v1/raw-snapshot",
  new URL("http://localhost/api/v1/raw-snapshot?task_id=t1&view=summary"),
  data,
);
assert.equal(rawSummary.status, 200);
assert.equal(rawSummary.body.raw_payload_verbatim, true);
assert.equal(rawSummary.body.payload, undefined);
const rawPayload = routeResearchApi(
  "/api/v1/raw-snapshot",
  new URL("http://localhost/api/v1/raw-snapshot?task_id=t1&view=payload"),
  data,
);
assert.equal(rawPayload.status, 200);
assert.deepEqual(rawPayload.body.payload.tasks[0].result[0].items, []);
assert.equal(rawPayload.body.raw_file_digest_match, true);
assert.equal(
  routeResearchApi(
    "/api/v1/raw-snapshot",
    new URL("http://localhost/api/v1/raw-snapshot"),
    data,
  ).status,
  400,
);
assert.equal(
  routeResearchApi(
    "/api/v1/raw-snapshot",
    new URL("http://localhost/api/v1/raw-snapshot?task_id=missing"),
    data,
  ).status,
  404,
);
assert.equal(
  routeResearchApi(
    "/api/v1/raw-snapshot",
    new URL("http://localhost/api/v1/raw-snapshot?task_id=t1&view=unknown"),
    data,
  ).status,
  400,
);
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
const rawTool = listed.result.tools.find(
  (item) => item.name === "inspect_raw_snapshot_payload",
);
assert(rawTool);
assert.deepEqual(rawTool.inputSchema.properties.view.enum, ["summary", "payload"]);
const rawCalled = handleMcpMessage(
  {
    jsonrpc: "2.0",
    id: 2.5,
    method: "tools/call",
    params: {
      name: "inspect_raw_snapshot_payload",
      arguments: { task_id: "t1", view: "summary" },
    },
  },
  data,
);
assert.equal(rawCalled.result.isError, false);
assert.equal(rawCalled.result.structuredContent.raw_payload_verbatim, true);
const called = handleMcpMessage(
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "audit_serp_db_retention",
      arguments: { view: "fields", scope: "unconnected", severity: "retained", query: "organic.description", limit: 100 },
    },
  },
  data,
);
assert.equal(called.result.isError, false);
assert.equal(called.result.structuredContent.meta.total, retainedRaw.body.meta.total);
assert.equal(called.result.structuredContent.provenance.external_acquisition_triggered, false);
console.log("SERP DB retention API/MCP: OK (summary, raw payload inspection, exact/drop filters, integrity, and read-only tool contract)");
