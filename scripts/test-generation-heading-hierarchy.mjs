import assert from "node:assert/strict";
import { validateGenerationChallengerOutput } from "./generation-challenger-result-contract.mjs";
const request = { request_digest: "fixture", request_id: "fixture", capability: "ai_heading", execution_authorized: true, maximum_cost_usd: 0.01, model_selection: { model: "fixture" }, input_contract: { estimated_maximum_input_tokens: 100 }, token_ceiling: { maximum_output_tokens: 100 }, input: { evidence_ids: ["e"], baseline_artifact_ids: [] } };
const heading = (level, parent_index) => ({ level, parent_index, text: "検証見出し", evidence_ids: ["e"] });
const check = (headings) => validateGenerationChallengerOutput(request, { request_digest: "fixture", capability: "ai_heading", model: "fixture", cost_usd: 0, usage: { input_tokens: 1, output_tokens: 1 }, output: { headings } });
for (const valid of [
  [heading(2, null), heading(3, 0), heading(3, 0)],
  [heading(2, null), heading(2, null), heading(3, 1)],
  [heading(2, undefined), heading(2, null), heading(2, null)],
]) assert.equal(check(valid).validation_state, "validated_not_selected");
for (const invalid of [
  [heading(3, null), heading(2, null), heading(2, null)],
  [heading(2, null), heading(3, null), heading(2, null)],
  [heading(2, null), heading(3, 0), heading(3, 1)],
  [heading(2, null), heading(2, 0), heading(2, null)],
  [heading(2, null), heading(2, null), heading(3, 0)],
  [heading(2, null), heading(3, 2), heading(2, null)],
  [heading(2, null), heading(3, "0"), heading(2, null)],
]) assert.throws(() => check(invalid), /H2|H3/);
console.log("Generation headings: H2 roots, H3 current-parent scope, orphan/nested/stale/forward parents rejected; no content mutation");
