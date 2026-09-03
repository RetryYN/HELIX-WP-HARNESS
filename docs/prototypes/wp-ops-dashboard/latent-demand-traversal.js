const search = document.querySelector("#latent-demand-traversal-search");
const strategy = document.querySelector("#latent-demand-traversal-strategy");
const depth = document.querySelector("#latent-demand-traversal-depth");
const summaryRoot = document.querySelector("#latent-demand-traversal-summary");
const statusRoot = document.querySelector("#latent-demand-traversal-status");
const rowsRoot = document.querySelector("#latent-demand-traversal-rows");
const emptyRoot = document.querySelector("#latent-demand-traversal-empty");
const number = new Intl.NumberFormat("ja-JP");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ],
  );
const currentSiteId = () =>
  document.querySelector("#site-selector .site-tab.active")?.dataset.site ?? "";
const labels = {
  insufficient_retained_depth: "保持証跡が深度1のみ。DFS/BFSは判別不能",
  local_strategies_diverge_provider_trace_required:
    "ローカルBFS/DFSは順序が分岐。提供元traceが必要",
  local_strategies_same_order_provider_trace_required:
    "ローカルBFS/DFSは同順。提供元traceが必要",
};

const renderSummary = (summary, identifiabilityProof) => {
  if (!summaryRoot) return;
  const metrics = [
    ["occurrence", summary.matched_occurrence_count],
    ["node", summary.node_count],
    ["edge", summary.edge_count],
    ["深度2", summary.depth_2_occurrence_count],
    ["複数親review", summary.multiple_parent_node_count],
    ["cycle review", summary.cycle_node_count],
  ];
  summaryRoot.innerHTML = metrics
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${escapeHtml(label)}</span><strong>${number.format(value ?? 0)}</strong><small>件</small></div>`,
    )
    .join("");
  if (statusRoot) {
    const projectionState = identifiabilityProof?.public_projection?.equal === true
      ? "公開projectionではDFS/BFS同一可"
      : "公開projection反例未評価";
    statusRoot.innerHTML = `<strong>${escapeHtml(labels[summary.disambiguation_state] ?? "保持証跡による比較")}</strong><span>方式の断定: no · ${escapeHtml(projectionState)} · 自動割当0 · 自動反映0 · 自動公開0</span>`;
  }
};

const renderRows = (payload) => {
  if (!rowsRoot || !emptyRoot) return;
  const nodes = new Map((payload.nodes ?? []).map((node) => [node.node_id, node]));
  rowsRoot.innerHTML = (payload.data ?? [])
    .map((row) => {
      const node = row.node ?? nodes.get(row.node_id) ?? {};
      const path = (row.path_node_ids ?? [])
        .map((nodeId) => nodes.get(nodeId)?.value ?? String(nodeId ?? "").slice(0, 8))
        .join(" → ");
      const type = node.node_kind === "seed" ? "seed" : node.demand_type ?? "demand";
      return `<tr>
        <td>${number.format((row.visit_order ?? 0) + 1)}</td>
        <td>${number.format(row.depth ?? 0)}</td>
        <td>${escapeHtml(type)}</td>
        <td><strong>${escapeHtml(node.value)}</strong><small class="cell-note">${escapeHtml(node.normalized_value)}</small></td>
        <td>${escapeHtml(path)}</td>
        <td>${number.format(node.occurrence_count ?? 0)}<small class="cell-note">${number.format((node.occurrence_ids ?? []).length)} evidence</small></td>
        <td>${escapeHtml(node.review_state ?? "observed_path")}<small class="cell-note">${node.cycle_detected ? "cycle" : node.multiple_parent ? "multiple parent" : "保持証跡"}</small></td>
      </tr>`;
    })
    .join("");
  emptyRoot.hidden = (payload.data ?? []).length > 0;
  emptyRoot.innerHTML = (payload.data ?? []).length
    ? ""
    : "<strong>潜在需要の保持証跡がありません</strong><span>サイト・検索語・深度を変更してください。外部取得は実行されません。</span>";
};

let requestSerial = 0;
const render = async () => {
  if (!summaryRoot || !rowsRoot) return;
  const siteId = currentSiteId();
  if (!siteId) return;
  const serial = ++requestSerial;
  const url = new URL("/api/v1/latent-demand-traversal", location.origin);
  url.searchParams.set("site_id", siteId);
  url.searchParams.set("limit", "100");
  url.searchParams.set("strategy", strategy?.value === "depth_first" ? "depth_first" : "breadth_first");
  url.searchParams.set("max_depth", depth?.value === "1" ? "1" : "2");
  if (search?.value.trim()) url.searchParams.set("q", search.value.trim());
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`latent-demand: ${response.status}`);
    const payload = await response.json();
    if (serial !== requestSerial) return;
    renderSummary(payload.summary ?? {}, payload.identifiability_proof);
    renderRows(payload);
  } catch (error) {
    if (serial !== requestSerial) return;
    summaryRoot.innerHTML = "";
    if (statusRoot) statusRoot.innerHTML = "";
    rowsRoot.innerHTML = "";
    emptyRoot.hidden = false;
    emptyRoot.innerHTML = `<strong>潜在需要を読み込めませんでした</strong><span>${escapeHtml(error.message)}</span>`;
  }
};

search?.addEventListener("input", render);
strategy?.addEventListener("change", render);
depth?.addEventListener("change", render);
document.addEventListener("click", (event) => {
  if (!event.target.closest("#site-selector .site-tab")) return;
  setTimeout(render, 0);
});
const siteSelector = document.querySelector("#site-selector");
if (siteSelector) {
  new MutationObserver(() => {
    if (currentSiteId()) render();
  }).observe(siteSelector, { childList: true });
}
render();
