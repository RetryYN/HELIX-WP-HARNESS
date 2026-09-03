import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../docs/prototypes/wp-ops-dashboard/", import.meta.url),
  html = readFileSync(new URL("index.html", root), "utf8"),
  css = readFileSync(new URL("styles.css", root), "utf8"),
  js = readFileSync(new URL("app.js", root), "utf8"),
  traversal = readFileSync(new URL("semantic-traversal-controls.js", root), "utf8"),
  contentLineage = readFileSync(new URL("keyword-content-lineage.js", root), "utf8"),
  latentDemandTraversal = readFileSync(
    new URL("latent-demand-traversal.js", root),
    "utf8",
  ),
  expansionLineage = readFileSync(
    new URL("keyword-expansion-lineage.js", root),
    "utf8",
  ),
  semanticBindings = readFileSync(
    new URL("semantic-coverage-bindings.js", root),
    "utf8",
  );
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
assert.match(html, /id="semantic-strategy"/u);
assert.match(html, /value="breadth_first"/u);
assert.match(html, /value="depth_first"/u);
assert.match(html, /semantic-traversal-controls\.js/u);
assert.match(traversal, /api\/v1\/public-semantic-graph/u);
assert.match(traversal, /strategyControl\.value/u);
assert.match(traversal, /dispatchEvent\(new Event\("input"/u);
assert.match(html, /data-view="keyword-content-lineage"/u);
assert.match(html, /id="keyword-content-lineage"/u);
assert.match(html, /keyword-content-lineage\.js/u);
assert.match(contentLineage, /api\/v1\/keyword-content-lineage/u);
assert.match(contentLineage, /自動反映0/u);
assert.match(contentLineage, /MutationObserver/u);
assert.match(html, /semantic-coverage-bindings\.js/u);
assert.match(semanticBindings, /semanticCoverageGroup/u);
assert.match(html, /data-view="latent-demand-traversal"/u);
assert.match(html, /id="latent-demand-traversal"/u);
assert.match(html, /latent-demand-traversal\.js/u);
assert.match(latentDemandTraversal, /api\/v1\/latent-demand-traversal/u);
assert.match(latentDemandTraversal, /depth_first/u);
assert.match(latentDemandTraversal, /自動反映0/u);
assert.match(html, /data-view="keyword-expansion-lineage"/u);
assert.match(html, /id="keyword-expansion-lineage"/u);
assert.match(html, /keyword-expansion-lineage\.js/u);
assert.match(expansionLineage, /api\/v1\/keyword-expansion-lineage/u);
assert.match(expansionLineage, /not_acquired/u);
assert.match(expansionLineage, /自動割当0/u);
console.log(
  "dashboard split sidebar: OK (resize, collapse, persistence, keyboard, mobile fallback)",
);
