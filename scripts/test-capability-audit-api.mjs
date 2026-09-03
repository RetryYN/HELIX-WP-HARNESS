import assert from "node:assert/strict";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";
import { researchOpenApi, routeResearchApi } from "./keyword-dashboard-api.mjs";

const request = (query = "") => {
  const url = new URL(`http://localhost/api/v1/capability-audit?${query}`);
  return routeResearchApi(url.pathname, url, { sites: [], groups: [] });
};

assert(researchOpenApi.paths["/capability-audit"]?.get);
const all = request("limit=100");
assert.equal(all.status, 200);
assert.equal(all.body.meta.total, 35);
assert.equal(all.body.summary.capability_count, 35);
assert.equal(all.body.summary.proven_complete_count, 6);
assert.equal(all.body.summary.incomplete_count, 29);
assert.equal(all.body.completion_claim, "not_proven");
assert.equal(all.body.external_request_executed, false);
assert.equal(all.body.model_execution_triggered, false);
assert.equal(all.body.paid_execution_triggered, false);

const generation = request(
  "status=incomplete&blocker=generation_runtime_or_quality_oracle&limit=100",
);
assert.equal(generation.body.meta.total, 6);
assert(
  generation.body.data.every((row) =>
    row.blocker_classes.includes("generation_runtime_or_quality_oracle"),
  ),
);

const integrity = request("view=integrity&limit=100");
assert.equal(integrity.body.meta.total, 35);
assert(integrity.body.data.every((row) => row.evidence_integrity));

const credits = request("view=credits&limit=100");
assert(credits.body.meta.total > 0);
assert.equal(credits.body.public_contract_credits.paid_request_executed, false);

const listed = handleMcpMessage(
  { jsonrpc: "2.0", id: 1, method: "tools/list" },
  null,
).result.tools;
assert.equal(listed.length, 108);
assert(listed.some((tool) => tool.name === "inspect_capability_completion_audit"));
const mcp = handleMcpMessage(
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "inspect_capability_completion_audit",
      arguments: { parity_status: "incomplete", limit: 100 },
    },
  },
  null,
).result;
assert.equal(mcp.isError, false);
assert.equal(mcp.structuredContent.meta.total, 29);
assert.equal(mcp.structuredContent.completion_claim, "not_proven");

console.log(
  "capability audit API/MCP: OK (35 capabilities, 6 proven, 29 incomplete, 108 tools, no external/model/paid execution)",
);
