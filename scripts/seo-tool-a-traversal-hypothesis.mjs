import { createHash } from "node:crypto";

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const hasText = (text, pattern) => pattern.test(String(text ?? ""));

const schemaHasProperty = (schema, property) =>
  Boolean(schema?.properties?.[property]);

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
