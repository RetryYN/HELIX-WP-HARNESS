import assert from "node:assert/strict";
import { buildPaidTestBudgetScenarios } from "./paid-test-budget-scenarios.mjs";
const scenario = (costs, reserve = 1, committed = 4) => buildPaidTestBudgetScenarios({
  allocation: { rows: [], summary: { lifetime_cap_usd: 5, committed_cost_usd: committed } },
  generationManifest: { requests: costs.map((maximum_cost_usd) => ({ maximum_cost_usd })) },
  reservations: [{ scenario_id: "test", generation_reservation_usd: reserve }],
}).rows[0];
assert.equal(scenario([0.6, 0.6]).generation_capacity_request_count, 1);
assert.equal(scenario([0.6, 0.6]).generation_capacity_cost_usd, 0.6);
assert.equal(scenario(Array(100).fill(0.05)).generation_capacity_request_count, 20);
assert.equal(scenario([0.4, 0.6]).generation_capacity_request_count, 2);
assert.equal(scenario([1.1, 0.1]).generation_capacity_request_count, 0); // preserve manifest order
assert.equal(scenario([0.1], 1, 4.5).generation_capacity_request_count, 0);
assert.equal(scenario([0.1], 0).generation_capacity_request_count, 0);
for (const invalid of [null, undefined, NaN, Infinity, -0.1, "0.1"]) {
  assert.equal(scenario([invalid]).generation_capacity_request_count, null);
  assert.equal(scenario([invalid]).generation_capacity_cost_usd, null);
}
assert.equal(scenario([]).generation_capacity_request_count, 0);
assert.equal(scenario([0.5]).auto_execution, false);
console.log("Generation budget capacity: cumulative total, manifest order, invalid prices unknown, shared lifetime cap respected");
