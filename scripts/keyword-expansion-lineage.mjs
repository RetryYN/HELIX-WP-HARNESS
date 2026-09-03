import { createHash } from "node:crypto";

const sha = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const norm = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ja-JP");
const list = (value) => (Array.isArray(value) ? value : []);
const STATES = ["retained", "not_acquired", "zero", "not_applicable", "failed"];
const EDGE_TYPES = [
  "normalization",
  "hierarchy_parent",
  "group_membership",
  "related_group_candidate",
  "observed_demand",
  "group_demand",
  "topic_evidence",
  "group_topic",
  "topic_question",
  "group_question",
  "group_content_candidate",
  "keyword_term",
  "reviewed_synonym",
  "surface_state",
];

const stateForKeyword = (row) =>
  row?.processing_state === "SERP未取得" ? "not_acquired" : "retained";
const mergeState = (left, right) => {
  const rank = new Map([
    ["failed", 5],
    ["retained", 4],
    ["not_acquired", 3],
    ["zero", 2],
    ["not_applicable", 1],
  ]);
  return (rank.get(right) ?? 0) > (rank.get(left) ?? 0) ? right : left;
};

const nodeId = (siteId, type, key) =>
  `${type}:${sha(`${siteId}\0${type}\0${key}`).slice(0, 24)}`;
const edgeId = (base) => `edge:${sha(base)}`;

const groupKeywords = (group) =>
  [
    ["main", group.main_keyword],
    ["display", group.display_keyword],
    ...list(group.intent_keywords).map((value) => ["intent", value]),
    ...list(group.sibling_keywords).map((value) => ["sibling", value]),
    ...list(group.comparison_keywords).map((value) => ["comparison", value]),
  ].filter(([, value]) => value);

const edgeText = (edge) =>
  norm(
    [
      edge.edge_type,
      edge.from_label,
      edge.to_label,
      edge.source_keyword_id,
      edge.group_id,
      edge.task_id,
      edge.occurrence_id,
      edge.review_state,
    ].join(" "),
  );

/**
 * Build a lossless, read-only expansion projection over retained keyword and
 * editorial evidence. This is not an autocomplete implementation: every
 * edge retains the source identity/digest that caused it, while absence is
 * represented in a separate coverage ledger.
 */
export function buildKeywordExpansionLineage({
  siteId,
  keywordInventory = [],
  keywordHierarchy = [],
  groups = [],
  relatedBoundaries = [],
  demandOccurrences = [],
  demands = [],
  topics = [],
  questions = [],
  candidates = [],
  lexicalIndex = {},
  synonymRows = [],
  taskMetadata = [],
  query = "",
} = {}) {
  if (!siteId) throw new TypeError("siteId is required");
  const inventory = keywordInventory.filter((row) => row.site_id === siteId);
  const siteGroups = groups.filter((row) => row.site_id === siteId);
  const hierarchy = keywordHierarchy.filter((row) => row.site_id === siteId);
  const groupIds = new Set(siteGroups.map((row) => row.id));
  const sourceById = new Map(inventory.map((row) => [row.source_keyword_id, row]));
  const sourceIdsByKeyword = new Map();
  const hierarchyById = new Map(hierarchy.map((row) => [row.source_keyword_id, row]));
  const nodesById = new Map();
  const edgesById = new Map();
  const observedExpansionBySource = new Map();
  const taskFailuresByKeyword = new Map();

  for (const task of taskMetadata) {
    if (Number(task.status_code) === 20000) continue;
    const key = norm(task.result_keyword ?? task.keyword);
    if (!key) continue;
    const failures = taskFailuresByKeyword.get(key) ?? [];
    failures.push({
      task_id: task.task_id ?? null,
      status_code: task.status_code ?? null,
      status_message: task.status_message ?? null,
    });
    taskFailuresByKeyword.set(key, failures);
  }

  const ensureNode = (type, key, label, state = "retained", extra = {}) => {
    const id = nodeId(siteId, type, key);
    const current = nodesById.get(id);
    if (current) {
      current.source_state = mergeState(current.source_state, state);
      current.source_ids = [
        ...new Set([...list(current.source_ids), ...list(extra.source_ids)]),
      ].sort();
      current.group_ids = [
        ...new Set([...list(current.group_ids), ...list(extra.group_ids)]),
      ].sort();
      return current;
    }
    const node = {
      node_id: id,
      node_type: type,
      label: label ?? key,
      normalized_label: norm(label ?? key),
      site_id: siteId,
      source_state: state,
      source_ids: [...new Set(list(extra.source_ids))].sort(),
      group_ids: [...new Set(list(extra.group_ids))].sort(),
      ...extra,
    };
    delete node.source_state_override;
    nodesById.set(id, node);
    return node;
  };

  const addEdge = (type, from, to, state, extra = {}) => {
    const base = {
      edge_type: type,
      from_node_id: from.node_id,
      to_node_id: to.node_id,
      from_label: from.label,
      to_label: to.label,
      retention_state: state,
      ...extra,
    };
    const id = edgeId(base);
    if (edgesById.has(id)) return edgesById.get(id);
    const edge = { edge_id: id, ...base };
    edge.evidence_digest = sha(edge);
    edgesById.set(id, edge);
    if (extra.source_keyword_id) {
      const count = observedExpansionBySource.get(extra.source_keyword_id) ?? 0;
      if (!["normalization", "hierarchy_parent"].includes(type))
        observedExpansionBySource.set(extra.source_keyword_id, count + 1);
    }
    return edge;
  };

  for (const source of inventory) {
    const key = norm(source.raw_keyword);
    const state = stateForKeyword(source);
    const sourceNode = ensureNode(
      "source_keyword",
      source.source_keyword_id,
      source.raw_keyword,
      state,
      {
        source_ids: [source.source_keyword_id],
        metadata: {
          source_sheet: source.source_sheet,
          source_row: source.source_row,
          source_location: source.source_location ?? null,
          search_volume: source.search_volume ?? null,
          processing_state: source.processing_state ?? null,
        },
      },
    );
    const normalizedNode = ensureNode("normalized_keyword", key, source.raw_keyword, state, {
      source_ids: [source.source_keyword_id],
    });
    const ids = sourceIdsByKeyword.get(key) ?? [];
    ids.push(source.source_keyword_id);
    sourceIdsByKeyword.set(key, ids);
    addEdge("normalization", sourceNode, normalizedNode, state, {
      source_keyword_id: source.source_keyword_id,
      source_sheet: source.source_sheet,
      source_row: source.source_row,
      source_row_preserved: true,
      source_digest: source.evidence_digest ?? null,
    });
    const hierarchyRow = hierarchyById.get(source.source_keyword_id);
    const parent = hierarchyRow?.parent_source_keyword_id
      ? sourceById.get(hierarchyRow.parent_source_keyword_id)
      : null;
    if (parent) {
      const parentNode = ensureNode(
        "source_keyword",
        parent.source_keyword_id,
        parent.raw_keyword,
        stateForKeyword(parent),
        { source_ids: [parent.source_keyword_id] },
      );
      addEdge("hierarchy_parent", sourceNode, parentNode, state, {
        source_keyword_id: source.source_keyword_id,
        parent_source_keyword_id: parent.source_keyword_id,
        hierarchy_depth: hierarchyRow.depth ?? null,
        hierarchy_relation: hierarchyRow.relation ?? null,
        source_digest: hierarchyRow.evidence_digest ?? null,
      });
    }
  }

  const groupNodes = new Map();
  const groupByKeyword = new Map();
  for (const group of siteGroups) {
    const groupNode = ensureNode("keyword_group", group.id, group.main_keyword ?? group.display_keyword ?? group.id, "retained", {
      group_ids: [group.id],
      metadata: {
        resolution_state: group.resolution_state ?? null,
        main_keyword: group.main_keyword ?? null,
        state: group.state ?? null,
      },
    });
    groupNodes.set(group.id, groupNode);
    for (const [role, value] of groupKeywords(group)) {
      const key = norm(value);
      const ids = groupByKeyword.get(key) ?? [];
      ids.push({ group, role });
      groupByKeyword.set(key, ids);
      for (const sourceId of sourceIdsByKeyword.get(key) ?? []) {
        const sourceNode = nodesById.get(nodeId(siteId, "source_keyword", sourceId));
        if (sourceNode)
          addEdge("group_membership", sourceNode, groupNode, "retained", {
            source_keyword_id: sourceId,
            group_id: group.id,
            group_role: role,
            source_digest: sourceById.get(sourceId)?.evidence_digest ?? null,
          });
      }
    }
  }

  for (const boundary of relatedBoundaries) {
    const sourceNode = nodesById.get(
      nodeId(siteId, "source_keyword", boundary.source_keyword_id),
    );
    if (!sourceNode) continue;
    for (const candidate of list(boundary.candidates)) {
      const groupNode = groupNodes.get(candidate.group_id);
      if (!groupNode) continue;
      addEdge("related_group_candidate", sourceNode, groupNode, "retained", {
        source_keyword_id: boundary.source_keyword_id,
        group_id: candidate.group_id,
        proposal_rank: candidate.rank ?? null,
        proposal_score: candidate.proposal_score ?? null,
        boundary_state: boundary.boundary_state ?? null,
        review_required: Boolean(boundary.review_required),
        assignment_state: boundary.assignment_state ?? "proposal_only_not_applied",
        auto_assignment: false,
        source_digest: candidate.evidence_digest ?? boundary.evidence_digest ?? null,
      });
    }
  }

  const demandNodes = new Map();
  const demandByKey = new Map(
    demands.map((row) => [`${row.demand_type}\0${row.normalized_value}`, row]),
  );
  for (const occurrence of demandOccurrences) {
    const demandKey = `${occurrence.demand_type}\0${occurrence.normalized_value}`;
    const aggregate = demandByKey.get(demandKey);
    const demandNode =
      demandNodes.get(demandKey) ??
      ensureNode(
        "demand",
        demandKey,
        occurrence.value ?? occurrence.normalized_value,
        "retained",
        {
          group_ids: occurrence.group_id ? [occurrence.group_id] : [],
          metadata: {
            demand_type: occurrence.demand_type,
            occurrence_count: aggregate?.occurrence_count ?? null,
            importance_score: aggregate?.importance_score ?? null,
            max_recursion_depth:
              aggregate?.max_recursion_depth ?? occurrence.recursion_depth ?? null,
          },
        },
      );
    demandNodes.set(demandKey, demandNode);
    const sourceKeywordKey = norm(occurrence.source_keyword);
    const normalizedNode = ensureNode(
      "normalized_keyword",
      sourceKeywordKey,
      occurrence.source_keyword,
      "retained",
      { source_ids: sourceIdsByKeyword.get(sourceKeywordKey) ?? [] },
    );
    const sourceIds = sourceIdsByKeyword.get(sourceKeywordKey) ?? [];
    const sourceKeywordIds = sourceIds.length ? sourceIds : [null];
    for (const sourceId of sourceKeywordIds) {
      const sourceNode = sourceId
        ? nodesById.get(nodeId(siteId, "source_keyword", sourceId))
        : normalizedNode;
      if (!sourceNode) continue;
      addEdge("observed_demand", sourceNode, demandNode, "retained", {
        source_keyword_id: sourceId,
        occurrence_id: occurrence.occurrence_id,
        task_id: occurrence.task_id,
        group_id: occurrence.group_id,
        demand_type: occurrence.demand_type,
        occurrence_order: occurrence.occurrence_order ?? null,
        serp_item_rank: occurrence.serp_item_rank ?? null,
        recursion_depth: occurrence.recursion_depth ?? null,
        snapshot_digest: occurrence.snapshot_digest ?? null,
        observed_at: occurrence.observed_at ?? null,
        source_digest: occurrence.snapshot_digest ?? null,
      });
    }
    if (occurrence.group_id && groupNodes.has(occurrence.group_id))
      addEdge("group_demand", groupNodes.get(occurrence.group_id), demandNode, "retained", {
        group_id: occurrence.group_id,
        occurrence_id: occurrence.occurrence_id,
        task_id: occurrence.task_id,
        source_keyword_id: sourceIds[0] ?? null,
        source_digest: occurrence.snapshot_digest ?? null,
      });
  }

  const topicNodes = new Map();
  for (const topic of topics.filter((row) => groupIds.has(row.group_id))) {
    const topicNode = ensureNode(
      "topic",
      topic.proposal_id,
      topic.display_topic ?? topic.normalized_topic,
      "retained",
      {
        group_ids: [topic.group_id],
        metadata: {
          topic_kind: topic.topic_kind ?? null,
          relation: topic.relation ?? null,
          occurrence_count: topic.occurrence_count ?? null,
          priority_score: topic.priority_score ?? null,
          status: topic.status ?? null,
        },
      },
    );
    topicNodes.set(topic.proposal_id, topicNode);
    const groupNode = groupNodes.get(topic.group_id);
    if (groupNode)
      addEdge("group_topic", groupNode, topicNode, "retained", {
        group_id: topic.group_id,
        topic_id: topic.proposal_id,
        source_digest: topic.evidence_digest ?? null,
      });
    for (const occurrenceId of list(topic.evidence_occurrence_ids)) {
      const occurrence = demandOccurrences.find((row) => row.occurrence_id === occurrenceId);
      if (!occurrence) continue;
      const demandNode = demandNodes.get(
        `${occurrence.demand_type}\0${occurrence.normalized_value}`,
      );
      if (demandNode)
        addEdge("topic_evidence", demandNode, topicNode, "retained", {
          group_id: topic.group_id,
          topic_id: topic.proposal_id,
          occurrence_id: occurrenceId,
          task_id: occurrence.task_id,
          source_digest: occurrence.snapshot_digest ?? topic.evidence_digest ?? null,
        });
    }
  }

  for (const question of questions.filter((row) => groupIds.has(row.group_id))) {
    const questionNode = ensureNode(
      "question",
      question.question_id,
      question.question_text,
      "retained",
      {
        group_ids: [question.group_id],
        metadata: {
          candidate_kind: question.candidate_kind ?? null,
          source_kind: question.source_kind ?? null,
          review_state: question.review_state ?? null,
        },
      },
    );
    const groupNode = groupNodes.get(question.group_id);
    if (groupNode)
      addEdge("group_question", groupNode, questionNode, "retained", {
        group_id: question.group_id,
        question_id: question.question_id,
        source_digest: question.evidence_digest ?? null,
      });
    const topicNode = question.source_topic_id
      ? topicNodes.get(question.source_topic_id)
      : null;
    if (topicNode)
      addEdge("topic_question", topicNode, questionNode, "retained", {
        group_id: question.group_id,
        topic_id: question.source_topic_id,
        question_id: question.question_id,
        source_digest: question.evidence_digest ?? null,
      });
  }

  for (const candidate of candidates.filter((row) => groupIds.has(row.group_id))) {
    const candidateNode = ensureNode(
      "content_candidate",
      candidate.candidate_id,
      candidate.text,
      "retained",
      {
        group_ids: [candidate.group_id],
        metadata: {
          content_type: candidate.content_type ?? null,
          heading_level: candidate.heading_level ?? null,
          evidence_type: candidate.evidence_type ?? null,
          review_state: candidate.review?.review_state ?? null,
          status: candidate.status ?? null,
        },
      },
    );
    const groupNode = groupNodes.get(candidate.group_id);
    if (groupNode)
      addEdge("group_content_candidate", groupNode, candidateNode, "retained", {
        group_id: candidate.group_id,
        candidate_id: candidate.candidate_id,
        evidence_ids: list(candidate.evidence_ids),
        source_digest: candidate.candidate_digest ?? null,
        review_state: candidate.review?.review_state ?? null,
        auto_approval: false,
      });
  }

  const associationRows = list(lexicalIndex.associations);
  const hierarchyTermsByKeyword = new Map(
    hierarchy.map((row) => [
      norm(row.raw_keyword),
      new Set(list(row.normalized_terms).map(norm).filter(Boolean)),
    ]),
  );
  const lexicalTerms = new Set(
    associationRows.flatMap((row) => [row.term, row.associated_term]).map(norm),
  );
  for (const [keyword, terms] of hierarchyTermsByKeyword) {
    const normalizedNode = ensureNode("normalized_keyword", keyword, keyword, "retained", {
      source_ids: sourceIdsByKeyword.get(keyword) ?? [],
    });
    for (const term of terms) {
      if (!lexicalTerms.has(term)) continue;
      const termNode = ensureNode("lexical_term", term, term, "retained");
      addEdge("keyword_term", normalizedNode, termNode, "retained", {
        source_keyword_id: sourceIdsByKeyword.get(keyword)?.[0] ?? null,
        lexical_relation: "token_observed",
      });
    }
  }
  for (const association of associationRows) {
    const left = ensureNode("lexical_term", norm(association.term), association.term, "retained");
    const right = ensureNode(
      "lexical_term",
      norm(association.associated_term),
      association.associated_term,
      "retained",
    );
    addEdge("keyword_term", left, right, "retained", {
      lexical_relation: "row_cooccurrence",
      pair_support: association.pair_support ?? null,
      cosine_score: association.cosine_score ?? null,
      rank: association.rank ?? null,
      evidence_source_keyword_ids: list(association.evidence_source_keyword_ids),
      source_digest: association.evidence_digest ?? null,
      semantic_equivalence_inferred: false,
    });
  }
  const synonymTermSet = new Set([
    ...lexicalTerms,
    ...hierarchyTermsByKeyword.values().flatMap((terms) => [...terms]),
  ]);
  for (const synonym of synonymRows) {
    const leftKey = norm(synonym.left_normalized ?? synonym.left_term);
    const rightKey = norm(synonym.right_normalized ?? synonym.right_term);
    if (!synonymTermSet.has(leftKey) && !synonymTermSet.has(rightKey)) continue;
    const left = ensureNode("lexical_term", leftKey, synonym.left_term ?? leftKey, "retained");
    const right = ensureNode("lexical_term", rightKey, synonym.right_term ?? rightKey, "retained");
    addEdge("reviewed_synonym", left, right, "retained", {
      relation_state: synonym.relation_state ?? null,
      context_review_required: synonym.context_review_required !== false,
      semantic_synonymy_inferred: false,
      auto_replacement: false,
      source_id: synonym.source_id ?? null,
      source_row: synonym.source_row ?? null,
      source_digest: synonym.evidence_digest ?? null,
    });
  }

  const outgoingBySource = new Map();
  for (const edge of edgesById.values()) {
    const sourceId = edge.source_keyword_id;
    if (!sourceId) continue;
    const count = outgoingBySource.get(sourceId) ?? 0;
    outgoingBySource.set(sourceId, count + 1);
  }
  const coverage = inventory.map((source) => {
    const key = norm(source.raw_keyword);
    const failures = taskFailuresByKeyword.get(key) ?? [];
    const expansionCount = observedExpansionBySource.get(source.source_keyword_id) ?? 0;
    let state = stateForKeyword(source);
    let reason = state === "not_acquired" ? "processing_state_unacquired" : "observed_source_row";
    if (failures.length) {
      state = "failed";
      reason = "task_status_non_success";
    } else if (state === "retained" && expansionCount === 0) {
      state = "zero";
      reason = "acquired_without_expansion_evidence";
    } else if (state === "retained") {
      reason = "observed_expansion_evidence";
    }
    const row = {
      source_keyword_id: source.source_keyword_id,
      source_sheet: source.source_sheet,
      source_row: source.source_row,
      raw_keyword: source.raw_keyword,
      normalized_keyword: key,
      processing_state: source.processing_state ?? null,
      disposition_state: state,
      disposition_reason: reason,
      expansion_edge_count: expansionCount,
      task_failure_count: failures.length,
      task_failures: failures,
      source_row_preserved: true,
      external_acquisition_triggered: false,
      evidence_digest: source.evidence_digest ?? null,
    };
    return { ...row, coverage_digest: sha(row) };
  });

  const surfaceCoverage = [
    ["retained_workbook", "retained", "source workbook rows are present"],
    [
      "serp_demand_features",
      demandOccurrences.length ? "retained" : "zero",
      demandOccurrences.length ? "PAA/related occurrences are retained" : "no occurrence rows retained",
    ],
    [
      "external_autocomplete",
      "not_acquired",
      "external autocomplete payload is not connected or retained",
    ],
    [
      "provider_question_database",
      "not_acquired",
      "provider-wide question index is not connected or retained",
    ],
    [
      "provider_rank_database",
      "not_acquired",
      "provider-wide rank keyword index is not connected or retained",
    ],
    [
      "contextual_semantic_dictionary",
      lexicalTerms.size ? "retained" : "not_applicable",
      lexicalTerms.size ? "local typed lexical evidence is retained" : "no matching lexical terms",
    ],
  ].map(([surface, state, reason]) => ({
    surface,
    disposition_state: state,
    disposition_reason: reason,
    external_acquisition_triggered: false,
    auto_content_use: false,
    coverage_digest: sha({ siteId, surface, state, reason }),
  }));
  for (const row of surfaceCoverage) {
    const surfaceNode = ensureNode("evidence_surface", row.surface, row.surface, row.disposition_state, {
      metadata: { disposition_reason: row.disposition_reason },
    });
    const stateNode = ensureNode(
      "disposition_state",
      row.disposition_state,
      row.disposition_state,
      row.disposition_state,
    );
    addEdge("surface_state", surfaceNode, stateNode, row.disposition_state, {
      surface: row.surface,
      disposition_reason: row.disposition_reason,
      source_digest: row.coverage_digest,
    });
  }

  const allNodes = [...nodesById.values()]
    .map((node) => ({ ...node, node_digest: sha(node) }))
    .sort((a, b) =>
      a.node_type.localeCompare(b.node_type) ||
      a.normalized_label.localeCompare(b.normalized_label, "ja") ||
      a.node_id.localeCompare(b.node_id),
    );
  const allEdges = [...edgesById.values()].sort(
    (a, b) =>
      a.edge_type.localeCompare(b.edge_type) ||
      a.from_node_id.localeCompare(b.from_node_id) ||
      a.to_node_id.localeCompare(b.to_node_id) ||
      a.edge_id.localeCompare(b.edge_id),
  );
  const normalizedQuery = norm(query);
  const nodeMatches = (node) =>
    !normalizedQuery ||
    norm(
      [node.node_type, node.label, node.normalized_label, ...list(node.source_ids), ...list(node.group_ids)].join(" "),
    ).includes(normalizedQuery);
  const matchingIds = new Set(allNodes.filter(nodeMatches).map((node) => node.node_id));
  const nodes = normalizedQuery ? allNodes.filter((node) => matchingIds.has(node.node_id)) : allNodes;
  const edges = normalizedQuery
    ? allEdges.filter(
        (edge) =>
          matchingIds.has(edge.from_node_id) ||
          matchingIds.has(edge.to_node_id) ||
          edgeText(edge).includes(normalizedQuery),
      )
    : allEdges;
  const filteredCoverage = normalizedQuery
    ? coverage.filter((row) => norm(JSON.stringify(row)).includes(normalizedQuery))
    : coverage;
  const edgeTypeCounts = Object.fromEntries(
    EDGE_TYPES.map((type) => [type, allEdges.filter((edge) => edge.edge_type === type).length]),
  );
  const dispositionCounts = Object.fromEntries(
    STATES.map((state) => [
      state,
      coverage.filter((row) => row.disposition_state === state).length +
        surfaceCoverage.filter((row) => row.disposition_state === state).length,
    ]),
  );
  const summary = {
    site_id: siteId,
    source_keyword_count: inventory.length,
    normalized_keyword_count: new Set(inventory.map((row) => norm(row.raw_keyword))).size,
    group_count: siteGroups.length,
    node_count: allNodes.length,
    edge_count: allEdges.length,
    coverage_row_count: coverage.length,
    surface_count: surfaceCoverage.length,
    review_required_edge_count: allEdges.filter((edge) => edge.review_required || edge.context_review_required).length,
    edge_type_counts: edgeTypeCounts,
    disposition_counts: dispositionCounts,
    source_disposition_counts: Object.fromEntries(
      STATES.map((state) => [state, coverage.filter((row) => row.disposition_state === state).length]),
    ),
    linked_source_keyword_count: coverage.filter((row) => row.expansion_edge_count > 0).length,
    zero_expansion_source_keyword_count: coverage.filter((row) => row.disposition_state === "zero").length,
    failed_source_keyword_count: coverage.filter((row) => row.disposition_state === "failed").length,
    external_surface_not_acquired_count: surfaceCoverage.filter((row) => row.disposition_state === "not_acquired").length,
    automatic_group_assignment: false,
    automatic_generation: false,
    automatic_content_mutation: false,
    automatic_publication: false,
    external_acquisition_triggered: false,
  };
  const base = {
    policy: "keyword-expansion-lineage.v1",
    source_policy: "retained_evidence_typed_edges_and_explicit_disposition_ledger",
    interpretation_policy:
      "expansion_edges_are_provenance_links_not_synonymy_demand_or_ranking_causality",
    source_rows_losslessly_retained: true,
    raw_external_payload_synthesized: false,
    summary,
    nodes,
    edges,
    coverage: filteredCoverage,
    surface_coverage: surfaceCoverage,
    filters: { site_id: siteId, q: query },
  };
  return {
    ...base,
    all_nodes: allNodes,
    all_edges: allEdges,
    lineage_digest: sha({
      ...summary,
      nodes: allNodes.map((node) => node.node_digest),
      edges: allEdges.map((edge) => edge.evidence_digest),
      coverage: coverage.map((row) => row.coverage_digest),
      surfaces: surfaceCoverage.map((row) => row.coverage_digest),
    }),
  };
}

export { STATES as expansionDispositionStates };
