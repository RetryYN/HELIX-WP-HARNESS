const siteSelector = document.querySelector("#site-selector"),
  searchInput = document.querySelector("#serp-depth-search"),
  stateSelect = document.querySelector("#serp-depth-state"),
  metricsRoot = document.querySelector("#serp-depth-metrics"),
  rowsRoot = document.querySelector("#serp-depth-rows"),
  emptyRoot = document.querySelector("#serp-depth-empty"),
  number = new Intl.NumberFormat("ja-JP"),
  escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
    ),
  labels = {
    declared_depth_only: "宣言depth内のみ",
    over_declared_depth_observed: "宣言depth外を観測",
    target_depth_complete: "target20充足",
    over_target_depth_observed: "target20超を観測",
    no_rows_retained: "rank行なし",
  };
const contentLabels = {
  no_rank_11_20_retained: "11〜20位SERP行なし",
  rank_11_20_serp_only: "SERP行のみ",
  rank_11_20_content_observed: "本文解析済み",
  rank_11_20_mixed_content_coverage: "本文解析／SERP混在",
};

const activeSite = () =>
  siteSelector?.querySelector(".site-tab.active")?.dataset.site ??
  siteSelector?.querySelector(".site-tab")?.dataset.site ??
  "";

const render = async () => {
  if (!siteSelector || !metricsRoot || !rowsRoot) return;
  const siteId = activeSite();
  if (!siteId) return;
  const params = new URLSearchParams({
    site_id: siteId,
    limit: "100",
    view: "tasks",
  });
  if (searchInput?.value.trim()) params.set("q", searchInput.value.trim());
  if (stateSelect?.value && stateSelect.value !== "all")
    params.set("state", stateSelect.value);
  try {
    const response = await fetch(`/api/v1/serp-depth-inventory?${params}`),
      payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
    const summary = payload.summary ?? {},
      contentSummary = payload.content_summary ?? {},
      filtered = payload.meta?.total ?? 0;
    metricsRoot.innerHTML = [
      ["task", summary.task_count ?? 0, "件"],
      ["rank保持行", summary.observed_row_count ?? 0, "行"],
      ["宣言depth外task", summary.over_declared_depth_count ?? 0, "件"],
      ["11〜20位観測行", summary.rank_11_20_row_count ?? 0, "行"],
      ["11〜20位本文解析", contentSummary.rank_11_20_parsed_row_count ?? 0, "行"],
      ["最大保持rank", summary.max_observed_rank ?? "—", ""],
      ["表示task", filtered, "件"],
    ].map(
      ([label, value, unit]) =>
        `<div class="metric"><span>${label}</span><strong>${escapeHtml(number.format(value))}</strong><small>${unit}</small></div>`,
    ).join("");
    rowsRoot.innerHTML = (payload.data ?? [])
      .map((row) => {
        const evidence = (row.rank_11_20_evidence ?? [])
          .map(
            (item) =>
              `<span class="cell-note">#${escapeHtml(item.rank_absolute)} ${escapeHtml(item.domain ?? item.url ?? "")}</span>`,
          )
          .join("");
        const contentState = contentLabels[row.rank_11_20_content_state] ?? "本文解析状態なし",
          contentEvidence = row.rank_11_20_row_count
            ? `<small class="cell-note">${escapeHtml(contentState)} · 本文解析 ${escapeHtml(row.rank_11_20_parsed_row_count ?? 0)}行 / SERP-only ${escapeHtml(row.rank_11_20_unparsed_row_count ?? 0)}行 · 見出し ${escapeHtml(row.rank_11_20_heading_count ?? 0)} / 語句 ${escapeHtml(row.rank_11_20_term_count ?? 0)} · 取得失敗ページ証拠 ${escapeHtml(row.rank_11_20_failed_page_evidence_count ?? 0)}</small>`
            : "";
        return `<tr><td><strong>${escapeHtml(row.keyword ?? "—")}</strong><small class="cell-note">${escapeHtml(row.task_id)} · ${escapeHtml(row.group_id ?? "groupなし")}</small></td><td>${escapeHtml(row.declared_depth)} / ${escapeHtml(row.target_depth)}<small class="cell-note">provider requestではない</small></td><td>${escapeHtml(row.observed_rank_count)} slot / ${escapeHtml(row.observed_row_count)}行<small class="cell-note">最大 #${escapeHtml(row.observed_max_rank ?? "—")}</small></td><td>${row.rank_11_20_row_count ? `<strong>${escapeHtml(row.rank_11_20_row_count)}行</strong>${evidence}${contentEvidence}` : "—"}</td><td><strong>${escapeHtml(labels[row.depth_state] ?? row.depth_state)}</strong><small class="cell-note">未観測slot＝圏外ではない</small></td><td><code>${escapeHtml((row.row_digest ?? "").slice(0, 12))}</code><small class="cell-note">source ${escapeHtml((row.source_evidence?.evidence_digest ?? "").slice(0, 12))}</small></td></tr>`;
      })
      .join("");
    emptyRoot.hidden = Boolean(payload.data?.length);
    emptyRoot.innerHTML = payload.data?.length
      ? ""
      : "<strong>該当する深度証拠がありません</strong><span>保持rank行とフィルターを確認してください。</span>";
  } catch (error) {
    metricsRoot.innerHTML = "";
    rowsRoot.innerHTML = "";
    emptyRoot.hidden = false;
    emptyRoot.innerHTML = `<strong>深度監査を読み込めませんでした</strong><span>${escapeHtml(error.message)}</span>`;
  }
};

searchInput?.addEventListener("input", render);
stateSelect?.addEventListener("change", render);
document
  .querySelector('[data-view="serp-depth-inventory"]')
  ?.addEventListener("click", render);
siteSelector?.addEventListener("click", () => queueMicrotask(render));
new MutationObserver(() => queueMicrotask(render)).observe(siteSelector, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});
render();
