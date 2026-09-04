import { createHash } from "node:crypto";

const POLICY = "serp-depth-inventory.v1",
  INTERPRETATION_POLICY =
    "retained_rank_rows_only; unobserved_slots_are_not_ranked_or_absent_claims",
  DEFAULT_DECLARED_DEPTH = 10,
  DEFAULT_TARGET_DEPTH = 20,
  digest = (value) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex"),
  integer = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  },
  rankBand = (upper, lower = 1) => ({ upper, lower }),
  BANDS = [
    ["top_3", rankBand(3)],
    ["top_5", rankBand(5)],
    ["top_10", rankBand(10)],
    ["ranks_11_20", rankBand(20, 11)],
  ];

const taskDepth = (task, fallback) =>
  integer(
    task.declared_depth ??
      task.depth ??
      task.task_data?.depth ??
      task.contract?.depth,
    fallback,
  );

const rankRow = (row, taskId) => {
  const rank = Number(row.rank_absolute ?? row.rank ?? row.position);
  if (!Number.isInteger(rank) || rank <= 0) return null;
  return {
    task_id: taskId,
    rank_absolute: rank,
    rank_group: Number.isInteger(Number(row.rank_group))
      ? Number(row.rank_group)
      : null,
    url: row.url ?? null,
    domain: row.domain ?? null,
    title: row.title ?? null,
  };
};

const coverageFor = (ranks, upper, lower) => {
  const expected = Math.max(0, upper - lower + 1),
    observed = ranks.filter((rank) => rank >= lower && rank <= upper),
    observedSet = new Set(observed);
  return {
    lower_rank: lower,
    upper_rank: upper,
    expected_slot_count: expected,
    observed_slot_count: observedSet.size,
    observed_row_count: observed.length,
    not_observed_in_retained_rows: Array.from(
      { length: expected },
      (_, index) => lower + index,
    ).filter((rank) => !observedSet.has(rank)),
  };
};

const stateFor = ({ rows, declaredDepth, targetDepth, targetCoverage }) => {
  if (!rows.length) return "no_rows_retained";
  if (targetCoverage.observed_slot_count === targetDepth)
    return "target_depth_complete";
  if (rows.some((row) => row.rank_absolute > targetDepth))
    return "over_target_depth_observed";
  if (rows.some((row) => row.rank_absolute > declaredDepth))
    return "over_declared_depth_observed";
  return "declared_depth_only";
};

const rowForTask = (task, sourceRows, targetDepth, fallbackDeclaredDepth) => {
  const taskId = String(task.task_id ?? ""),
    declaredDepth = taskDepth(task, fallbackDeclaredDepth),
    rows = sourceRows
      .map((row) => rankRow(row, taskId))
      .filter(Boolean)
      .sort(
        (left, right) =>
          left.rank_absolute - right.rank_absolute ||
          String(left.url ?? "").localeCompare(String(right.url ?? "")),
      ),
    ranks = rows.map((row) => row.rank_absolute),
    distinctRanks = [...new Set(ranks)].sort((left, right) => left - right),
    targetCoverage = coverageFor(distinctRanks, targetDepth, 1),
    declaredCoverage = coverageFor(
      distinctRanks,
      Math.min(declaredDepth, targetDepth),
      1,
    ),
    bands = Object.fromEntries(
      BANDS.map(([name, band]) => [
        name,
        coverageFor(distinctRanks, Math.min(band.upper, targetDepth), band.lower),
      ]),
    ),
    rank11To20Rows = rows.filter(
      (row) => row.rank_absolute >= 11 && row.rank_absolute <= targetDepth,
    ),
    overDeclaredRows = rows.filter(
      (row) => row.rank_absolute > declaredDepth && row.rank_absolute <= targetDepth,
    ),
    overTargetRows = rows.filter((row) => row.rank_absolute > targetDepth),
    state = stateFor({
      rows,
      declaredDepth,
      targetDepth,
      targetCoverage,
    }),
    evidence = {
      source_task_id: taskId,
      snapshot_digest: task.snapshot_digest ?? null,
      observed_at: task.observed_at ?? null,
      declared_depth_source: task.declared_depth != null || task.depth != null
        ? "task_metadata"
        : task.task_data?.depth != null
          ? "task_data"
          : "fallback",
      retained_row_count: rows.length,
      retained_rank_count: distinctRanks.length,
      rank_11_20_rows: rank11To20Rows.map((row) => ({
        rank_absolute: row.rank_absolute,
        rank_group: row.rank_group,
        url: row.url,
        domain: row.domain,
        title: row.title,
        evidence_id: `${taskId}:${row.rank_absolute}`,
      })),
      evidence_digest: digest({
        task_id: taskId,
        snapshot_digest: task.snapshot_digest ?? null,
        ranks: rows,
      }),
    };
  return {
    site_id: task.site_id ?? null,
    group_id: task.group_id ?? null,
    task_id: taskId,
    keyword: task.keyword ?? null,
    observed_at: task.observed_at ?? null,
    declared_depth: declaredDepth,
    target_depth: targetDepth,
    depth_state: state,
    observed_max_rank: distinctRanks.at(-1) ?? null,
    observed_rank_count: distinctRanks.length,
    observed_row_count: rows.length,
    duplicate_rank_row_count: rows.length - distinctRanks.length,
    declared_depth_coverage: declaredCoverage,
    target_depth_coverage: targetCoverage,
    bands,
    rank_11_20_observed: rank11To20Rows.length > 0,
    rank_11_20_row_count: rank11To20Rows.length,
    rank_11_20_slot_count: new Set(
      rank11To20Rows.map((row) => row.rank_absolute),
    ).size,
    rank_11_20_evidence: evidence.rank_11_20_rows,
    over_target_row_count: overTargetRows.length,
    source_evidence: evidence,
    row_digest: digest({
      site_id: task.site_id ?? null,
      group_id: task.group_id ?? null,
      task_id: taskId,
      keyword: task.keyword ?? null,
      declared_depth: declaredDepth,
      target_depth: targetDepth,
      depth_state: state,
      observed_ranks: rows,
      snapshot_digest: task.snapshot_digest ?? null,
    }),
  };
};

export function summarizeSerpDepthInventory(rows, targetDepth = DEFAULT_TARGET_DEPTH) {
  const sorted = [...rows].sort((left, right) =>
      String(left.task_id).localeCompare(String(right.task_id)),
    ),
    count = (state) => sorted.filter((row) => row.depth_state === state).length,
    observedRows = sorted.reduce(
      (sum, row) => sum + row.observed_row_count,
      0,
    ),
    rank11Rows = sorted.reduce(
      (sum, row) => sum + row.rank_11_20_row_count,
      0,
    ),
    rank11Slots = sorted.reduce(
      (sum, row) => sum + row.rank_11_20_slot_count,
      0,
    ),
    maxObserved = sorted
      .map((row) => row.observed_max_rank)
      .filter(Number.isInteger);
  return {
    task_count: sorted.length,
    task_with_rows_count: sorted.filter((row) => row.observed_row_count > 0)
      .length,
    task_without_rows_count: count("no_rows_retained"),
    declared_depth_only_count: count("declared_depth_only"),
    over_declared_depth_count: count("over_declared_depth_observed"),
    over_target_depth_count: count("over_target_depth_observed"),
    target_depth_complete_count: count("target_depth_complete"),
    task_with_rank_11_20_count: sorted.filter(
      (row) => row.rank_11_20_observed,
    ).length,
    observed_row_count: observedRows,
    rank_11_20_row_count: rank11Rows,
    rank_11_20_slot_count: rank11Slots,
    max_observed_rank: maxObserved.length ? Math.max(...maxObserved) : null,
    declared_depth_distribution: Object.fromEntries(
      [...new Set(sorted.map((row) => row.declared_depth))]
        .sort((left, right) => left - right)
        .map((depth) => [
          String(depth),
          sorted.filter((row) => row.declared_depth === depth).length,
        ]),
    ),
    target_depth: targetDepth,
    target_depth_is_provider_request: false,
    unobserved_rank_slots_are_not_unranked_claims: true,
    external_acquisition_triggered: false,
  };
}

export function buildSerpDepthInventory(
  tasks = [],
  organicResults = [],
  { targetDepth = DEFAULT_TARGET_DEPTH, declaredDepthFallback = DEFAULT_DECLARED_DEPTH } = {},
) {
  const normalizedTargetDepth = integer(targetDepth, DEFAULT_TARGET_DEPTH),
    normalizedFallback = integer(declaredDepthFallback, DEFAULT_DECLARED_DEPTH),
    byTask = Map.groupBy(
      organicResults,
      (row) => String(row.task_id ?? ""),
    ),
    rows = tasks
      .filter((task) => task?.task_id != null)
      .map((task) =>
        rowForTask(
          task,
          byTask.get(String(task.task_id)) ?? [],
          normalizedTargetDepth,
          normalizedFallback,
        ),
      )
      .sort((left, right) => left.task_id.localeCompare(right.task_id)),
    siteGroups = Map.groupBy(rows, (row) => row.site_id ?? ""),
    bySite = Object.fromEntries(
      [...siteGroups.entries()].map(([siteId, siteRows]) => [
        siteId || null,
        summarizeSerpDepthInventory(siteRows, normalizedTargetDepth),
      ]),
    ),
    base = {
      policy: POLICY,
      interpretation_policy: INTERPRETATION_POLICY,
      target_depth: normalizedTargetDepth,
      target_depth_is_provider_request: false,
      declared_depth_fallback: normalizedFallback,
      rows,
      summary: summarizeSerpDepthInventory(rows, normalizedTargetDepth),
      by_site: bySite,
      external_acquisition_triggered: false,
      provider_depth_claim: false,
    };
  return { ...base, inventory_digest: digest(base) };
}

export function projectSerpDepthInventory(inventory, siteId) {
  const rows = (inventory?.rows ?? []).filter((row) => row.site_id === siteId),
    targetDepth = integer(inventory?.target_depth, DEFAULT_TARGET_DEPTH),
    summary = summarizeSerpDepthInventory(rows, targetDepth),
    hasContentCoverage = rows.some(
      (row) => row.rank_11_20_content_state != null,
    ),
    contentSummary = hasContentCoverage
      ? summarizeSerpDepthContentCoverage(rows)
      : null,
    base = {
      policy: inventory?.policy ?? POLICY,
      interpretation_policy: inventory?.interpretation_policy ?? INTERPRETATION_POLICY,
      site_id: siteId,
      target_depth: targetDepth,
      target_depth_is_provider_request: false,
      rows,
      summary,
      content_summary: contentSummary,
      content_coverage_digest: hasContentCoverage
        ? digest({
            policy: inventory?.policy ?? POLICY,
            rows,
            content_summary: contentSummary,
          })
        : inventory?.content_coverage_digest ?? null,
      external_acquisition_triggered: false,
      provider_depth_claim: false,
    };
  return { ...base, inventory_digest: digest(base) };
}

export function summarizeSerpDepthContentCoverage(rows = []) {
  const numericTotal = (field) =>
    rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
  return {
    task_count: rows.length,
    task_with_rank_11_20_serp_count: rows.filter(
      (row) => Number(row.rank_11_20_row_count ?? 0) > 0,
    ).length,
    task_rank_11_20_serp_only_count: rows.filter(
      (row) => row.rank_11_20_content_state === "rank_11_20_serp_only",
    ).length,
    task_rank_11_20_content_observed_count: rows.filter(
      (row) => row.rank_11_20_content_state === "rank_11_20_content_observed",
    ).length,
    task_rank_11_20_mixed_count: rows.filter(
      (row) => row.rank_11_20_content_state === "rank_11_20_mixed_content_coverage",
    ).length,
    rank_11_20_serp_row_count: numericTotal("rank_11_20_row_count"),
    rank_11_20_parsed_row_count: numericTotal("rank_11_20_parsed_row_count"),
    rank_11_20_unparsed_row_count: numericTotal("rank_11_20_unparsed_row_count"),
    rank_11_20_page_evidence_count: numericTotal(
      "rank_11_20_page_evidence_count",
    ),
    rank_11_20_failed_page_evidence_count: numericTotal(
      "rank_11_20_failed_page_evidence_count",
    ),
    rank_11_20_heading_count: numericTotal("rank_11_20_heading_count"),
    rank_11_20_term_count: numericTotal("rank_11_20_term_count"),
    content_parse_is_provider_request: false,
    unparsed_serp_rows_are_not_missing_or_unranked_claims: true,
    external_acquisition_triggered: false,
  };
}

export function buildSerpDepthContentCoverage(
  inventory,
  {
    organicResults = [],
    pageTaskEvidence = [],
    pages = [],
    headings = [],
    pageTerms = [],
  } = {},
) {
  const pageById = new Map(pages.map((row) => [row.page_id, row])),
    headingCountByPage = new Map(),
    termCountByPage = new Map();
  for (const row of headings)
    headingCountByPage.set(
      row.page_id,
      (headingCountByPage.get(row.page_id) ?? 0) + 1,
    );
  for (const row of pageTerms)
    termCountByPage.set(
      row.page_id,
      (termCountByPage.get(row.page_id) ?? 0) + 1,
    );
  const evidenceByTaskUrl = new Map();
  for (const evidence of pageTaskEvidence) {
    const page = pageById.get(evidence.page_id),
      url = page?.url;
    if (!url) continue;
    const key = `${evidence.task_id}\0${url}`,
      current = evidenceByTaskUrl.get(key) ?? [];
    current.push({
      page_id: evidence.page_id,
      best_rank: evidence.best_rank,
      page_status: page.status,
      heading_count: headingCountByPage.get(evidence.page_id) ?? 0,
      term_count: termCountByPage.get(evidence.page_id) ?? 0,
    });
    evidenceByTaskUrl.set(key, current);
  }
  const rows = (inventory?.rows ?? []).map((inventoryRow) => {
      const taskRows = organicResults
          .filter(
            (row) =>
              String(row.task_id) === String(inventoryRow.task_id) &&
              Number.isInteger(Number(row.rank_absolute)) &&
              Number(row.rank_absolute) >= 11 &&
              Number(row.rank_absolute) <= inventoryRow.target_depth,
          )
          .sort((left, right) => Number(left.rank_absolute) - Number(right.rank_absolute)),
        rankEvidence = taskRows.map((row) => {
          const key = `${inventoryRow.task_id}\0${row.url ?? ""}`,
            evidence = evidenceByTaskUrl.get(key) ?? [],
            successfulEvidence = evidence.filter(
              (item) => item.page_status === "ok",
            ),
            headingCount = successfulEvidence.reduce(
              (sum, item) => sum + item.heading_count,
              0,
            ),
            termCount = successfulEvidence.reduce(
              (sum, item) => sum + item.term_count,
              0,
            );
          return {
            rank_absolute: Number(row.rank_absolute),
            url: row.url ?? null,
            domain: row.domain ?? null,
            title: row.title ?? null,
            page_evidence_count: successfulEvidence.length,
            failed_page_evidence_count: evidence.length - successfulEvidence.length,
            page_ids: successfulEvidence.map((item) => item.page_id),
            heading_count: headingCount,
            term_count: termCount,
            content_state: successfulEvidence.length
              ? "page_evidence_retained"
              : "serp_row_only",
          };
        }),
        parsed = rankEvidence.filter(
          (row) => row.content_state === "page_evidence_retained",
        ),
        unparsed = rankEvidence.filter(
          (row) => row.content_state === "serp_row_only",
        ),
        contentState = !rankEvidence.length
          ? "no_rank_11_20_retained"
          : !parsed.length
            ? "rank_11_20_serp_only"
            : !unparsed.length
              ? "rank_11_20_content_observed"
              : "rank_11_20_mixed_content_coverage";
      return {
        ...inventoryRow,
        rank_11_20_content_state: contentState,
        rank_11_20_page_evidence_count: parsed.reduce(
          (sum, row) => sum + row.page_evidence_count,
          0,
        ),
        rank_11_20_failed_page_evidence_count: rankEvidence.reduce(
          (sum, row) => sum + row.failed_page_evidence_count,
          0,
        ),
        rank_11_20_parsed_row_count: parsed.length,
        rank_11_20_unparsed_row_count: unparsed.length,
        rank_11_20_heading_count: rankEvidence.reduce(
          (sum, row) => sum + row.heading_count,
          0,
        ),
        rank_11_20_term_count: rankEvidence.reduce(
          (sum, row) => sum + row.term_count,
          0,
        ),
        rank_11_20_content_evidence: rankEvidence,
      };
    }),
    contentSummary = summarizeSerpDepthContentCoverage(rows),
    contentBase = {
      ...inventory,
      rows,
      content_summary: contentSummary,
    };
  return {
    ...contentBase,
    content_coverage_digest: digest({
      policy: inventory?.policy ?? POLICY,
      rows,
      content_summary: contentSummary,
    }),
    inventory_digest: digest(contentBase),
  };
}
