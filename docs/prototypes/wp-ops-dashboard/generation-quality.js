const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ],
  );
const yen = new Intl.NumberFormat("ja-JP");

async function renderGenerationQuality() {
  const metrics = document.querySelector("#generation-quality-metrics");
  const table = document.querySelector("#generation-quality-rows");
  if (!metrics || !table) return;
  try {
    const sitesResponse = await fetch("/api/v1/sites");
    if (!sitesResponse.ok) throw new Error(`/api/v1/sites: ${sitesResponse.status}`);
    const sitesPayload = await sitesResponse.json();
    const requestedSite = new URLSearchParams(location.search).get("site");
    const activeSite = document.querySelector(".site-tab.active")?.dataset.site;
    const siteId =
      (sitesPayload.data ?? []).find((site) => site.site_id === requestedSite)?.site_id ??
      activeSite ??
      sitesPayload.data?.[0]?.site_id;
    if (!siteId) throw new Error("site_id is unavailable");
    const response = await fetch(
      `/api/v1/generation-quality-oracle?site_id=${encodeURIComponent(siteId)}&limit=100`,
    );
    if (!response.ok) throw new Error(`/api/v1/generation-quality-oracle: ${response.status}`);
    const payload = await response.json();
    const summary = payload.summary ?? {};
    metrics.innerHTML = [
      ["候補", summary.candidate_count ?? 0],
      ["決定論block", summary.blocked_deterministic_gate_count ?? 0],
      ["編集review", summary.editor_review_required_count ?? 0],
      ["証拠解決", summary.evidence_reference_resolved_count ?? 0],
      ["task独立", summary.task_independent_count ?? 0],
      ["時間独立", summary.temporal_independent_count ?? 0],
      ["人手品質", summary.human_quality_proven ? "証明" : "未証明"],
    ]
      .map(
        ([label, value]) =>
          `<div class="metric"><span>${label}</span><strong>${typeof value === "number" ? yen.format(value) : escapeHtml(value)}</strong>${typeof value === "number" ? "<small>件</small>" : ""}</div>`,
      )
      .join("");
    table.innerHTML = (payload.data ?? [])
      .map((row) => {
        const review = row.deterministic_review ?? {};
        return `<tr><td><strong>${escapeHtml(row.text || "(text unavailable)")}</strong><small class="cell-note"><code>${escapeHtml(row.candidate_id)}</code> · ${escapeHtml(row.group_id)}</small></td><td>${escapeHtml(row.content_type)}${row.heading_level ? `<small class="cell-note">H${row.heading_level}</small>` : ""}</td><td><strong>${escapeHtml(row.review_state)}</strong></td><td>${escapeHtml(review.state)}<small class="cell-note">score ${review.quality_score ?? "—"} · evidence ${review.evidence_reference_resolved ? "解決" : "未解決"}</small></td><td>${escapeHtml(row.demand_stability?.state)} / ${escapeHtml(row.competitive_stability?.state)}</td><td>${escapeHtml(row.task_holdout?.state)}<small class="cell-note">時間 ${escapeHtml(row.temporal_holdout?.state)}</small></td><td>${(row.blocking_reasons ?? []).map(escapeHtml).join(" / ") || "なし"}</td><td><code>${escapeHtml((row.quality_digest ?? "").slice(0, 12))}</code></td></tr>`;
      })
      .join("");
  } catch (error) {
    metrics.innerHTML = `<div class="notice error">生成品質oracleを読み込めませんでした: ${escapeHtml(error.message)}</div>`;
    table.innerHTML = "";
  }
}

renderGenerationQuality();
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-site]")) setTimeout(renderGenerationQuality, 0);
});
