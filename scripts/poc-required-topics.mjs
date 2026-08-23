import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  digest,
  normalizeForCoverage,
  normalizeKeyword,
  organicUrls,
} from "./keyword-serp-core.mjs";

export const DEFAULT_GROUP = Object.freeze({
  site: "solobiz",
  main_keyword: "ライター 副業",
  sub_keywords: ["記事作成 副業"],
  source_keyword_ids: [
    "bec89ab9:キーワード割り当て:8",
    "bec89ab9:キーワード割り当て:7",
  ],
});

export const DEFAULT_SERP_RESULT = "artifacts/poc/keyword-serp/result.json";
export const DEFAULT_OUTPUT_DIR = "artifacts/poc/required-topics";
export const DEFAULT_USER_AGENT = "HELIX-PoC5-required-topics/1.0 (known SERP URL fetch)";
export const DEFAULT_MAX_ATTEMPTS = 2;
export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;

const PARTICLES = [
  "という",
  "について",
  "における",
  "に対する",
  "に関する",
  "による",
  "として",
  "までの",
  "からの",
  "への",
  "では",
  "には",
  "へは",
  "とは",
  "との",
  "でも",
  "だけ",
  "しか",
  "ほど",
  "など",
  "から",
  "まで",
  "より",
  "ながら",
  "たり",
  "つつ",
  "ので",
  "のに",
  "のか",
  "ばかり",
  "って",
  "なり",
  "なら",
  "こそ",
  "さえ",
  "は",
  "が",
  "を",
  "に",
  "へ",
  "と",
  "で",
  "や",
  "も",
  "の",
];

const TOKEN_SPLITTER = new RegExp(
  `(?:${PARTICLES.sort((left, right) => right.length - left.length).join("|")}|\\p{P}|\\p{S}|\\s)+`,
  "gu",
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeHeadingText(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/giu, (whole, entity) => {
    const lower = entity.toLowerCase();
    if (lower === "nbsp") return " ";
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos" || lower === "#39") return "'";
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      try {
        return Number.isInteger(codePoint) ? String.fromCodePoint(codePoint) : whole;
      } catch {
        return whole;
      }
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      try {
        return Number.isInteger(codePoint) ? String.fromCodePoint(codePoint) : whole;
      } catch {
        return whole;
      }
    }
    return whole;
  });
}

export function extractHeadings(html) {
  const withoutNonContent = String(html)
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, " ");
  const headings = [];
  const headingPattern = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1\s*>/giu;
  for (const match of withoutNonContent.matchAll(headingPattern)) {
    const text = normalizeHeadingText(
      decodeHtmlEntities(
        match[2]
          .replace(/<br\s*\/?>/giu, " ")
          .replace(/<[^>]*>/gu, " "),
      ),
    );
    if (!text) continue;
    headings.push({ level: Number(match[1]), text });
  }
  return headings;
}

export function tokenizeHeading(value) {
  const normalized = normalizeHeadingText(value);
  return new Set(normalized.split(TOKEN_SPLITTER).map((token) => token.trim()).filter(Boolean));
}

function pageTokens(headings) {
  const tokens = new Set();
  for (const heading of headings) {
    for (const token of tokenizeHeading(heading.text)) tokens.add(token);
  }
  return tokens;
}

function sortSources(sources) {
  return [...sources].sort((left, right) =>
    left.snapshot_digest.localeCompare(right.snapshot_digest) ||
    String(left.url ?? "").localeCompare(String(right.url ?? "")) ||
    String(left.fetch_digest ?? "").localeCompare(String(right.fetch_digest ?? "")),
  );
}

function uniqueSources(sources) {
  const seen = new Set();
  return sortSources(sources).filter((source) => {
    const key = JSON.stringify([
      source.snapshot_digest,
      source.fetch_digest,
      source.url,
      source.kind,
      source.question,
      source.item_index,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractPaaQuestions(snapshot) {
  const result = snapshot?.tasks?.[0]?.result?.[0];
  const questions = [];
  for (const item of result?.items ?? []) {
    if (item.type !== "people_also_ask") continue;
    for (const [itemIndex, paa] of (item.items ?? []).entries()) {
      const question = normalizeHeadingText(paa.title ?? "");
      if (!question) continue;
      questions.push({ question, item_index: itemIndex, rank_absolute: item.rank_absolute ?? null });
    }
  }
  return questions;
}

export function analyzeCommonThemes(pages, { minimumSuccessfulPages = 3 } = {}) {
  const successfulPages = pages.filter((page) => page.ok);
  const pageCount = successfulPages.length;
  if (pageCount < minimumSuccessfulPages) {
    return {
      verdict: "insufficient",
      reason: `successful_pages=${pageCount} is below minimum=${minimumSuccessfulPages}`,
      successful_page_count: pageCount,
      minimum_successful_pages: minimumSuccessfulPages,
      threshold: null,
      common_themes: [],
    };
  }

  const tokenPages = successfulPages.map((page) => ({ page, tokens: pageTokens(page.headings) }));
  const allTokens = new Set(tokenPages.flatMap(({ tokens }) => [...tokens]));
  const commonThemes = [...allTokens]
    .map((token) => {
      const matchedPages = tokenPages.filter(({ tokens }) => tokens.has(token)).map(({ page }) => page);
      return { token, matchedPages, occurrence_count: matchedPages.length };
    })
    .filter((item) => item.occurrence_count > pageCount / 2)
    .sort((left, right) => left.token.localeCompare(right.token, "ja") || left.token.localeCompare(right.token));

  return {
    verdict: "determined",
    reason: null,
    successful_page_count: pageCount,
    minimum_successful_pages: minimumSuccessfulPages,
    threshold: `occurrence_count > ${pageCount / 2}`,
    common_themes: commonThemes.map(({ token, matchedPages, occurrence_count }) => ({
      topic: token,
      token,
      occurrence_count,
      page_count: pageCount,
      sources: uniqueSources(
        matchedPages.flatMap((page) =>
          page.snapshot_refs.map((snapshotRef) => ({
            kind: "heading_fetch",
            snapshot_digest: snapshotRef.snapshot_digest,
            snapshot_file: snapshotRef.snapshot_file,
            fetch_digest: page.html_sha256,
            url: page.url,
            matched_headings: page.headings.filter((heading) => tokenizeHeading(heading.text).has(token)),
          })),
        ),
      ),
    })),
  };
}

export function checkRequiredTopicsCoverage(content, requiredTopics) {
  const normalizedContent = normalizeForCoverage(content);
  const topics = requiredTopics.map((item) => {
    const topic = typeof item === "string" ? item : item.topic;
    const normalized = normalizeForCoverage(topic);
    return { topic, normalized, present: Boolean(normalized) && normalizedContent.includes(normalized) };
  });
  return {
    pass: topics.every((item) => item.present),
    topics,
    missing: topics.filter((item) => !item.present).map((item) => item.topic),
  };
}

function canonicalFetchUrl(url) {
  const parsed = new URL(url);
  if (!/^https?:$/u.test(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`unsupported known URL: ${url}`);
  }
  parsed.hash = "";
  return parsed.toString();
}

function isRetryableError(error) {
  return error?.retryable === true || /timed out|fetch failed|network|socket|reset|429|5\d\d/iu.test(error?.message ?? "");
}

function describeFetchError(error, timeoutMs) {
  if (error?.name === "AbortError") return `timeout after ${timeoutMs}ms`;
  const cause = [error?.cause?.code, error?.cause?.syscall, error?.cause?.hostname].filter(Boolean).join(" ");
  return cause ? `${String(error?.message ?? error)} (${cause})` : String(error?.message ?? error);
}

async function readResponseBytes(response, maxBytes) {
  if (!response.body?.getReader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new Error(`response exceeds ${maxBytes} bytes`);
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    size += chunk.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`response exceeds ${maxBytes} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

async function fetchOne(page, {
  fetchImpl = globalThis.fetch,
  userAgent = DEFAULT_USER_AGENT,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  let url;
  try {
    url = canonicalFetchUrl(page.url);
  } catch (error) {
    return {
      ...page,
      ok: false,
      attempts: 0,
      status: null,
      content_type: null,
      html_sha256: null,
      headings: [],
      error: String(error?.message ?? error),
    };
  }
  let lastError = null;
  let attempts = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw error;
      }
      const bytes = await readResponseBytes(response, maxBytes);
      const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const headings = extractHeadings(html);
      return {
        ...page,
        ok: true,
        attempts: attempt,
        status: response.status,
        content_type: response.headers.get("content-type") ?? null,
        html_sha256: sha256(bytes),
        headings,
      };
    } catch (error) {
      lastError = error;
      if (error?.name === "AbortError") error.retryable = true;
      if (attempt >= maxAttempts || !isRetryableError(error)) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    ...page,
    ok: false,
    attempts,
    status: null,
    content_type: null,
    html_sha256: null,
    headings: [],
    error: describeFetchError(lastError, timeoutMs),
  };
}

export async function fetchKnownPages(pages, options = {}) {
  const sortedPages = [...pages].sort((left, right) => left.url.localeCompare(right.url, "en"));
  const fetched = [];
  for (const page of sortedPages) fetched.push(await fetchOne(page, options));
  return fetched;
}

function snapshotFileForTask(resultPath, task) {
  const resultDir = path.dirname(resultPath);
  const rawPath = path.resolve(resultDir, task.raw_file);
  const rawRoot = path.resolve(resultDir, "raw");
  if (rawPath !== rawRoot && !rawPath.startsWith(`${rawRoot}${path.sep}`)) {
    throw new Error(`raw snapshot is outside raw directory: ${task.raw_file}`);
  }
  return rawPath;
}

export async function loadGroupSnapshots({
  resultPath = DEFAULT_SERP_RESULT,
  group = DEFAULT_GROUP,
} = {}) {
  const resolvedResultPath = path.resolve(resultPath);
  const result = JSON.parse(await readFile(resolvedResultPath, "utf8"));
  const keywords = [group.main_keyword, ...group.sub_keywords].map(normalizeKeyword);
  const tasks = keywords.map((keyword) => {
    const matches = (result.tasks ?? []).filter((task) => normalizeKeyword(task.keyword) === keyword);
    if (matches.length !== 1) throw new Error(`expected exactly one SERP snapshot for ${keyword}, found ${matches.length}`);
    return matches[0];
  });
  const snapshots = [];
  for (const task of tasks) {
    const rawPath = snapshotFileForTask(resolvedResultPath, task);
    const rawText = await readFile(rawPath, "utf8");
    const raw = JSON.parse(rawText);
    const snapshotDigest = task.response_digest ?? digest(raw);
    if (snapshotDigest !== digest(raw)) throw new Error(`snapshot digest mismatch: ${task.keyword}`);
    const resultData = raw.tasks?.[0]?.result?.[0];
    snapshots.push({
      keyword: task.keyword,
      normalized_keyword: normalizeKeyword(task.keyword),
      source_keyword_id: task.source_keyword_id,
      snapshot_digest: snapshotDigest,
      snapshot_file: path.relative(process.cwd(), rawPath),
      snapshot_url: resultData?.check_url ?? null,
      raw,
      organic_urls: organicUrls(raw, 5),
      paa: extractPaaQuestions(raw),
    });
  }
  return { resultPath: resolvedResultPath, sourceResult: result, snapshots };
}

export function buildKnownPages(snapshots) {
  const byUrl = new Map();
  for (const snapshot of snapshots) {
    for (const [rank, url] of snapshot.organic_urls.entries()) {
      if (!byUrl.has(url)) byUrl.set(url, { url, snapshot_refs: [] });
      byUrl.get(url).snapshot_refs.push({
        keyword: snapshot.keyword,
        source_keyword_id: snapshot.source_keyword_id,
        snapshot_digest: snapshot.snapshot_digest,
        snapshot_file: snapshot.snapshot_file,
        rank: rank + 1,
      });
    }
  }
  return [...byUrl.values()]
    .map((page) => ({ ...page, snapshot_refs: [...page.snapshot_refs].sort((left, right) => left.snapshot_digest.localeCompare(right.snapshot_digest) || left.rank - right.rank) }))
    .sort((left, right) => left.url.localeCompare(right.url, "en"));
}

export function assembleRequiredTopics({ group = DEFAULT_GROUP, snapshots, pages }) {
  const headingAnalysis = analyzeCommonThemes(pages);
  const paaRows = snapshots.flatMap((snapshot) =>
    snapshot.paa.map((paa) => ({
      ...paa,
      keyword: snapshot.keyword,
      source_keyword_id: snapshot.source_keyword_id,
      snapshot_digest: snapshot.snapshot_digest,
      snapshot_file: snapshot.snapshot_file,
      snapshot_url: snapshot.snapshot_url,
    })),
  );

  const topicsByKey = new Map();
  const addTopic = (topic) => {
    const key = normalizeForCoverage(topic.topic);
    if (!key) return;
    const current = topicsByKey.get(key);
    if (!current) {
      topicsByKey.set(key, {
        id: `${topic.kind}:${key}`,
        topic: topic.topic,
        kinds: [topic.kind],
        sources: uniqueSources(topic.sources),
      });
      return;
    }
    current.kinds = [...new Set([...current.kinds, topic.kind])].sort();
    current.sources = uniqueSources([...current.sources, ...topic.sources]);
  };

  for (const theme of headingAnalysis.common_themes) addTopic({ ...theme, kind: "common_theme" });
  for (const paa of paaRows) {
    addTopic({
      topic: paa.question,
      kind: "paa",
      sources: [{
        kind: "paa_snapshot",
        snapshot_digest: paa.snapshot_digest,
        snapshot_file: paa.snapshot_file,
        fetch_digest: null,
        url: paa.snapshot_url,
        keyword: paa.keyword,
        source_keyword_id: paa.source_keyword_id,
        question: paa.question,
        item_index: paa.item_index,
        rank_absolute: paa.rank_absolute,
      }],
    });
  }

  const requiredTopics = [...topicsByKey.values()];
  const sourceDigest = digest({
    group,
    snapshots: snapshots.map(({ keyword, snapshot_digest, organic_urls, paa }) => ({ keyword, snapshot_digest, organic_urls, paa })),
    pages: pages.map(({ url, snapshot_refs, ok, html_sha256, headings, error }) => ({ url, snapshot_refs, ok, html_sha256, headings, error })),
  });
  return {
    schema_version: "wp-required-topics-poc.v1",
    group: {
      site: group.site,
      main_keyword: group.main_keyword,
      sub_keywords: [...group.sub_keywords],
      source_keyword_ids: [...group.source_keyword_ids],
    },
    input: {
      serp_result_file: path.relative(process.cwd(), path.resolve(DEFAULT_SERP_RESULT)),
      snapshots: snapshots.map(({ keyword, source_keyword_id, snapshot_digest, snapshot_file, organic_urls }) => ({
        keyword,
        source_keyword_id,
        snapshot_digest,
        snapshot_file,
        organic_urls,
      })),
    },
    fetch: {
      requested_url_count: pages.length,
      successful_url_count: pages.filter((page) => page.ok).length,
      failed_url_count: pages.filter((page) => !page.ok).length,
      pages,
    },
    heading_analysis: {
      tokenizer: "nfkc-particle-symbol-split.v1",
      ...headingAnalysis,
    },
    paa: paaRows.map((paa) => ({
      question: paa.question,
      keyword: paa.keyword,
      source_keyword_id: paa.source_keyword_id,
      snapshot_digest: paa.snapshot_digest,
      snapshot_file: paa.snapshot_file,
      snapshot_url: paa.snapshot_url,
      item_index: paa.item_index,
      rank_absolute: paa.rank_absolute,
    })),
    required_topics: requiredTopics,
    reproducibility_digest: sourceDigest,
  };
}

export async function runRequiredTopics({
  resultPath = DEFAULT_SERP_RESULT,
  outputDir = DEFAULT_OUTPUT_DIR,
  group = DEFAULT_GROUP,
  fetchOptions = {},
} = {}) {
  const loaded = await loadGroupSnapshots({ resultPath, group });
  const pages = buildKnownPages(loaded.snapshots);
  const fetchedPages = await fetchKnownPages(pages, fetchOptions);
  const result = assembleRequiredTopics({ group, snapshots: loaded.snapshots, pages: fetchedPages });
  result.input.serp_result_file = path.relative(process.cwd(), path.resolve(resultPath));
  result.input.snapshot_selection_digest = digest(result.input.snapshots);
  result.fetch.user_agent = fetchOptions.userAgent ?? DEFAULT_USER_AGENT;
  result.fetch.max_attempts = fetchOptions.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  result.fetch.max_bytes = fetchOptions.maxBytes ?? DEFAULT_MAX_BYTES;
  result.fetch.timeout_ms = fetchOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  result.reproducibility_digest = digest({
    input: result.input,
    fetch: result.fetch,
    heading_analysis: result.heading_analysis,
    paa: result.paa,
    required_topics: result.required_topics,
  });
  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });
  await writeFile(path.join(resolvedOutputDir, "required-topics.json"), `${JSON.stringify(result, null, 2)}\n`);
  return { ...result, outputDir: resolvedOutputDir };
}

async function main() {
  const result = await runRequiredTopics();
  console.log(JSON.stringify({
    output: path.join(result.outputDir, "required-topics.json"),
    requested_url_count: result.fetch.requested_url_count,
    successful_url_count: result.fetch.successful_url_count,
    failed_url_count: result.fetch.failed_url_count,
    common_theme_count: result.heading_analysis.common_themes.length,
    required_topics_count: result.required_topics.length,
    verdict: result.heading_analysis.verdict,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
