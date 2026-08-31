import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../docs/prototypes/wp-ops-dashboard/", import.meta.url),
  html = readFileSync(new URL("index.html", root), "utf8"),
  css = readFileSync(new URL("styles.css", root), "utf8"),
  js = readFileSync(new URL("app.js", root), "utf8");
assert.match(html, /id="sidebar-toggle"/u);
assert.match(html, /id="sidebar-resizer"[^>]+role="separator"/u);
assert.match(css, /--sidebar-width:\s*248px/u);
assert.match(css, /cursor:\s*col-resize/u);
assert.match(css, /\.sidebar-collapsed/u);
assert.match(
  css,
  /@media\s*\(max-width:\s*850px\)[\s\S]*\.sidebar-resizer\s*\{\s*display:\s*none/u,
);
assert.match(js, /function initializeSplitSidebar\(\)/u);
assert.match(js, /localStorage\.setItem\(storageKey/u);
assert.match(js, /setPointerCapture/u);
assert.match(js, /\["ArrowLeft",\s*"ArrowRight"\]/u);
console.log(
  "dashboard split sidebar: OK (resize, collapse, persistence, keyboard, mobile fallback)",
);
