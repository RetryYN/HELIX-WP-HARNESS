import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../docs/prototypes/wp-ops-dashboard/", import.meta.url),
  html = readFileSync(new URL("index.html", root), "utf8"),
  js = readFileSync(new URL("serp-depth-inventory.js", root), "utf8");
assert.match(html, /data-view="serp-depth-inventory"/u);
assert.match(html, /id="serp-depth-inventory"/u);
assert.match(html, /id="serp-depth-search"/u);
assert.match(html, /id="serp-depth-state"/u);
assert.match(html, /id="serp-depth-metrics"/u);
assert.match(html, /id="serp-depth-rows"/u);
assert.match(html, /serp-depth-inventory\.js/u);
assert.match(js, /api\/v1\/serp-depth-inventory/u);
assert.match(js, /rank_11_20_evidence/u);
assert.match(js, /未観測slot＝圏外ではない/u);
assert.match(js, /MutationObserver/u);
console.log("SERP depth inventory UI: OK (site scope, depth filters, rank 11-20 evidence, boundary copy)");

