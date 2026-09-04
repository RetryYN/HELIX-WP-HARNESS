import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../docs/prototypes/wp-ops-dashboard/", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const js = readFileSync(new URL("serp-db-retention-audit.js", root), "utf8");
assert.match(html, /serp-db-retention-audit-summary/u);
assert.match(html, /serp-db-retention-audit-rows/u);
assert.match(html, /serp-db-retention-audit\.js/u);
assert.match(html, /SQLite投影/u);
assert.match(html, /dropは未取得ではなく/u);
assert.match(js, /api\/v1\/serp-db-retention/u);
assert.match(js, /dropped_nonempty/u);
assert.match(js, /unconnected非空drop/u);
assert.match(js, /next_cursor/u);
console.log("SERP DB retention UI: OK (scope-separated raw-to-DB drops, policy boundary, and pagination hooks are visible)");
