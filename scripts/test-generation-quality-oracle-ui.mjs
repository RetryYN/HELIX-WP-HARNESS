import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../docs/prototypes/wp-ops-dashboard/", import.meta.url),
  html = readFileSync(new URL("index.html", root), "utf8"),
  js = readFileSync(new URL("generation-quality.js", root), "utf8");

assert.match(html, /id="generation-quality-metrics"/u);
assert.match(html, /id="generation-quality-rows"/u);
assert.match(html, /generation-quality\.js/u);
assert.match(html, /決定論 generation quality oracle/u);
assert.match(js, /api\/v1\/generation-quality-oracle/u);
assert.match(js, /blocked_deterministic_gate_count/u);
assert.match(js, /editor_review_required_count/u);
assert.match(js, /human_quality_proven/u);
assert.match(js, /blocking_reasons/u);
assert.match(js, /row\.text/u);
assert.match(js, /data-site/u);
assert.match(js, /escapeHtml/u);
console.log(
  "generation quality oracle UI: OK (candidate diagnostics, blockers and explicit unproven-quality state)",
);
