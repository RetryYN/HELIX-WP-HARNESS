import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";

const inventory = JSON.parse(
    readFileSync(
      "docs/research/seo-tool-a-web-capability-inventory.json",
      "utf8",
    ),
  ),
  capabilities = new Map(inventory.capabilities.map((row) => [row.id, row])),
  openapiResponse = routeResearchApi(
    "/api/v1/openapi.json",
    new URL("http://localhost/api/v1/openapi.json"),
    null,
  ),
  openapiRouteCount = Object.keys(openapiResponse.body.paths).length,
  mcpResponse = handleMcpMessage(
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
    null,
  ),
  mcpToolCount = mcpResponse.result.tools.length,
  db = openDashboardDb(".helix/keyword-dashboard.sqlite");

try {
  const site = projectDashboard(db).sites[0],
    allocation = site.acquisition_lifetime_allocation,
    manifest = site.acquisition_lifetime_approval_manifest,
    attempted = allocation.rows.filter((row) => row.previous_attempt_observed),
    publicApi = capabilities.get("public_api"),
    mcp = capabilities.get("mcp"),
    bulk = capabilities.get("bulk_keyword_research"),
    credit = capabilities.get("credit_history");

  assert.equal(publicApi.public_limit, `${openapiRouteCount} routes; maximum 100 rows/page`);
  assert.match(publicApi.gap, new RegExp(`/api/v1に${openapiRouteCount} GET route`));
  assert.equal(mcp.public_limit, `${mcpToolCount} local tools; max 100 rows per search call`);
  assert.match(mcp.gap, new RegExp(`${mcpToolCount} read-only tool`));

  assert.equal(attempted.length, 98);
  assert.equal(
    attempted.filter((row) => row.allocation_state === "selected_plan_only").length,
    0,
  );
  assert(
    attempted.every(
      (row) => row.allocation_reason === "previous_attempt_requires_review",
    ),
  );
  for (const text of [bulk.gap, credit.gap]) {
    assert.match(text, /0\.3014/u);
    assert.match(text, new RegExp(manifest.lifetime_budget.projected_maximum.toFixed(4)));
    assert.match(text, new RegExp(allocation.summary.selected_candidate_count.toLocaleString("en-US")));
    assert.match(
      text,
      new RegExp(
        `(?:${manifest.batch_count} immutable batch|immutable ${manifest.batch_count} batch)`,
      ),
    );
    assert.doesNotMatch(text, /6,243|4\.99955|64 immutable/u);
  }
  assert.match(bulk.gap, /過去試行98/u);
  assert.match(credit.gap, /過去試行98/u);
  assert.equal(site.provider_cost_ledger.reconciliation.state, "reconciled");
  assert.equal(site.provider_cost_ledger.entry_count, 197);
  assert.equal(site.provider_cost_ledger.api_key_stored, false);

  console.log(
    `capability inventory runtime consistency: OK (${openapiRouteCount} routes, ${mcpToolCount} tools, ${attempted.length} prior attempts excluded, $${manifest.lifetime_budget.projected_maximum.toFixed(4)} max)`,
  );
} finally {
  db.close();
}
