import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildKeywordHierarchy } from "./keyword-hierarchy.mjs";
import { DIRECT_BRANCH, branchForRow, buildMindmapSource, mermaidLabel, rankedBranches } from "../docs/prototypes/wp-ops-dashboard/keyword-mindmap.mjs";

const hostile = buildKeywordHierarchy([
  { source_keyword_id: "root", raw_keyword: "就活", search_volume: 10000 },
  { source_keyword_id: "it", raw_keyword: "it 就活", search_volume: 390 },
  { source_keyword_id: "hostile", raw_keyword: "it 就活 (2027)[比較]{新卒}", search_volume: 20 },
]);
assert.equal(branchForRow(hostile.find((row) => row.source_keyword_id === "it")), DIRECT_BRANCH, "context root is not a semantic branch");
assert.equal(mermaidLabel('就活 (2027)[比較]{新卒}<script>'), "就活 2027 比較 新卒 script", "mindmap shape syntax must be removed from external labels");
const hostileMindmap = buildMindmapSource(hostile);
assert.ok(hostileMindmap.source.startsWith("mindmap\n"));
assert.doesNotMatch(hostileMindmap.source, /2027\)|\[比較|\{新卒/, "external keyword punctuation must not escape a mindmap node");
assert.match(hostileMindmap.source, /◇/, "derived nodes remain visibly distinct");

const evidence = JSON.parse(readFileSync(new URL("../artifacts/poc/keyword-workbook-100-live/result.json", import.meta.url), "utf8"));
const actual = buildKeywordHierarchy(evidence.tasks.map((row) => ({ source_keyword_id: row.source_keyword_id, raw_keyword: row.keyword, search_volume: row.search_volume })));
const itRows = actual.filter((row) => row.context_scope_id === "context:it");
const branches = rankedBranches(itRows);
assert.equal(itRows.length, 84);
assert.equal(branches[0].key, "軸");
assert.equal(branches[0].count, 8);
assert.ok(branches.every((branch, index) => index === 0 || branches[index - 1].count >= branch.count), "branch selector is ordered by keyword count");
const actualMindmap = buildMindmapSource(itRows.filter((row) => branchForRow(row) === branches[0].key));
assert.equal(actualMindmap.nodes.filter((node) => node.path.length === 1).length, 1);
assert.ok(actualMindmap.nodes.length > 1);
console.log("keyword mindmap source: OK (safe labels, ranked branch default, one root, derived marker)");
