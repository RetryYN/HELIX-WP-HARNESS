import { createHash } from "node:crypto";

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("ja-JP");

const asArray = (value) => (Array.isArray(value) ? value : []);
const asDepth = (value) => {
  const depth = Number(value);
  return Number.isInteger(depth) && depth >= 1 ? depth : 1;
};
const strategyOf = (value) =>
  value === "depth_first" ? "depth_first" : "breadth_first";
const compare = (left, right) =>
  (left.first_order ?? Number.MAX_SAFE_INTEGER) -
    (right.first_order ?? Number.MAX_SAFE_INTEGER) ||
  String(left.normalized_value ?? "").localeCompare(
    String(right.normalized_value ?? ""),
    "ja",
  ) ||
    String(left.node_key).localeCompare(String(right.node_key));
const sortedUnique = (values) => [...new Set(values.filter(Boolean))].sort();
const stableOccurrenceCompare = (left, right) =>
  String(left.group_id ?? "").localeCompare(String(right.group_id ?? ""), "ja") ||
  String(left.task_id ?? "").localeCompare(String(right.task_id ?? ""), "ja") ||
  String(left.source_keyword ?? "").localeCompare(
    String(right.source_keyword ?? ""),
    "ja",
  ) ||
  String(left.demand_type ?? "").localeCompare(
    String(right.demand_type ?? ""),
    "ja",
  ) ||
  (Number(left.occurrence_order ?? Number.MAX_SAFE_INTEGER) -
    Number(right.occurrence_order ?? Number.MAX_SAFE_INTEGER)) ||
  String(left.occurrence_id ?? "").localeCompare(
    String(right.occurrence_id ?? ""),
    "ja",
  ) ||
  String(left.snapshot_digest ?? "").localeCompare(
    String(right.snapshot_digest ?? ""),
    "ja",
  );

const nodeKeyOf = (groupId, kind, demandType, value) =>
  [groupId, kind, kind === "seed" ? "" : normalize(value)].join("\0");
const nodeIdOf = (nodeKey) => digest({ type: "latent-demand-node", key: nodeKey });
const edgeIdOf = (edgeKey) => digest({ type: "latent-demand-edge", key: edgeKey });

const evidenceRef = (row) => ({
  occurrence_id: row.occurrence_id ?? null,
  task_id: row.task_id ?? null,
  source_keyword: row.source_keyword ?? null,
  value: row.value ?? null,
  normalized_value: row.normalized_value ?? normalize(row.value),
  demand_type: row.demand_type ?? null,
  occurrence_order: row.occurrence_order ?? null,
  serp_item_rank: row.serp_item_rank ?? null,
  recursion_depth: asDepth(row.recursion_depth),
  seed_value: row.seed_value ?? null,
  snapshot_digest: row.snapshot_digest ?? null,
  observed_at: row.observed_at ?? null,
});

const importanceObservation = (occurrenceCount) => ({
  occurrence_count: occurrenceCount,
  band: null,
  threshold_known: false,
  policy: "occurrence_count_exposed_without_provider_threshold",
});

const traceGraph = (nodeByKey, edgeByKey, roots, strategy, maxDepth) => {
  const adjacency = new Map();
  for (const nodeKey of nodeByKey.keys()) adjacency.set(nodeKey, []);
  for (const edge of edgeByKey.values()) {
    adjacency.get(edge.parent_key)?.push(edge);
  }
  for (const edges of adjacency.values())
    edges.sort((left, right) =>
      compare(
        {
          ...left,
          normalized_value: nodeByKey.get(left.child_key)?.normalized_value,
          node_key: left.edge_key,
        },
        {
          ...right,
          normalized_value: nodeByKey.get(right.child_key)?.normalized_value,
          node_key: right.edge_key,
        },
      ),
    );

  const orderedRoots = [...roots].sort((left, right) =>
    compare(nodeByKey.get(left), nodeByKey.get(right)),
  );
  const pending = orderedRoots.map((nodeKey) => ({
    node_key: nodeKey,
    depth: nodeByKey.get(nodeKey)?.depth ?? 0,
    path: [nodeKey],
    parent_edge_key: null,
  }));
  const scheduled = new Set(pending.map((item) => item.node_key));
  const visited = new Set();
  const trace = [];
  const addComponent = (nodeKey) => {
    if (scheduled.has(nodeKey) || visited.has(nodeKey)) return;
    scheduled.add(nodeKey);
    pending.push({
      node_key: nodeKey,
      depth: nodeByKey.get(nodeKey)?.depth ?? 0,
      path: [nodeKey],
      parent_edge_key: null,
    });
  };

  while (pending.length || visited.size < nodeByKey.size) {
    if (!pending.length) {
      const next = [...nodeByKey.keys()].find((nodeKey) => !visited.has(nodeKey));
      if (next == null) break;
      addComponent(next);
    }
    const item =
      strategy === "depth_first" ? pending.pop() : pending.shift();
    if (!item || visited.has(item.node_key)) continue;
    visited.add(item.node_key);
    const node = nodeByKey.get(item.node_key);
    if (!node || item.depth > maxDepth) continue;
    trace.push({
      node_key: item.node_key,
      depth: item.depth,
      path: item.path,
      parent_edge_key: item.parent_edge_key,
    });
    const children = adjacency.get(item.node_key) ?? [];
    const nextItems = children
      .filter((edge) => !visited.has(edge.child_key) && item.depth < maxDepth)
      .map((edge) => ({
        node_key: edge.child_key,
        depth: item.depth + 1,
        path: [...item.path, edge.child_key],
        parent_edge_key: edge.edge_key,
      }));
    const pushItems =
      strategy === "depth_first" ? [...nextItems].reverse() : nextItems;
    for (const next of pushItems) {
      if (scheduled.has(next.node_key)) continue;
      scheduled.add(next.node_key);
      pending.push(next);
    }
  }
  return trace;
};

const cycleNodes = (nodeByKey, edgeByKey) => {
  const adjacency = new Map();
  for (const nodeKey of nodeByKey.keys()) adjacency.set(nodeKey, []);
  for (const edge of edgeByKey.values()) adjacency.get(edge.parent_key)?.push(edge.child_key);
  const activeIndex = new Map();
  const path = [];
  const visited = new Set();
  const cycles = new Set();
  const visit = (nodeKey) => {
    if (visited.has(nodeKey)) return;
    activeIndex.set(nodeKey, path.length);
    path.push(nodeKey);
    for (const childKey of adjacency.get(nodeKey) ?? []) {
      const cycleStart = activeIndex.get(childKey);
      if (cycleStart != null)
        for (const cycleNode of path.slice(cycleStart)) cycles.add(cycleNode);
      else if (!visited.has(childKey)) visit(childKey);
    }
    path.pop();
    activeIndex.delete(nodeKey);
    visited.add(nodeKey);
  };
  for (const nodeKey of nodeByKey.keys()) visit(nodeKey);
  return cycles;
};

/**
 * Reconstruct a bounded latent-demand graph from retained occurrence rows.
 * This is a review projection: it preserves source/task/snapshot references,
 * compares local BFS/DFS order, and never claims the upstream provider's
 * internal queue/stack or triggers acquisition.
 */
export function buildLatentDemandTraversal({
  siteId,
  groups = [],
  occurrences = [],
  query = "",
  groupId = "",
  strategy = "breadth_first",
  maxDepth = 2,
} = {}) {
  if (!siteId) throw new TypeError("siteId is required");
  const selectedStrategy = strategyOf(strategy);
  const requestedDepth = Number(maxDepth);
  if (!Number.isInteger(requestedDepth) || requestedDepth < 1 || requestedDepth > 2)
    throw new RangeError("maxDepth must be an integer from 1 to 2");
  const siteGroups = groups.filter(
    (group) => group.site_id === siteId && (!groupId || group.id === groupId),
  );
  const siteGroupIds = new Set(siteGroups.map((group) => group.id));
  const normalizedQuery = normalize(query);
  const nodeByKey = new Map();
  const edgeByKey = new Map();
  let consideredOccurrenceCount = 0;
  let filteredOccurrenceCount = 0;
  let excludedDepthCount = 0;
  let missingParentCount = 0;
  let matchedOccurrenceCount = 0;
  const matchingRows = [];

  for (const [index, row] of occurrences.entries()) {
    if (!siteGroupIds.has(row.group_id)) continue;
    consideredOccurrenceCount++;
    const depth = asDepth(row.recursion_depth);
    if (depth > requestedDepth) {
      excludedDepthCount++;
      continue;
    }
    const childValue = row.value ?? row.normalized_value;
    const parentValue = row.seed_value || row.source_keyword;
    if (!childValue || !parentValue) {
      missingParentCount++;
      continue;
    }
    const searchable = normalize(
      [row.group_id, row.source_keyword, row.seed_value, row.value, row.normalized_value].join(" "),
    );
    if (normalizedQuery && !searchable.includes(normalizedQuery)) {
      filteredOccurrenceCount++;
      continue;
    }
    matchedOccurrenceCount++;
    matchingRows.push({
      row,
      index,
      depth,
      childValue: String(childValue),
      parentValue: String(parentValue),
      parentKind: depth > 1 && row.seed_value ? "demand" : "seed",
    });
  }

  matchingRows.sort(
    (left, right) =>
      stableOccurrenceCompare(left.row, right.row) || left.index - right.index,
  );

  const ensureNode = ({
    groupId: rowGroupId,
    kind,
    demandType,
    value,
    depth,
    order,
  }) => {
    const nodeKey = nodeKeyOf(rowGroupId, kind, demandType, value);
    if (!nodeByKey.has(nodeKey)) {
      nodeByKey.set(nodeKey, {
        node_key: nodeKey,
        group_id: rowGroupId,
        node_kind: kind,
        demand_types: new Set(demandType ? [demandType] : []),
        value: String(value),
        normalized_value: normalize(value),
        depth,
        first_order: order,
        occurrence_ids: new Set(),
        task_ids: new Set(),
        source_keywords: new Set(),
        snapshot_digests: new Set(),
        parent_keys: new Set(),
        child_keys: new Set(),
        evidence: [],
      });
    }
    const node = nodeByKey.get(nodeKey);
    if (demandType && kind !== "seed") node.demand_types.add(demandType);
    node.first_order = Math.min(node.first_order ?? order, order);
    node.depth = Math.min(node.depth ?? depth, depth);
    return node;
  };

  for (const [order, item] of matchingRows.entries()) {
    const { row, depth, childValue, parentValue, parentKind } = item;
    const parent = ensureNode({
      rowGroupId: row.group_id,
      kind: parentKind,
      demandType: parentKind === "demand" ? row.demand_type : null,
      value: parentValue,
      depth: parentKind === "seed" ? 0 : Math.max(0, depth - 1),
      order,
    });
    const child = ensureNode({
      rowGroupId: row.group_id,
      kind: "demand",
      demandType: row.demand_type,
      value: childValue,
      depth,
      order,
    });
    const edgeKey = [parent.node_key, child.node_key, row.demand_type ?? ""].join("\0");
    if (!edgeByKey.has(edgeKey)) {
      edgeByKey.set(edgeKey, {
        edge_key: edgeKey,
        parent_key: parent.node_key,
        child_key: child.node_key,
        group_id: row.group_id,
        demand_type: row.demand_type ?? null,
        depth,
        first_order: order,
        occurrence_ids: new Set(),
        task_ids: new Set(),
        source_keywords: new Set(),
        snapshot_digests: new Set(),
        evidence: [],
      });
    }
    const edge = edgeByKey.get(edgeKey);
    edge.first_order = Math.min(edge.first_order, order);
    edge.depth = Math.min(edge.depth, depth);
    const ref = evidenceRef(row);
    if (ref.occurrence_id) {
      edge.occurrence_ids.add(ref.occurrence_id);
      parent.occurrence_ids.add(ref.occurrence_id);
      child.occurrence_ids.add(ref.occurrence_id);
    }
    if (ref.task_id) {
      edge.task_ids.add(ref.task_id);
      parent.task_ids.add(ref.task_id);
      child.task_ids.add(ref.task_id);
    }
    if (ref.source_keyword) {
      edge.source_keywords.add(ref.source_keyword);
      parent.source_keywords.add(ref.source_keyword);
      child.source_keywords.add(ref.source_keyword);
    }
    if (ref.snapshot_digest) {
      edge.snapshot_digests.add(ref.snapshot_digest);
      parent.snapshot_digests.add(ref.snapshot_digest);
      child.snapshot_digests.add(ref.snapshot_digest);
    }
    edge.evidence.push(ref);
    parent.evidence.push(ref);
    child.evidence.push(ref);
    parent.child_keys.add(child.node_key);
    child.parent_keys.add(parent.node_key);
  }

  const cycles = cycleNodes(nodeByKey, edgeByKey);
  const roots = [...nodeByKey.values()]
    .filter((node) => node.parent_keys.size === 0)
    .map((node) => node.node_key)
    .sort((left, right) => compare(nodeByKey.get(left), nodeByKey.get(right)));
  const finalizeNode = (node) => {
    const occurrenceIds = sortedUnique([...node.occurrence_ids]);
    const parentIds = sortedUnique(
      [...node.parent_keys].map(nodeIdOf),
    );
    const childIds = sortedUnique(
      [...node.child_keys].map(nodeIdOf),
    );
    const base = {
      node_id: nodeIdOf(node.node_key),
      group_id: node.group_id,
      node_kind: node.node_kind,
      demand_type:
        node.demand_types.size === 1
          ? [...node.demand_types][0]
          : node.demand_types.size
            ? "mixed"
            : null,
      demand_types: sortedUnique([...node.demand_types]),
      value: node.value,
      normalized_value: node.normalized_value,
      depth: node.depth,
      occurrence_count: occurrenceIds.length,
      occurrence_ids: occurrenceIds,
      task_ids: sortedUnique([...node.task_ids]),
      source_keywords: sortedUnique([...node.source_keywords]),
      snapshot_digests: sortedUnique([...node.snapshot_digests]),
      parent_node_ids: parentIds,
      child_node_ids: childIds,
      multiple_parent: node.parent_keys.size > 1,
      cycle_detected: cycles.has(node.node_key),
      review_state:
        cycles.has(node.node_key) || node.parent_keys.size > 1
          ? "review_required"
          : "observed_path",
      importance: importanceObservation(occurrenceIds.length),
      evidence: node.evidence
        .sort((left, right) =>
          (left.occurrence_order ?? Number.MAX_SAFE_INTEGER) -
            (right.occurrence_order ?? Number.MAX_SAFE_INTEGER) ||
          String(left.occurrence_id).localeCompare(String(right.occurrence_id)),
        )
        .map((row) => ({ ...row })),
      source_evidence_retained: true,
      raw_payload_retained_in_source_store: true,
      automatic_group_assignment: false,
      automatic_content_mutation: false,
      external_acquisition_triggered: false,
    };
    return { ...base, node_digest: digest(base) };
  };
  const nodes = [...nodeByKey.values()]
    .sort(compare)
    .map(finalizeNode);
  const nodeIds = new Map(
    [...nodeByKey.keys()].map((key) => [
      key,
      nodeIdOf(key),
    ]),
  );
  const edgeCompare = (left, right) =>
    (left.first_order ?? Number.MAX_SAFE_INTEGER) -
      (right.first_order ?? Number.MAX_SAFE_INTEGER) ||
    String(nodeByKey.get(left.parent_key)?.normalized_value ?? "").localeCompare(
      String(nodeByKey.get(right.parent_key)?.normalized_value ?? ""),
      "ja",
    ) ||
    String(nodeByKey.get(left.child_key)?.normalized_value ?? "").localeCompare(
      String(nodeByKey.get(right.child_key)?.normalized_value ?? ""),
      "ja",
    ) ||
    String(left.demand_type ?? "").localeCompare(
      String(right.demand_type ?? ""),
      "ja",
    ) ||
    String(left.edge_key).localeCompare(String(right.edge_key), "ja");
  const finalizeEdge = (edge) => {
    const occurrenceIds = sortedUnique([...edge.occurrence_ids]);
    const base = {
      edge_id: edgeIdOf(edge.edge_key),
      group_id: edge.group_id,
      parent_node_id: nodeIds.get(edge.parent_key),
      child_node_id: nodeIds.get(edge.child_key),
      demand_type: edge.demand_type,
      depth: edge.depth,
      occurrence_count: occurrenceIds.length,
      occurrence_ids: occurrenceIds,
      task_ids: sortedUnique([...edge.task_ids]),
      source_keywords: sortedUnique([...edge.source_keywords]),
      snapshot_digests: sortedUnique([...edge.snapshot_digests]),
      evidence: edge.evidence
        .sort((left, right) =>
          (left.occurrence_order ?? Number.MAX_SAFE_INTEGER) -
            (right.occurrence_order ?? Number.MAX_SAFE_INTEGER) ||
          String(left.occurrence_id).localeCompare(String(right.occurrence_id)),
        )
        .map((row) => ({ ...row })),
      source_evidence_retained: true,
      raw_payload_retained_in_source_store: true,
      automatic_group_assignment: false,
      automatic_content_mutation: false,
      external_acquisition_triggered: false,
    };
    return {
      ...base,
      edge_digest: digest(base),
      multiple_parent: (nodeByKey.get(edge.child_key)?.parent_keys.size ?? 0) > 1,
      cycle_detected:
        cycles.has(edge.parent_key) || cycles.has(edge.child_key),
    };
  };
  const edges = [...edgeByKey.values()].sort(edgeCompare).map(finalizeEdge);
  const traceRows = (mode) =>
    traceGraph(nodeByKey, edgeByKey, roots, mode, requestedDepth).map(
      (entry, index) => ({
        visit_order: index,
        strategy: mode,
        node_id: nodeIds.get(entry.node_key),
        depth: entry.depth,
        parent_edge_id: entry.parent_edge_key
          ? edgeIdOf(entry.parent_edge_key)
          : null,
        path_node_ids: entry.path.map((key) => nodeIds.get(key)),
        node: nodes.find((node) => node.node_id === nodeIds.get(entry.node_key)) ?? null,
        trace_digest: digest({ mode, index, ...entry }),
      }),
    );
  const breadthTrace = traceRows("breadth_first");
  const depthTrace = traceRows("depth_first");
  const firstDivergence = (() => {
    const length = Math.min(breadthTrace.length, depthTrace.length);
    for (let index = 0; index < length; index++) {
      if (breadthTrace[index].node_id !== depthTrace[index].node_id)
        return {
          visit_order: index,
          breadth_first_node_id: breadthTrace[index].node_id,
          depth_first_node_id: depthTrace[index].node_id,
        };
    }
    return breadthTrace.length === depthTrace.length
      ? null
      : {
          visit_order: length,
          breadth_first_node_id: breadthTrace[length]?.node_id ?? null,
          depth_first_node_id: depthTrace[length]?.node_id ?? null,
        };
  })();
  const selectedTrace = selectedStrategy === "depth_first" ? depthTrace : breadthTrace;
  const observedMaxDepth = Math.max(0, ...matchingRows.map((row) => row.depth));
  const strategyComparison = {
    breadth_first: {
      trace_length: breadthTrace.length,
      node_ids: breadthTrace.map((row) => row.node_id),
    },
    depth_first: {
      trace_length: depthTrace.length,
      node_ids: depthTrace.map((row) => row.node_id),
    },
    order_differed: Boolean(firstDivergence),
    first_divergence: firstDivergence,
    provider_trace_available: false,
    internal_algorithm_identified: false,
  };
  const disambiguationState =
    observedMaxDepth < 2
      ? "insufficient_retained_depth"
      : firstDivergence
        ? "local_strategies_diverge_provider_trace_required"
        : "local_strategies_same_order_provider_trace_required";
  const base = {
    site_id: siteId,
    group_id: groupId || "all",
    query,
    strategy: selectedStrategy,
    max_depth: requestedDepth,
    rows: selectedTrace,
    nodes,
    edges,
    traces: { breadth_first: breadthTrace, depth_first: depthTrace },
    strategy_comparison: strategyComparison,
    summary: {
      site_id: siteId,
      group_count: siteGroups.length,
      considered_occurrence_count: consideredOccurrenceCount,
      matched_occurrence_count: matchedOccurrenceCount,
      filtered_occurrence_count: filteredOccurrenceCount,
      excluded_depth_count: excludedDepthCount,
      missing_parent_count: missingParentCount,
      node_count: nodes.length,
      edge_count: edges.length,
      root_count: roots.length,
      observed_max_depth: observedMaxDepth,
      requested_max_depth: requestedDepth,
      depth_1_occurrence_count: matchingRows.filter((row) => row.depth === 1).length,
      depth_2_occurrence_count: matchingRows.filter((row) => row.depth === 2).length,
      cycle_node_count: nodes.filter((node) => node.cycle_detected).length,
      multiple_parent_node_count: nodes.filter((node) => node.multiple_parent).length,
      review_required_node_count: nodes.filter(
        (node) => node.review_state === "review_required",
      ).length,
      trace_length: selectedTrace.length,
      strategy_order_differed: Boolean(firstDivergence),
      disambiguation_state: disambiguationState,
      internal_algorithm_identified: false,
      provider_trace_available: false,
      automatic_group_assignment: false,
      automatic_generation: false,
      automatic_content_mutation: false,
      automatic_publication: false,
      external_acquisition_triggered: false,
    },
    policy: "latent-demand-traversal.v1",
    source_policy: "retained_serp_demand_occurrences_only",
    evidence_boundary: {
      internal_algorithm_proven: false,
      provider_confirmation_observed: false,
      provider_trace_available: false,
      external_request_executed: false,
      paid_request_executed: false,
      automatic_group_assignment: false,
      automatic_content_mutation: false,
      automatic_publication: false,
    },
    automatic_group_assignment: false,
    automatic_generation: false,
    automatic_content_mutation: false,
    automatic_publication: false,
    external_acquisition_triggered: false,
  };
  return {
    ...base,
    lineage_digest: digest({
      summary: base.summary,
      nodes: nodes.map((node) => node.node_digest),
      edges: edges.map((edge) => edge.edge_digest),
      traces: {
        breadth_first: breadthTrace.map((row) => row.trace_digest),
        depth_first: depthTrace.map((row) => row.trace_digest),
      },
    }),
  };
}
