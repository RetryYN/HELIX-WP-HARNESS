import { createHash } from "node:crypto";

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const hasText = (text, pattern) => pattern.test(String(text ?? ""));

const schemaHasProperty = (schema, property) =>
  Boolean(schema?.properties?.[property]);

const traversalFixture = Object.freeze({
  root: [
    { type: "lsi", value: "alpha" },
    { type: "lsi", value: "beta" },
  ],
  alpha: [
    { type: "lsi", value: "shared" },
    { type: "paa", value: "alpha question" },
  ],
  beta: [
    { type: "lsi", value: "shared" },
    { type: "paa", value: "beta question" },
  ],
  shared: [{ type: "lsi", value: "deep" }],
});

function expandFixture(strategy, { maxDepth = 2 } = {}) {
  const pending = [{ keyword: "root", depth: 0 }];
  const expanded = new Set();
  const visits = [];
  const occurrences = [];
  while (pending.length) {
    const entry = strategy === "depth_first" ? pending.pop() : pending.shift();
    if (!entry || expanded.has(entry.keyword)) continue;
    expanded.add(entry.keyword);
    visits.push({ keyword: entry.keyword, depth: entry.depth });
    if (entry.depth >= maxDepth) continue;
    const children = traversalFixture[entry.keyword] ?? [];
    for (const child of children) {
      occurrences.push({
        type: child.type,
        value: child.value,
        sourceKeyword: entry.keyword,
        depth: entry.depth + 1,
      });
    }
    const next = children.map((child) => ({
      keyword: child.value,
      depth: entry.depth + 1,
    }));
    if (strategy === "depth_first") pending.push(...next.toReversed());
    else pending.push(...next);
  }
  return { visits, occurrences };
}

function projectPublicResponse(occurrences) {
  const byIdentity = new Map();
  for (const occurrence of occurrences) {
    const identity = `${occurrence.type}\0${occurrence.value}`;
    const item = byIdentity.get(identity) ?? {
      type: occurrence.type,
      value: occurrence.value,
      count: 0,
      parents: new Set(),
    };
    item.count += 1;
    item.parents.add(occurrence.sourceKeyword);
    byIdentity.set(identity, item);
  }
  const importance = (count) => (count >= 3 ? "high" : count === 2 ? "medium" : "low");
  return [...byIdentity.values()]
    .map((item) => ({
      type: item.type,
      [item.type === "paa" ? "question" : "keyword"]: item.value,
      importance: importance(item.count),
      // The public schema does not define which parent wins after aggregation;
      // lexical selection is one valid implementation compatible with it.
      sourceKeyword: [...item.parents].sort((a, b) => a.localeCompare(b, "ja"))[0],
    }))
    .sort(
      (a, b) =>
        (a.type === "lsi" ? 0 : 1) - (b.type === "lsi" ? 0 : 1) ||
        (a.keyword ?? a.question).localeCompare(b.keyword ?? b.question, "ja"),
    );
}

export function buildTraversalIdentifiabilityProof({ checkedAt = "2026-09-03" } = {}) {
  const dfs = expandFixture("depth_first");
  const bfs = expandFixture("breadth_first");
  const dfsPublic = projectPublicResponse(dfs.occurrences);
  const bfsPublic = projectPublicResponse(bfs.occurrences);
  const base = {
    schema_version: "seo-tool-a-traversal-identifiability.v1",
    checked_at: checkedAt,
    fixture: {
      root: "root",
      max_depth: 2,
      graph_digest: digest(traversalFixture),
      purpose: "同一の公開projectionをDFS/BFSの異なる内部訪問順から生成できることを示す反例",
    },
    traces: {
      depth_first: dfs.visits,
      breadth_first: bfs.visits,
    },
    trace_order_differs: JSON.stringify(dfs.visits) !== JSON.stringify(bfs.visits),
    public_projection: {
      depth_first: dfsPublic,
      breadth_first: bfsPublic,
      equal: JSON.stringify(dfsPublic) === JSON.stringify(bfsPublic),
      exposed_fields: ["type", "keyword|question", "importance", "sourceKeyword"],
      hidden_fields: ["depth", "visit_order", "stack_or_queue", "duplicate_parent_set"],
      parent_selection: "lexical_canonical_parent_for_counterexample",
      importance_projection: "illustrative_count_bucket_only; provider thresholds are not documented",
    },
    identifiability_state: "not_identifiable_from_public_projection",
    conclusion:
      "内部traceを返さず、重複を出現回数と集約itemへ投影する契約では、DFSとBFSの少なくとも二つの実装が同じ公開レスポンスを生成できる。したがって公開レスポンスだけからDFSを証明できない。",
    required_disambiguation: [
      "同一seed・同一グラフに対する親別raw responseと深さ付き訪問順",
      "limitまたは途中停止時の応答prefixと取得単位の対応",
      "重複itemのsourceKeyword選択規則またはprovider確認",
    ],
    external_request_executed: false,
    paid_request_executed: false,
    credentials_used: false,
    automatic_mutation: false,
  };
  return { ...base, proof_digest: digest(base) };
}

export function buildTraversalHypothesis(spec, { checkedAt = "2026-09-03" } = {}) {
  const operation = Object.values(spec.paths ?? {})
    .flatMap((methods) => Object.values(methods))
    .find((row) => row?.operationId === "OtherKeywordsController_search");
  if (!operation) throw new Error("OtherKeywordsController_search is missing");
  const responseSchema = spec.components?.schemas?.OtherKeywordsResponseDto;
  if (!responseSchema) throw new Error("OtherKeywordsResponseDto is missing");
  const description = operation.description ?? "";
  const itemSchema = responseSchema.properties?.data?.properties?.items?.items;
  const metricsSchema = itemSchema?.properties?.metrics;
  const signals = [
    {
      id: "bounded_recursive_expansion",
      observed: hasText(description, /最大2階層まで.*再帰取得/u),
      evidence_location: "OtherKeywordsController_search.description",
      evidence: "公開説明はLSI/PAAを最大2階層まで再帰取得すると記載する",
      strength: "explicit_contract_text",
    },
    {
      id: "parent_source_field",
      observed: schemaHasProperty(itemSchema, "sourceKeyword"),
      evidence_location: "OtherKeywordsResponseDto.data.items[].sourceKeyword",
      evidence: "各itemに取得元キーワードを返すschemaがある",
      strength: "explicit_response_schema",
    },
    {
      id: "occurrence_count_importance",
      observed: hasText(description, /importance.*出現回数/u),
      evidence_location: "OtherKeywordsController_search.description",
      evidence: "importanceは再帰取得中の出現回数で決まると記載する",
      strength: "explicit_contract_text",
    },
    {
      id: "stable_type_partition",
      observed: hasText(
        responseSchema.properties?.data?.properties?.items?.description,
        /LSI.*先.*PAA.*後/u,
      ),
      evidence_location: "OtherKeywordsResponseDto.data.items",
      evidence: "itemsはLSIを先、PAAを後に並べると記載する",
      strength: "explicit_response_schema",
    },
    {
      id: "metric_and_first_seen_projection",
      observed:
        schemaHasProperty(itemSchema, "metrics") &&
        schemaHasProperty(metricsSchema, "firstSeenRange"),
      evidence_location: "OtherKeywordsResponseDto.data.items[].metrics",
      evidence: "LSI側へ検索量等の指標とfirstSeenRangeを投影するschemaがある",
      strength: "explicit_response_schema",
    },
    {
      id: "stack_or_queue_order",
      observed: false,
      evidence_location: "public_contract_not_exposed",
      evidence: "stack/queue、訪問順、同順位tie-break、途中停止条件は公開されていない",
      strength: "negative_observation_not_proof",
    },
  ];
  const algorithmHypotheses = [
    {
      id: "depth_first",
      label: "DFS / depth-first traversal",
      compatibility: "compatible",
      confidence: "possible_not_proven",
      evidence_ids: ["bounded_recursive_expansion", "parent_source_field"],
      disambiguating_observation_required:
        "同一seedで深さ2の訪問順または途中停止時のprefixを観測できるtrace",
    },
    {
      id: "breadth_first",
      label: "BFS / breadth-first traversal",
      compatibility: "compatible",
      confidence: "possible_not_proven",
      evidence_ids: ["bounded_recursive_expansion", "parent_source_field"],
      disambiguating_observation_required:
        "同一seedで深さ1を全列挙してから深さ2へ進むことを示すtrace",
    },
    {
      id: "bounded_occurrence_aggregation",
      label: "bounded recursive expansion + occurrence aggregation",
      compatibility: "best_fit_contract_behavior",
      confidence: "contract_level_only",
      evidence_ids: [
        "bounded_recursive_expansion",
        "occurrence_count_importance",
        "stable_type_partition",
      ],
      disambiguating_observation_required:
        "sourceKeywordごとの深さ付きraw応答、重複除去規則、importance計算の実測",
    },
  ];
  const downstreamMappings = [
    {
      surface: "keyword_database",
      retained_targets: [
        "raw_snapshot_demand_observations",
        "serp_demand_occurrences",
      ],
      required_fields: [
        "type",
        "sourceKeyword",
        "importance",
        "metrics",
        "snapshot_digest",
      ],
      state: "retained_partial_reproduction",
      automatic_mutation: false,
    },
    {
      surface: "keyword_grouping",
      retained_targets: [
        "keyword_hierarchy",
        "related_keyword_boundary_reviews",
      ],
      required_fields: ["sourceKeyword", "path", "group_boundary", "review_state"],
      state: "review_only_candidate_mapping",
      automatic_mutation: false,
    },
    {
      surface: "title_heading_generation",
      retained_targets: [
        "content_structure_candidates",
        "content_generation_candidates",
      ],
      required_fields: ["demand_type", "importance", "source_lineage", "review_state"],
      state: "evidence_bound_candidates",
      automatic_mutation: false,
    },
  ];
  const identifiabilityProof = buildTraversalIdentifiabilityProof({ checkedAt });
  const base = {
    schema_version: "seo-tool-a-traversal-hypothesis.v1",
    checked_at: checkedAt,
    source: {
      operation_id: operation.operationId,
      operation: "POST /v1/other-keywords",
      document_version: spec.info?.version ?? null,
      openapi_version: spec.openapi ?? null,
      source_sha256: digest(spec),
    },
    contract_signals: signals,
    algorithm_hypotheses: algorithmHypotheses,
    identifiability_proof: identifiabilityProof,
    downstream_mappings: downstreamMappings,
    conclusion:
      "公開契約からはbounded recursive graph behaviorとoccurrence aggregationまでは支持できるが、DFSかBFSか、内部queue/stack、provider実装は識別できない。両戦略をローカル証拠グラフで比較し、未観測の内部処理を断定しない。",
    evidence_boundary: {
      internal_algorithm_proven: false,
      vendor_confirmation_observed: false,
      external_request_executed: false,
      paid_request_executed: false,
      credentials_used: false,
      private_endpoint_used: false,
      automatic_group_assignment: false,
      automatic_content_mutation: false,
    },
  };
  return { ...base, audit_digest: digest(base) };
}
