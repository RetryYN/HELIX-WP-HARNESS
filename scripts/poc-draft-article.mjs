import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkKeywordCoverage, digest } from "./keyword-serp-core.mjs";
import { checkRequiredTopicsCoverage, DEFAULT_OUTPUT_DIR } from "./poc-required-topics.mjs";

export const DEFAULT_REQUIRED_TOPICS_FILE = path.join(DEFAULT_OUTPUT_DIR, "required-topics.json");

function topicText(item) {
  return typeof item === "string" ? item : item.topic;
}

function sourceLabel(item) {
  return item.kinds?.includes("paa") ? "PAA質問" : "共通テーマ";
}

export function generateDraft(requiredTopicsResult) {
  const group = requiredTopicsResult.group;
  const mainKeyword = group.main_keyword;
  const subKeyword = group.sub_keywords[0] ?? "";
  const topics = requiredTopicsResult.required_topics;
  const title = `${mainKeyword}の始め方｜${subKeyword}で仕事を進める構成案`;
  const lines = [
    `# ${title}`,
    "",
    `「${mainKeyword}」を検討する読者に向けて、「${subKeyword}」を含む記事の構成骨子を整理します。本文の事実関係、相場、収入、制度などは推定せず、公開前に要出典として確認します。`,
    "",
    `## ${mainKeyword}の全体像`,
    "",
    `この節では「${mainKeyword}」について記述する。読者が目的、作業内容、確認手順を把握できるように整理する。数値や固有の事実は推定せず、要出典の確認欄を残す。`,
    "",
    `### ${subKeyword}との関係`,
    "",
    `この節では「${subKeyword}」について記述する。${mainKeyword}との関係を説明し、読者が自分に合う進め方を判断できる構成にする。具体的な条件は要出典として確認する。`,
    "",
  ];

  for (const [index, item] of topics.entries()) {
    const topic = topicText(item);
    const heading = index === 0 ? `## ${topic}を確認する` : `## ${topic}について整理する`;
    lines.push(
      heading,
      "",
      `この節では「${topic}」について記述する。${mainKeyword}の読者がこのテーマを確認する順序と判断材料を整理する。事実数値は記載せず、推定・要出典のプレースホルダとして扱う。`,
      "",
      "### 記述する内容",
      "",
      `- 要点: ${topic}に関する説明を記述する。`,
      "- 根拠: 要出典",
      "- 数値・相場・期間: 推定（要出典）",
      "",
      `### ${sourceLabel(item)}への回答枠`,
      "",
      `質問・テーマ: ${topic}`,
      "",
      `回答枠: ${topic}への回答を記述する。根拠を確認し、未確認の事実は推定（要出典）として残す。`,
      "",
    );
  }

  lines.push(
    `## ${mainKeyword}の記事公開前チェック`,
    "",
    `この節では「${mainKeyword}」と「${subKeyword}」のcoverage、各required topic、出典の有無を確認する。未確認の数値は推定（要出典）から更新し、PO承認前に公開しない。`,
    "",
    "- required topic coverage: 要確認",
    "- 事実・数値の根拠: 要出典",
    "- 公開判断: PO承認後に実施",
    "",
  );
  return lines.join("\n");
}

export function buildGateResult(requiredTopicsResult, markdown, inputDigest) {
  const group = {
    main_keyword: requiredTopicsResult.group.main_keyword,
    sub_keywords: requiredTopicsResult.group.sub_keywords,
  };
  const keywordCoverage = checkKeywordCoverage(markdown, group);
  const requiredTopicsCoverage = checkRequiredTopicsCoverage(markdown, requiredTopicsResult.required_topics);
  const commonVerdict = requiredTopicsResult.heading_analysis.verdict;
  return {
    schema_version: "wp-required-topics-gate.v1",
    input_digest: inputDigest,
    draft_digest: digest(markdown),
    keyword_coverage: keywordCoverage,
    required_topics_coverage: requiredTopicsCoverage,
    common_topics_verdict: commonVerdict,
    pass: keywordCoverage.pass && requiredTopicsCoverage.pass && commonVerdict !== "insufficient",
  };
}

export async function runDraftArticle({
  requiredTopicsFile = DEFAULT_REQUIRED_TOPICS_FILE,
  outputDir = DEFAULT_OUTPUT_DIR,
} = {}) {
  const input = JSON.parse(await readFile(path.resolve(requiredTopicsFile), "utf8"));
  const generationInput = {
    group: input.group,
    required_topics: input.required_topics,
    paa: input.paa,
  };
  const inputDigest = digest(generationInput);
  const markdown = generateDraft(input);
  const draftJson = {
    schema_version: "wp-draft-article-poc.v1",
    input_digest: inputDigest,
    required_topics_digest: input.reproducibility_digest,
    group: input.group,
    title: markdown.split("\n", 1)[0].replace(/^#\s+/u, ""),
    markdown,
    required_topics: input.required_topics,
    paa: input.paa,
  };
  const gate = buildGateResult(input, markdown, inputDigest);
  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });
  await writeFile(path.join(resolvedOutputDir, "draft-article.md"), markdown);
  await writeFile(path.join(resolvedOutputDir, "draft-article.json"), `${JSON.stringify(draftJson, null, 2)}\n`);
  await writeFile(path.join(resolvedOutputDir, "gate-result.json"), `${JSON.stringify(gate, null, 2)}\n`);
  return { ...draftJson, gate, outputDir: resolvedOutputDir };
}

async function main() {
  const result = await runDraftArticle();
  console.log(JSON.stringify({
    markdown: path.join(result.outputDir, "draft-article.md"),
    json: path.join(result.outputDir, "draft-article.json"),
    gate: path.join(result.outputDir, "gate-result.json"),
    input_digest: result.input_digest,
    keyword_coverage: result.gate.keyword_coverage.pass ? "pass" : "fail",
    required_topics_coverage: result.gate.required_topics_coverage.pass ? "pass" : "fail",
    pass: result.gate.pass,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
