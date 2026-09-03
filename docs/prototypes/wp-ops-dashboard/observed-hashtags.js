const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const labels = {
  social_or_topic_observed: "話題・媒体タグ",
  job_attribute_marker_observed: "求人条件タグ",
  ambiguous_marker_review: "要分類レビュー",
  serp_title: "SERPタイトル",
  serp_description: "SERP説明文",
  serp_pre_snippet: "SERP pre-snippet",
  competitor_heading: "取得済み見出し",
};
const search = document.querySelector("#observed-hashtag-search");
const classification = document.querySelector("#observed-hashtag-classification");
const source = document.querySelector("#observed-hashtag-source");
let requestId = 0;

async function renderObservedHashtags() {
  const siteId = document.querySelector("#site-selector .site-tab.active")?.dataset.site;
  if (!siteId) return;
  const currentRequest = ++requestId;
  const url = new URL("/api/v1/observed-hashtags", location.origin);
  url.searchParams.set("site_id", siteId);
  url.searchParams.set("limit", "100");
  if (search.value.trim()) url.searchParams.set("q", search.value.trim());
  if (classification.value !== "all") url.searchParams.set("classification", classification.value);
  if (source.value !== "all") url.searchParams.set("source", source.value);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`/api/v1/observed-hashtags: ${response.status}`);
  const payload = await response.json();
  if (currentRequest !== requestId) return;
  const summary = payload.summary ?? {};
  document.querySelector("#observed-hashtag-metrics").innerHTML = [
    ["観測タグ", summary.hashtag_count ?? 0],
    ["出現", summary.occurrence_count ?? 0],
    ["話題・媒体", summary.social_or_topic_count ?? 0],
    ["求人条件", summary.job_attribute_count ?? 0],
    ["分類レビュー", summary.ambiguous_review_count ?? 0],
    ["外部SNSデータ", summary.external_social_dataset_count ?? 0],
  ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong><small>件</small></div>`).join("");
  document.querySelector("#observed-hashtag-rows").innerHTML = payload.data.map((row) => `<tr>
    <td><strong>${escapeHtml(row.hashtag)}</strong><small class="cell-note">${escapeHtml(row.normalized_tag)}</small></td>
    <td>${escapeHtml(labels[row.classification] ?? row.classification)}<small class="cell-note">編集レビュー必須</small></td>
    <td>${row.occurrence_count}<small class="cell-note">人気・検索量ではない</small></td>
    <td>${row.source_kinds.map((kind) => escapeHtml(labels[kind] ?? kind)).join("<br>")}</td>
    <td>${row.group_ids.length}<small class="cell-note">${row.task_ids.length} task</small></td>
    <td>${row.urls.slice(0, 2).map((item) => `<a href="${escapeHtml(item)}" target="_blank" rel="noreferrer">${escapeHtml(item)}</a>`).join("<br>")}</td>
    <td><code>${escapeHtml(row.evidence_digest.slice(0, 12))}</code><small class="cell-note">自動利用なし</small></td>
  </tr>`).join("");
  const empty = document.querySelector("#observed-hashtag-empty");
  empty.hidden = payload.data.length > 0;
  empty.innerHTML = payload.data.length ? "" : "<strong>該当する観測証拠がありません</strong><span>保持SERP・取得済み見出しに記号付き語がない状態です。外部SNSデータがないことを、タグが存在しない証明にはしません。</span>";
}

for (const control of [search, classification, source]) control.addEventListener(control === search ? "input" : "change", () => renderObservedHashtags().catch(console.error));
document.addEventListener("click", (event) => {
  if (event.target.closest(".site-tab") || event.target.closest('[data-view="observed-hashtags"]')) queueMicrotask(() => renderObservedHashtags().catch(console.error));
});
new MutationObserver(() => renderObservedHashtags().catch(console.error)).observe(document.querySelector("#site-selector"), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
renderObservedHashtags().catch(console.error);
