import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const OPENAPI_URL = new URL(
  "../docs/research/evidence/seo-tool-a-openapi.json",
  import.meta.url,
);
const OPENAPI_BYTES = readFileSync(OPENAPI_URL);
const OPENAPI = JSON.parse(OPENAPI_BYTES.toString("utf8"));
const OPENAPI_SHA256 = createHash("sha256").update(OPENAPI_BYTES).digest("hex");
const SUGGEST_OPERATION = OPENAPI.paths?.["/v1/suggest-keywords"]?.post ?? {};

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ja-JP");
const list = (value) => (Array.isArray(value) ? value : []);
const numberFrom = (value) => {
  const parsed = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const resolveRef = (root, value) => {
  if (!value?.$ref) return value ?? {};
  const parts = value.$ref.split("/").slice(1);
  return parts.reduce((current, key) => current?.[key], root) ?? {};
};
const schemaFromRequest = () =>
  resolveRef(
    OPENAPI,
    SUGGEST_OPERATION.requestBody?.content?.["application/json"]?.schema,
  );
const responseItemSchema = () => {
  const response = resolveRef(
    OPENAPI,
    SUGGEST_OPERATION.responses?.["200"]?.content?.["application/json"]
      ?.schema,
  );
  return resolveRef(
    OPENAPI,
    response.properties?.data?.properties?.items?.items,
  );
};
const requestSchema = schemaFromRequest();
const responseSchema = responseItemSchema();

export const SUGGEST_CLASSES = Object.freeze([
  {
    value: 0,
    symbol: "＋",
    key: "direct",
    label: "直接",
    meaning: "元キーワードからの直接サジェスト",
    input_relation: "seed",
  },
  {
    value: 1,
    symbol: "＋＋",
    key: "recursive_direct",
    label: "再帰",
    meaning: "class 0 の結果に対する再サジェスト",
    input_relation: "class_0_result",
  },
  {
    value: 2,
    symbol: "＋α",
    key: "character_expansion",
    label: "文字拡張",
    meaning: "元キーワードへ文字を追加した入力のサジェスト",
    input_relation: "seed_plus_character",
  },
  {
    value: 3,
    symbol: "＋＋＋",
    key: "recursive_expansion",
    label: "再帰拡張",
    meaning: "class 1 または class 2 の結果に対する再帰",
    input_relation: "class_1_or_class_2_result",
  },
]);

export const APPEND_FAMILIES = Object.freeze([
  { family: "hiragana", examples: ["あ", "い", "う", "え", "お"] },
  { family: "latin", examples: ["a", "b", "c", "d", "e"] },
  { family: "digits", examples: ["1", "2", "3", "4", "5"] },
]);

const FALLBACK_ENGINES = [
  "google",
  "bing",
  "youtube",
  "googleVideo",
  "amazon",
  "rakuten",
  "googleShopping",
  "googleImage",
];
const requestProperties = requestSchema.properties ?? {};
const modeValues = list(requestProperties.modes?.items?.enum);
export const SUGGEST_ENGINES = Object.freeze(
  (modeValues.length ? modeValues : FALLBACK_ENGINES).map((mode) => ({
    mode,
    status: "not_acquired",
    request_count: 0,
    returned_count: 0,
    external_surface_connected: false,
    reason: "外部サジェスト結果を取得していないため、保持済みコーパスからは判定しない",
  })),
);

export const FILTER_FIELDS = Object.freeze([
  "suggestClass",
  "keyword",
  "seoDifficulty",
  "searchVolume",
  "cpc",
  "competition",
  "firstSeenRange",
]);
export const SORT_FIELDS = Object.freeze(
  list(requestProperties.sortBy?.enum).length
    ? requestProperties.sortBy.enum
    : [
        "keyword",
        "suggestClass",
        "seoDifficulty",
        "searchVolume",
        "cpc",
        "competition",
        "firstSeenRange",
      ],
);

const classByValue = new Map(SUGGEST_CLASSES.map((row) => [row.value, row]));
const classGraph = {
  seed: ["class_0", "class_2"],
  class_0: ["class_1"],
  class_1: ["class_3"],
  class_2: ["class_3"],
  class_3: [],
};

const classDescription =
  requestSchema.properties?.filter?.properties?.suggestClass?.description ??
  null;
const operationDescription = String(SUGGEST_OPERATION.description ?? "");
const approximateLimit = (pattern) =>
  numberFrom(operationDescription.match(pattern)?.[1]);
const documentedCredit = numberFrom(
  operationDescription.match(/([0-9]+(?:\.[0-9]+)?)\s*クレジット/u)?.[1],
);

const buildContract = () => ({
  operation_id: SUGGEST_OPERATION.operationId ?? "SuggestKeywordsController_search",
  method: "POST",
  path: "/v1/suggest-keywords",
  source_file: "docs/research/evidence/seo-tool-a-openapi.json",
  source_sha256: OPENAPI_SHA256,
  source_state: "official_schema_retrieved_locally",
  request: {
    required: list(requestSchema.required),
    properties: Object.keys(requestProperties).sort(),
    defaults: {
      modes: requestProperties.modes?.default ?? ["google"],
      increase_keyword: requestProperties.increaseKeyword?.default ?? false,
      sort_by: requestProperties.sortBy?.default ?? "searchVolume",
      order_by: requestProperties.orderBy?.default ?? "desc",
    },
    modes: modeValues.length ? modeValues : FALLBACK_ENGINES,
    filter_fields: FILTER_FIELDS,
    sort_fields: SORT_FIELDS,
    limit: {
      normal_approx: approximateLimit(/通常最大\s*([0-9,]+)件/u),
      increased_approx: approximateLimit(/increaseKeyword=trueで最大\s*([0-9,]+)件/u),
    },
  },
  response: {
    item_fields: Object.keys(responseSchema.properties ?? {}).sort(),
    metric_fields: Object.keys(responseSchema.properties?.metrics?.properties ?? {}).sort(),
  },
  credit: {
    per_request: documentedCredit,
    execution_state: "not_executed",
  },
  class_semantics: SUGGEST_CLASSES.map((row) => ({
    value: row.value,
    symbol: row.symbol,
    meaning: row.meaning,
    input_relation: row.input_relation,
  })),
  class_description_from_schema: classDescription,
  interpretation_policy:
    "区分は公開スキーマの説明と保持済みseedから作った計画であり、提供元内部アルゴリズムの証明ではない",
});

const sourceRowProjection = (row) => ({
  source_keyword_id: row.source_keyword_id ?? null,
  raw_keyword: row.raw_keyword ?? null,
  source_sheet: row.source_sheet ?? null,
  source_row: row.source_row ?? null,
  source_location: row.source_location ?? null,
  search_volume: row.search_volume ?? null,
  processing_state: row.processing_state ?? null,
});

const fallbackEvidence = (sourceRows) => {
  const grouped = new Map();
  for (const row of sourceRows) {
    const key = normalize(row.raw_keyword);
    if (!key) continue;
    const rows = grouped.get(key) ?? [];
    rows.push(sourceRowProjection(row));
    grouped.set(key, rows);
  }
  return {
    rows: [...grouped.entries()].map(([normalized_keyword, rows]) => ({
      normalized_keyword,
      representative_keyword: rows[0]?.raw_keyword ?? normalized_keyword,
      source_row_count: rows.length,
      source_sheet_count: new Set(rows.map((row) => row.source_sheet)).size,
      source_rows: rows,
      source_kind: "retained_workbook_not_external_autocomplete",
      external_acquisition_triggered: false,
    })),
    summary: { source_row_count: sourceRows.length },
  };
};

const buildSeeds = (siteId, sourceRows, suggestEvidence) => {
  const evidence = suggestEvidence?.rows?.length
    ? suggestEvidence
    : fallbackEvidence(sourceRows);
  const seeds = [];
  for (const row of evidence.rows ?? []) {
    const normalizedKeyword = normalize(row.normalized_keyword ?? row.representative_keyword);
    if (!normalizedKeyword) continue;
    const sourceRowsForSeed = list(row.source_rows)
      .map(sourceRowProjection)
      .sort(
        (left, right) =>
          String(left.source_keyword_id ?? "").localeCompare(
            String(right.source_keyword_id ?? ""),
          ) ||
          String(left.source_sheet ?? "").localeCompare(String(right.source_sheet ?? "")) ||
          Number(left.source_row ?? 0) - Number(right.source_row ?? 0),
      );
    const sourceKeywordIds = sourceRowsForSeed
      .map((source) => source.source_keyword_id)
      .filter(Boolean);
    const processingStates = new Set(
      sourceRowsForSeed.map((source) => source.processing_state).filter(Boolean),
    );
    const observedWorkbookState =
      processingStates.size > 1
        ? "mixed_retained_and_not_acquired"
        : processingStates.has("SERP未取得")
          ? "not_acquired"
          : "retained_or_unclassified";
    const base = {
      site_id: siteId,
      seed_id: `seed:${digest(`${siteId}\0${normalizedKeyword}`).slice(0, 24)}`,
      normalized_keyword: normalizedKeyword,
      representative_keyword:
        row.representative_keyword ?? sourceRowsForSeed[0]?.raw_keyword ?? normalizedKeyword,
      source_keyword_ids: sourceKeywordIds,
      raw_forms: [...new Set(sourceRowsForSeed.map((source) => source.raw_keyword).filter(Boolean))].sort(
        (left, right) => String(left).localeCompare(String(right), "ja"),
      ),
      source_locations: sourceRowsForSeed
        .map((source) => source.source_location ?? `${source.source_sheet ?? "?"}:${source.source_row ?? "?"}`)
        .filter(Boolean),
      source_row_count: sourceRowsForSeed.length || Number(row.source_row_count ?? 0),
      source_sheet_count:
        new Set(sourceRowsForSeed.map((source) => source.source_sheet).filter(Boolean)).size ||
        Number(row.source_sheet_count ?? 0),
      observed_workbook_state: observedWorkbookState,
      source_kind: "retained_workbook_not_external_autocomplete",
      external_suggest_class: null,
      observation_state: "not_observed_external_response",
      external_acquisition_triggered: false,
      source_rows: sourceRowsForSeed,
    };
    seeds.push({ ...base, evidence_digest: digest(base) });
  }
  return seeds.sort(
    (left, right) =>
      left.normalized_keyword.localeCompare(right.normalized_keyword, "ja") ||
      left.seed_id.localeCompare(right.seed_id),
  );
};

const buildFrontier = (siteId, seeds, contract) => {
  const rows = [];
  for (const seed of seeds) {
    for (const definition of SUGGEST_CLASSES) {
      const appendFamilies =
        definition.value === 2 || definition.value === 3
          ? APPEND_FAMILIES.map((family) => ({
              ...family,
              state: definition.value === 2 ? "plan_input_family" : "inherited_plan_input_family",
            }))
          : [];
      const base = {
        site_id: siteId,
        frontier_id: `frontier:${digest(`${seed.seed_id}\0${definition.value}`).slice(0, 24)}`,
        seed_id: seed.seed_id,
        normalized_seed: seed.normalized_keyword,
        suggest_class: definition.value,
        suggest_symbol: definition.symbol,
        suggest_class_key: definition.key,
        class_label: definition.label,
        meaning: definition.meaning,
        input_relation: definition.input_relation,
        append_families: appendFamilies,
        state: "plan_only_not_acquired",
        observed_result_count: 0,
        request_template: {
          method: contract.method,
          path: contract.path,
          execution_state: "not_executed",
          body: {
            keyword: "<seed keyword>",
            modes: contract.request.defaults.modes,
            increaseKeyword: contract.request.defaults.increase_keyword,
            filter: { suggestClass: [definition.value] },
            sortBy: contract.request.defaults.sort_by,
            orderBy: contract.request.defaults.order_by,
            limit: contract.request.limit.normal_approx,
          },
        },
        evidence_refs: {
          seed_evidence_digest: seed.evidence_digest,
          contract_source_sha256: contract.source_sha256,
        },
        external_acquisition_triggered: false,
      };
      rows.push({ ...base, evidence_digest: digest(base) });
    }
  }
  return rows;
};

const traceFor = (strategy) => {
  const steps = [];
  const seen = new Set();
  const visit = (node, depth, parent) => {
    if (seen.has(node)) return;
    seen.add(node);
    steps.push({ order: steps.length, node, parent, depth });
    const children = classGraph[node] ?? [];
    if (strategy === "breadth_first") {
      for (const child of children) {
        if (!seen.has(child)) steps.push({ order: -1, node: child, parent: node, depth: depth + 1, queued: true });
      }
      return;
    }
    for (const child of children.toReversed()) visit(child, depth + 1, node);
  };
  if (strategy === "breadth_first") {
    const queue = [{ node: "seed", depth: 0, parent: null }];
    while (queue.length) {
      const current = queue.shift();
      if (seen.has(current.node)) continue;
      seen.add(current.node);
      steps.push({ order: steps.length, ...current });
      for (const child of classGraph[current.node] ?? [])
        if (!seen.has(child)) queue.push({ node: child, parent: current.node, depth: current.depth + 1 });
    }
  } else visit("seed", 0, null);
  return {
    strategy,
    trace_state: "local_plan_trace_not_provider_trace",
    steps,
    node_order: steps.map((step) => step.node),
    max_depth: Math.max(...steps.map((step) => step.depth)),
  };
};

const buildTraversal = () => ({
  graph: Object.entries(classGraph).flatMap(([from, tos]) =>
    tos.map((to) => ({ from, to, relation: "contract_class_transition" })),
  ),
  traces: [traceFor("breadth_first"), traceFor("depth_first")],
  comparison: {
    strategies: ["breadth_first", "depth_first"],
    both_compatible_with_public_projection: true,
    confidence: "possible_not_proven",
    provider_internal_algorithm_proven: false,
    disambiguation_required: true,
    disambiguation_observations: [
      "同一seedのclass別レスポンス順序",
      "limitを変えたときの部分結果の安定性",
      "class 1/2/3のsource frontierを含む取得trace",
    ],
  },
  policy: "suggest-expansion-traversal-plan.v1",
});

const buildCoverage = (seeds, engines) => [
  {
    surface: "retained_workbook",
    state: "retained",
    seed_count: seeds.length,
    result_count: 0,
    reason: "seedの元行と正規化候補だけを保持。外部サジェスト結果ではない",
    external_acquisition_triggered: false,
  },
  ...engines.map((engine) => ({
    surface: engine.mode,
    state: engine.status,
    seed_count: 0,
    result_count: 0,
    reason: engine.reason,
    external_acquisition_triggered: false,
  })),
];

export function buildSuggestExpansionLogic({
  siteId,
  sourceRows = [],
  suggestEvidence = {},
} = {}) {
  if (!siteId) throw new TypeError("siteId is required");
  const contract = buildContract();
  const seeds = buildSeeds(siteId, sourceRows, suggestEvidence);
  const frontier = buildFrontier(siteId, seeds, contract);
  const engines = SUGGEST_ENGINES.map((engine) => ({ ...engine }));
  const traversal = buildTraversal();
  const coverage = buildCoverage(seeds, engines);
  const classCounts = Object.fromEntries(
    SUGGEST_CLASSES.map((definition) => [String(definition.value), seeds.length]),
  );
  const base = {
    schema_version: "suggest-expansion-logic.v1",
    site_id: siteId,
    policy: "suggest-expansion-logic.v1",
    source_policy: "official_contract_plus_retained_seed_plan",
    interpretation_policy:
      "classes_and_traces_are_contract_or_plan_evidence_not_provider_algorithm_proof",
    contract,
    classes: SUGGEST_CLASSES,
    append_families: APPEND_FAMILIES,
    seeds,
    frontier,
    engines,
    coverage,
    traversal,
    summary: {
      source_row_count: seeds.reduce((sum, seed) => sum + seed.source_row_count, 0),
      seed_count: seeds.length,
      frontier_count: frontier.length,
      frontier_class_counts: classCounts,
      observed_external_result_count: 0,
      engine_count: engines.length,
      engine_not_acquired_count: engines.filter((engine) => engine.status === "not_acquired").length,
      max_plan_depth: 3,
      source_rows_losslessly_retained: true,
      external_acquisition_triggered: false,
      auto_assignment: false,
      auto_generation: false,
      auto_publication: false,
    },
    external_acquisition_triggered: false,
    auto_assignment: false,
    auto_generation: false,
    auto_publication: false,
  };
  return { ...base, lineage_digest: digest(base) };
}

export const suggestExpansionClass = (value) => classByValue.get(Number(value)) ?? null;
export const suggestExpansionTraversalStrategies = Object.freeze([
  "breadth_first",
  "depth_first",
]);
