const search = document.querySelector("#suggest-expansion-search");
const view = document.querySelector("#suggest-expansion-view");
const classFilter = document.querySelector("#suggest-expansion-class");
const metricsRoot = document.querySelector("#suggest-expansion-metrics");
const statusRoot = document.querySelector("#suggest-expansion-status");
const headRoot = document.querySelector("#suggest-expansion-head");
const rowsRoot = document.querySelector("#suggest-expansion-rows");
const emptyRoot = document.querySelector("#suggest-expansion-empty");
const number = new Intl.NumberFormat("ja-JP");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ],
  );
const currentSiteId = () =>
  document.querySelector("#site-selector .site-tab.active")?.dataset.site ?? "";
const compactJson = (value, length = 180) =>
  JSON.stringify(value ?? null).slice(0, length);
const classLabel = (row) =>
  row?.suggest_symbol
    ? `${row.suggest_symbol} ${row.class_label ?? ""}`
    : row?.suggest_class == null
      ? "—"
      : String(row.suggest_class);

const renderSummary = (summary = {}, payload = {}) => {
  if (!metricsRoot) return;
  const values = [
    ["保持seed", summary.seed_count],
    ["探索frontier", summary.frontier_count],
    ["外部結果", summary.observed_external_result_count],
    ["未取得engine", summary.engine_not_acquired_count],
    ["最大計画深度", summary.max_plan_depth],
  ];
  metricsRoot.innerHTML = values
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${escapeHtml(label)}</span><strong>${number.format(value ?? 0)}</strong><small>件</small></div>`,
    )
    .join("");
  if (statusRoot)
    statusRoot.innerHTML = `<strong>${escapeHtml(payload.view ?? "seeds")} を表示</strong><span>公式区分・保持済みseed・計画traceを分離 · 外部取得0 · 自動割当0 · 自動生成0 · 自動公開0 · 内部DFS断定0</span>`;
};

const renderTable = (payload) => {
  const currentView = payload.view ?? "seeds";
  const rows = payload.data ?? [];
  if (!headRoot || !rowsRoot || !emptyRoot) return;
  const headers = {
    seeds: ["seed", "元行", "状態", "外部class", "digest"],
    frontier: ["seed", "区分", "入力関係", "状態", "append family", "結果", "digest"],
    engines: ["取得面", "状態", "request", "result", "理由"],
    contract: ["項目", "内容"],
    traces: ["strategy", "node order", "depth", "trace state"],
  }[currentView] ?? [];
  headRoot.innerHTML = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  if (currentView === "seeds") {
    rowsRoot.innerHTML = rows
      .map(
        (row) =>
          `<tr><td><strong>${escapeHtml(row.representative_keyword)}</strong><small class="cell-note">${escapeHtml(row.normalized_keyword)}</small></td><td>${number.format(row.source_row_count ?? 0)}行 / ${number.format(row.source_sheet_count ?? 0)}sheet</td><td>${escapeHtml(row.observed_workbook_state)}</td><td>未観測</td><td><code>${escapeHtml(String(row.evidence_digest ?? "").slice(0, 12))}</code></td></tr>`,
      )
      .join("");
  } else if (currentView === "frontier") {
    rowsRoot.innerHTML = rows
      .map(
        (row) =>
          `<tr><td><strong>${escapeHtml(row.normalized_seed)}</strong><small class="cell-note">${escapeHtml(String(row.seed_id ?? "").slice(0, 16))}</small></td><td>${escapeHtml(classLabel(row))}</td><td>${escapeHtml(row.input_relation)}</td><td>${escapeHtml(row.state)}</td><td>${escapeHtml((row.append_families ?? []).map((family) => family.family).join(" / ") || "—")}</td><td>${number.format(row.observed_result_count ?? 0)}</td><td><code>${escapeHtml(String(row.evidence_digest ?? "").slice(0, 12))}</code></td></tr>`,
      )
      .join("");
  } else if (currentView === "engines") {
    rowsRoot.innerHTML = rows
      .map(
        (row) =>
          `<tr><td><strong>${escapeHtml(row.mode)}</strong></td><td>${escapeHtml(row.status)}</td><td>${number.format(row.request_count ?? 0)}</td><td>${number.format(row.returned_count ?? 0)}</td><td>${escapeHtml(row.reason)}</td></tr>`,
      )
      .join("");
  } else if (currentView === "contract") {
    const contract = rows[0] ?? {};
    rowsRoot.innerHTML = Object.entries(contract)
      .filter(([key]) => ["source_sha256", "source_file", "operation_id", "method", "path", "source_state", "credit", "request", "response", "class_semantics"].includes(key))
      .map(
        ([key, value]) =>
          `<tr><td><strong>${escapeHtml(key)}</strong></td><td><code>${escapeHtml(compactJson(value))}</code></td></tr>`,
      )
      .join("");
  } else {
    rowsRoot.innerHTML = rows
      .map(
        (row) =>
          `<tr><td><strong>${escapeHtml(row.strategy)}</strong></td><td><code>${escapeHtml((row.node_order ?? []).join(" → "))}</code></td><td>${number.format(row.max_depth ?? 0)}</td><td>${escapeHtml(row.trace_state)}</td></tr>`,
      )
      .join("");
  }
  emptyRoot.hidden = rows.length > 0;
  emptyRoot.innerHTML = rows.length
    ? ""
    : "<strong>該当する計画がありません</strong><span>検索語または表示条件を変更してください。外部取得は実行されません。</span>";
};

let requestSerial = 0;
const render = async () => {
  if (!metricsRoot || !rowsRoot) return;
  const siteId = currentSiteId();
  if (!siteId) return;
  const serial = ++requestSerial;
  const url = new URL("/api/v1/suggest-expansion-logic", location.origin);
  url.searchParams.set("site_id", siteId);
  url.searchParams.set("view", view?.value ?? "seeds");
  url.searchParams.set("limit", "100");
  if (search?.value.trim()) url.searchParams.set("q", search.value.trim());
  if (classFilter?.value && classFilter.value !== "all")
    url.searchParams.set("suggest_class", classFilter.value);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`suggest-expansion-logic: ${response.status}`);
    const payload = await response.json();
    if (serial !== requestSerial) return;
    renderSummary(payload.summary, payload);
    renderTable(payload);
  } catch (error) {
    if (serial !== requestSerial) return;
    metricsRoot.innerHTML = "";
    if (statusRoot) statusRoot.innerHTML = "";
    rowsRoot.innerHTML = "";
    emptyRoot.hidden = false;
    emptyRoot.innerHTML = `<strong>拡張ロジックを読み込めませんでした</strong><span>${escapeHtml(error.message)}</span>`;
  }
};

search?.addEventListener("input", render);
view?.addEventListener("change", render);
classFilter?.addEventListener("change", render);
document.addEventListener("click", (event) => {
  if (!event.target.closest("#site-selector .site-tab")) return;
  setTimeout(render, 0);
});
const siteSelector = document.querySelector("#site-selector");
if (siteSelector)
  new MutationObserver(() => {
    if (currentSiteId()) render();
  }).observe(siteSelector, { childList: true, subtree: true });
render();
