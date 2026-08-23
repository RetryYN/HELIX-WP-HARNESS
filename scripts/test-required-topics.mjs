import assert from "node:assert/strict";
import { buildGateResult, generateDraft } from "./poc-draft-article.mjs";
import {
  analyzeCommonThemes,
  assembleRequiredTopics,
  checkRequiredTopicsCoverage,
  extractHeadings,
  extractPaaQuestions,
  tokenizeHeading,
} from "./poc-required-topics.mjs";

const group = {
  site: "solobiz",
  main_keyword: "ライター 副業",
  sub_keywords: ["記事作成 副業"],
  source_keyword_ids: ["main", "sub"],
};

assert.deepEqual(extractHeadings("<h1> ＳＥＯ&nbsp;記事 </h1><script><h2>除外</h2></script><h2>副業の始め方</h2>"), [
  { level: 1, text: "SEO 記事" },
  { level: 2, text: "副業の始め方" },
]);
assert.deepEqual([...tokenizeHeading("副業の始め方：ライター")], ["副業", "始め方", "ライター"]);
assert.deepEqual(extractPaaQuestions({ tasks: [{ result: [{ items: [{ type: "people_also_ask", items: [{ title: "副業で何を書く？" }] }] }] }] }), [
  { question: "副業で何を書く?", item_index: 0, rank_absolute: null },
]);

const pages = [
  {
    url: "https://example.test/a",
    ok: true,
    html_sha256: "a".repeat(64),
    headings: [{ level: 1, text: "副業 ライター 始め方" }],
    snapshot_refs: [{ snapshot_digest: "1".repeat(64), snapshot_file: "raw/a.json", rank: 1 }],
  },
  {
    url: "https://example.test/b",
    ok: true,
    html_sha256: "b".repeat(64),
    headings: [{ level: 2, text: "副業 ライター 仕事" }],
    snapshot_refs: [{ snapshot_digest: "2".repeat(64), snapshot_file: "raw/b.json", rank: 1 }],
  },
  {
    url: "https://example.test/c",
    ok: true,
    html_sha256: "c".repeat(64),
    headings: [{ level: 3, text: "副業 ライター 収入" }],
    snapshot_refs: [{ snapshot_digest: "3".repeat(64), snapshot_file: "raw/c.json", rank: 1 }],
  },
  {
    url: "https://example.test/d",
    ok: true,
    html_sha256: "d".repeat(64),
    headings: [{ level: 2, text: "副業 仕事" }],
    snapshot_refs: [{ snapshot_digest: "4".repeat(64), snapshot_file: "raw/d.json", rank: 1 }],
  },
];
const firstAnalysis = analyzeCommonThemes(pages);
const secondAnalysis = analyzeCommonThemes(pages);
assert.deepEqual(firstAnalysis, secondAnalysis, "same page input must produce same analysis");
assert.equal(firstAnalysis.verdict, "determined");
assert.deepEqual(firstAnalysis.common_themes.map((item) => item.topic), ["ライター", "副業"]);
assert.equal(firstAnalysis.common_themes.find((item) => item.topic === "副業").occurrence_count, 4);
assert.equal(firstAnalysis.common_themes.find((item) => item.topic === "ライター").occurrence_count, 3);

const insufficient = analyzeCommonThemes(pages.slice(0, 2));
assert.equal(insufficient.verdict, "insufficient");
assert.equal(insufficient.common_themes.length, 0);

const snapshots = [
  {
    keyword: group.main_keyword,
    source_keyword_id: "main",
    snapshot_digest: "a".repeat(64),
    snapshot_file: "raw/main.json",
    snapshot_url: "https://google.test/main",
    organic_urls: ["https://example.test/a", "https://example.test/b"],
    paa: [{ question: "副業で何を書く？", item_index: 0, rank_absolute: 2 }],
  },
  {
    keyword: group.sub_keywords[0],
    source_keyword_id: "sub",
    snapshot_digest: "b".repeat(64),
    snapshot_file: "raw/sub.json",
    snapshot_url: "https://google.test/sub",
    organic_urls: ["https://example.test/c", "https://example.test/d"],
    paa: [{ question: "記事作成の始め方は？", item_index: 0, rank_absolute: 2 }],
  },
];
const assembled = assembleRequiredTopics({ group, snapshots, pages });
assert.equal(assembled.required_topics.some((item) => item.topic === "副業" && item.kinds.includes("common_theme")), true);
assert.equal(assembled.required_topics.some((item) => item.topic === "副業で何を書く？" && item.kinds.includes("paa")), true);
for (const topic of assembled.required_topics) {
  assert.ok(topic.sources.length > 0, `topic ${topic.topic} must have sources`);
  for (const source of topic.sources) {
    assert.ok(source.snapshot_digest, `topic ${topic.topic} source must have snapshot digest`);
    assert.ok(source.snapshot_file, `topic ${topic.topic} source must have snapshot file`);
  }
}

const coverage = checkRequiredTopicsCoverage("副業と記事作成の始め方。", [{ topic: "副業" }, { topic: "記事作成" }]);
assert.equal(coverage.pass, true);
assert.deepEqual(checkRequiredTopicsCoverage("副業だけ。", [{ topic: "副業" }, { topic: "記事作成" }]).missing, ["記事作成"]);

const fixture = {
  ...assembled,
  heading_analysis: firstAnalysis,
  required_topics: [
    { topic: "副業", kinds: ["common_theme"], sources: [{ snapshot_digest: "1", fetch_digest: "2", url: "https://example.test/a" }] },
    { topic: "記事作成", kinds: ["paa"], sources: [{ snapshot_digest: "3", fetch_digest: null, url: "https://google.test/sub" }] },
  ],
  paa: [{ question: "記事作成", keyword: group.sub_keywords[0], snapshot_digest: "3", snapshot_file: "raw/sub.json" }],
};
const draftA = generateDraft(fixture);
const draftB = generateDraft(fixture);
assert.equal(draftA, draftB, "same input must generate identical markdown");
assert.match(draftA, /^# ライター 副業/m);
assert.match(draftA, /## ライター 副業の全体像/u);
assert.match(draftA, /記事作成 副業/u);
const gate = buildGateResult(fixture, draftA, "input-digest");
assert.equal(gate.keyword_coverage.pass, true);
assert.equal(gate.required_topics_coverage.pass, true);
assert.equal(gate.pass, true);

console.log("required topics/draft: OK");
