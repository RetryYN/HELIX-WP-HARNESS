const search = document.querySelector("#keyword-expansion-lineage-search");
const view = document.querySelector("#keyword-expansion-lineage-view");
const disposition = document.querySelector("#keyword-expansion-lineage-disposition");
const summaryRoot = document.querySelector("#keyword-expansion-lineage-summary");
const statusRoot = document.querySelector("#keyword-expansion-lineage-status");
const headRoot = document.querySelector("#keyword-expansion-lineage-head");
const rowsRoot = document.querySelector("#keyword-expansion-lineage-rows");
const emptyRoot = document.querySelector("#keyword-expansion-lineage-empty");
const number = new Intl.NumberFormat("ja-JP");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ],
  );
const currentSiteId = () =>
  document.querySelector("#site-selector .site-tab.active")?.dataset.site ?? "";
const compact = (value, length = 12) => String(value ?? "—").slice(0, length);
const stateLabel = {
  retained: "保持",
  not_acquired: "未取得",
  zero: "0件",
  not_applicable: "非該当",
  failed: "取得失敗",
};
const viewLabel = { nodes: "ノード", edges: "エッジ", coverage: "元KW処遇", surfaces: "取得面処遇" };

const renderSummary = (summary = {}, currentView = "nodes") => {
  if (!summaryRoot) return;
  const metrics = [
    ["元KW", summary.source_keyword_count],
    ["正規化KW", summary.normalized_keyword_count],
    ["ノード", summary.node_count],
    ["エッジ", summary.edge_count],
    ["未取得", summary.source_disposition_counts?.not_acquired],
    ["0件", summary.zero_expansion_source_keyword_count],
    ["失敗", summary.failed_source_keyword_count],
  ];
  summaryRoot.innerHTML = metrics
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${escapeHtml(label)}</span><strong>${number.format(value ?? 0)}</strong><small>件</small></div>`,
    )
    .join("");
  if (statusRoot) {
    statusRoot.innerHTML = `<strong>${escapeHtml(viewLabel[currentView] ?? currentView)}を表示</strong><span>元行と証跡digestを保持 · 処遇（保持 / 未取得 / 0件 / 非該当 / 取得失敗）を分離 · 自動割当0 · 自動生成0 · 自動反映0 · 自動公開0</span>`;
  }
};

const renderTable = (payload) => {
  const currentView = payload.view ?? "nodes";
  const rows = payload.data ?? [];
  if (!headRoot || !rowsRoot || !emptyRoot) return;
  const headers = {
    nodes: ["種別", "ラベル", "処遇", "source / group", "metadata", "digest"],
    edges: ["種別", "from", "to", "処遇", "source / task", "review / digest"],
    coverage: ["元KW", "処遇", "理由", "拡張edge", "失敗task", "digest"],
    surfaces: ["取得面", "処遇", "理由", "自動利用", "digest"],
  }[currentView] ?? [];
  headRoot.innerHTML = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  if (currentView === "nodes") {
    rowsRoot.innerHTML = rows
      .map(
        (row) =>
          `<tr><td><strong>${escapeHtml(row.node_type)}</strong></td><td>${escapeHtml(row.label)}<small class="cell-note">${escapeHtml(row.normalized_label)}</small></td><td>${escapeHtml(stateLabel[row.source_state] ?? row.source_state)}</td><td>${escapeHtml(row.source_ids?.slice(0, 2).join(" / ") || "—")}<small class="cell-note">${escapeHtml(row.group_ids?.slice(0, 2).join(" / ") || "—")}</small></td><td>${escapeHtml(JSON.stringify(row.metadata ?? {}).slice(0, 120))}</td><td><code>${escapeHtml(compact(row.node_digest))}</code></td></tr>`,
      )
      .join("");
  } else if (currentView === "edges") {
    rowsRoot.innerHTML = rows
      .map(
        (row) =>
          `<tr><td><strong>${escapeHtml(row.edge_type)}</strong></td><td>${escapeHtml(row.from_label)}<small class="cell-note">${escapeHtml(compact(row.from_node_id, 18))}</small></td><td>${escapeHtml(row.to_label)}<small class="cell-note">${escapeHtml(compact(row.to_node_id, 18))}</small></td><td>${escapeHtml(stateLabel[row.retention_state] ?? row.retention_state)}</td><td>${escapeHtml(row.source_keyword_id ?? "—")}<small class="cell-note">${escapeHtml(row.task_id ?? row.occurrence_id ?? "—")}</small></td><td>${row.review_required || row.context_review_required ? "要review" : "—"}<small class="cell-note"><code>${escapeHtml(compact(row.evidence_digest))}</code></small></td></tr>`,
      )
      .join("");
  } else if (currentView === "coverage") {
    rowsRoot.innerHTML = rows
      .map(
        (row) =>
          `<tr><td><strong>${escapeHtml(row.raw_keyword)}</strong><small class="cell-note">${escapeHtml(row.source_sheet)}:${escapeHtml(row.source_row)}</small></td><td>${escapeHtml(stateLabel[row.disposition_state] ?? row.disposition_state)}</td><td>${escapeHtml(row.disposition_reason)}</td><td>${number.format(row.expansion_edge_count ?? 0)}</td><td>${number.format(row.task_failure_count ?? 0)}</td><td><code>${escapeHtml(compact(row.coverage_digest))}</code></td></tr>`,
      )
      .join("");
  } else {
    rowsRoot.innerHTML = rows
      .map(
        (row) =>
          `<tr><td><strong>${escapeHtml(row.surface)}</strong></td><td>${escapeHtml(stateLabel[row.disposition_state] ?? row.disposition_state)}</td><td>${escapeHtml(row.disposition_reason)}</td><td>${row.auto_content_use ? "あり" : "なし"}</td><td><code>${escapeHtml(compact(row.coverage_digest))}</code></td></tr>`,
      )
      .join("");
  }
  emptyRoot.hidden = rows.length > 0;
  emptyRoot.innerHTML = rows.length
    ? ""
    : "<strong>一致するlineageがありません</strong><span>検索語または表示・処遇filterを変更してください。外部取得は実行されません。</span>";
};

let requestSerial = 0;
const render = async () => {
  if (!summaryRoot || !rowsRoot) return;
  const siteId = currentSiteId();
  if (!siteId) return;
  const serial = ++requestSerial;
  const url = new URL("/api/v1/keyword-expansion-lineage", location.origin);
  url.searchParams.set("site_id", siteId);
  url.searchParams.set("view", view?.value ?? "nodes");
  url.searchParams.set("limit", "100");
  if (search?.value.trim()) url.searchParams.set("q", search.value.trim());
  if (disposition?.value && disposition.value !== "all")
    url.searchParams.set("disposition", disposition.value);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`keyword-expansion-lineage: ${response.status}`);
    const payload = await response.json();
    if (serial !== requestSerial) return;
    renderSummary(payload.summary, payload.view);
    renderTable(payload);
  } catch (error) {
    if (serial !== requestSerial) return;
    summaryRoot.innerHTML = "";
    if (statusRoot) statusRoot.innerHTML = "";
    rowsRoot.innerHTML = "";
    emptyRoot.hidden = false;
    emptyRoot.innerHTML = `<strong>KW拡張lineageを読み込めませんでした</strong><span>${escapeHtml(error.message)}</span>`;
  }
};

search?.addEventListener("input", render);
view?.addEventListener("change", render);
disposition?.addEventListener("change", render);
document.addEventListener("click", (event) => {
  if (!event.target.closest("#site-selector .site-tab")) return;
  setTimeout(render, 0);
});
const siteSelector = document.querySelector("#site-selector");
if (siteSelector)
  new MutationObserver(() => {
    if (currentSiteId()) render();
  }).observe(siteSelector, { childList: true });
render();
