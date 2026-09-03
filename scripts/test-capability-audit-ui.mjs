import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../docs/prototypes/wp-ops-dashboard/", import.meta.url),
  html = readFileSync(new URL("index.html", root), "utf8"),
  js = readFileSync(new URL("capability-audit.js", root), "utf8");
assert.match(html, /data-view="capability-audit"/u);
assert.match(html, /id="capability-audit"/u);
assert.match(html, /capability-audit\.js/u);
assert.match(html, /id="capability-audit-status"/u);
assert.match(html, /id="capability-audit-blocker"/u);
assert.match(html, /value="freshness"/u);
assert.match(html, /value="crosswalk"/u);
assert.match(js, /api\/v1\/capability-audit/u);
assert.match(js, /public_contract_credits/u);
assert.match(js, /post_cutoff_update_count/u);
assert.match(js, /reaudit_required/u);
assert.match(js, /update_scope/u);
assert.match(js, /function_surface_count/u);
assert.match(js, /inventory_coverage_count/u);
assert.match(js, /target_capabilities/u);
assert.match(js, /mapping_state/u);
assert.match(js, /completion_claim/u);
assert.match(js, /外部取得0/u);
assert.match(js, /model実行0/u);
console.log("capability audit UI: OK (cross-capability filters, integrity/credit views, fail-closed status)");
