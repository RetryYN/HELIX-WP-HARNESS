const search = document.querySelector("#keyword-content-lineage-search");
const summaryRoot = document.querySelector("#keyword-content-lineage-summary");
const rowsRoot = document.querySelector("#keyword-content-lineage-rows");
const emptyRoot = document.querySelector("#keyword-content-lineage-empty");
const yen = new Intl.NumberFormat("ja-JP");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ],
  );

const labels = {
  retained: "保持",
  proposal_only: "候補のみ",
  missing: "未接続",
  observed: "観測",
  not_observed: "未観測",
  candidate: "候補",
  blocked: "公開停止",
  review: "レビュー",
  unknown: "不明",
};

const stageLabel = (stage) => {
  const label = labels[stage?.state] ?? stage?.state ?? "不明";
  return `${label} · ${yen.format(stage?.count ?? 0)}`;
};

const currentSiteId = () =>
  document.querySelector("#site-selector .site-tab.active")?.dataset.site ?? "";

const renderSummary = (summary) => {
  if (!summaryRoot) return;
  const metrics = [
    ["group", summary.group_count],
    ["元KW保持", summary.source_retained_group_count],
    ["需要観測", summary.demand_observed_group_count],
    ["構造候補", summary.structure_candidate_group_count],
    ["title/heading", summary.generation_candidate_group_count],
    ["公開停止", summary.publication_blocked_group_count],
  ];
  summaryRoot.innerHTML = metrics
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${escapeHtml(label)}</span><strong>${yen.format(value ?? 0)}</strong><small>group</small></div>`,
    )
    .join("");
};

const renderRows = (rows) => {
  if (!rowsRoot || !emptyRoot) return;
  rowsRoot.innerHTML = rows
    .map((row) => {
      const source = row.stages?.source_keywords;
      const demand = row.stages?.demand;
      const generation = row.stages?.title_and_headings;
      const publication = row.stages?.publication;
      const title = row.structure_candidate?.title_candidate ?? "—";
      const blockers = row.readiness?.blocker_codes?.join(" / ") ?? "—";
      return `<tr>
        <td><strong>${escapeHtml(row.group_id)}</strong><small class="cell-note">${escapeHtml(row.main_keyword ?? row.display_keyword ?? "")}</small></td>
        <td>${stageLabel(source)}<small class="cell-note">取得済 ${yen.format(source?.acquired_count ?? 0)} · 未取得 ${yen.format(source?.unacquired_count ?? 0)}</small></td>
        <td>${stageLabel(demand)}<small class="cell-note">PAA/関連 ${yen.format(demand?.demand_count ?? 0)} / topic ${yen.format(demand?.topic_count ?? 0)}</small></td>
        <td><strong>${escapeHtml(title)}</strong><small class="cell-note">${yen.format(generation?.title_count ?? 0)}候補</small></td>
        <td>${yen.format(generation?.heading_count ?? 0)}候補<small class="cell-note">ready ${yen.format(generation?.ready_count ?? 0)} · review ${yen.format(generation?.needs_review_count ?? 0)}</small></td>
        <td>${escapeHtml(row.outline?.status ?? "未接続")}<small class="cell-note">${yen.format(row.outline?.selected_count ?? 0)}選定 / H2 ${yen.format(row.outline?.h2_count ?? 0)} / H3 ${yen.format(row.outline?.h3_count ?? 0)}</small></td>
        <td>${stageLabel(publication)}<small class="cell-note">${escapeHtml(blockers)}</small></td>
        <td><code>${escapeHtml((row.lineage_digest ?? "").slice(0, 12))}</code><small class="cell-note">自動割当0 · 自動反映0 · 自動公開0</small></td>
      </tr>`;
    })
    .join("");
  emptyRoot.hidden = rows.length > 0;
  emptyRoot.innerHTML = rows.length
    ? ""
    : "<strong>lineage対象がありません</strong><span>サイトまたは検索語を変更してください。未取得・未観測は候補ゼロと混同しません。</span>";
};

let requestSerial = 0;
const render = async () => {
  if (!summaryRoot || !rowsRoot) return;
  const siteId = currentSiteId();
  if (!siteId) return;
  const serial = ++requestSerial;
  const url = new URL("/api/v1/keyword-content-lineage", location.origin);
  url.searchParams.set("site_id", siteId);
  url.searchParams.set("limit", "100");
  if (search?.value.trim()) url.searchParams.set("q", search.value.trim());
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`lineage: ${response.status}`);
    const payload = await response.json();
    if (serial !== requestSerial) return;
    renderSummary(payload.summary ?? {});
    renderRows(payload.data ?? []);
  } catch (error) {
    if (serial !== requestSerial) return;
    summaryRoot.innerHTML = "";
    rowsRoot.innerHTML = "";
    emptyRoot.hidden = false;
    emptyRoot.innerHTML = `<strong>lineageを読み込めませんでした</strong><span>${escapeHtml(error.message)}</span>`;
  }
};

search?.addEventListener("input", render);
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
