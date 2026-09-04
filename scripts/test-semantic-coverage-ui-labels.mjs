import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../docs/prototypes/wp-ops-dashboard/", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
assert(html.includes("タイトル・見出しの単語出現チェック"));
assert(html.includes("語義・検索意図の一致、説明の十分性、同じ記事への統合可否は未検証"));
assert(html.includes('value="semantic_concept_observed">単語出現あり（意味は未検証）'));
const bundle = readFileSync(new URL("app.js", root), "utf8");
const start = bundle.indexOf("async function renderSemanticCoverage(){");
const end = bundle.indexOf("async function renderSemanticExpansions(){", start);
assert(start >= 0 && end > start);
const nodes = new Map();
const context = vm.createContext({
  data: { groups: [{ id: "g", site_id: "s", main_keyword: "検証" }] },
  siteSelector: { value: "s" },
  semanticCoverageGroup: { value: "g", dataset: { site: "s" } },
  semanticCoverageType: { value: "all" },
  semanticCoverageState: { value: "all" },
  semanticCoverageRequest: 0,
  URLSearchParams,
  yen: new Intl.NumberFormat("ja-JP"),
  escapeHtml: (value) => String(value),
  document: { querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {});
    return nodes.get(selector);
  } },
  fetch: async () => ({ ok: true, json: async () => ({
    summary: { candidate_with_semantic_concept_count: 1 },
    data: [{ text: "検証タイトル", main_keyword: "検証", content_type: "title",
      covered_concepts: [], uncovered_concepts: [],
      review_state: "semantic_concept_observed", coverage_digest: "a".repeat(64) }],
  }) }),
});
await vm.runInContext(bundle.slice(start, end) + "\nrenderSemanticCoverage()", context);
assert(nodes.get("#semantic-coverage-metrics").innerHTML.includes("単語出現あり"));
assert(!nodes.get("#semantic-coverage-metrics").innerHTML.includes("概念あり"));
assert(nodes.get("#semantic-coverage-rows").innerHTML.includes("意味・検索意図は未検証"));
console.log("semantic coverage UI labels: OK (actual renderer with fixture; not a browser layout test)");
