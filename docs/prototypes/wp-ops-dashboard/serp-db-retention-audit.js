const metricsRoot = document.querySelector("#serp-db-retention-audit-summary");
const rowsRoot = document.querySelector("#serp-db-retention-audit-rows");
const emptyRoot = document.querySelector("#serp-db-retention-audit-empty");
const payloadTaskInput = document.querySelector("#raw-snapshot-payload-task-id");
const payloadLoadButton = document.querySelector("#raw-snapshot-payload-load");
const payloadOutput = document.querySelector("#raw-snapshot-payload-output");
const number = new Intl.NumberFormat("ja-JP");
const percent = new Intl.NumberFormat("ja-JP", {
  style: "percent",
  maximumFractionDigits: 1,
});
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character],
  );
const severityLabel = {
  dropped_nonempty: "非空値drop",
  state_only_dropped: "状態のみdrop",
  projection_gap: "投影gap",
  implicit_context_only: "文脈のみ",
  retained: "保持",
};
const retentionLabel = {
  exact_structured: "構造化保持",
  exact_json_column: "JSON列保持",
  exact_feature_payload: "feature payload保持",
  exact_inventory_projection: "inventory列保持",
  exact_raw_snapshot_payload: "raw payload保持",
  implicit_context: "文脈のみ",
  not_retained: "未保持",
  projection_gap: "投影gap",
  mixed: "混在",
};
const fetchRows = async (view) => {
  const rows = [];
  let cursor = "";
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      view,
      scope: "all",
      severity: "all",
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/v1/serp-db-retention?${params}`);
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error ?? `SERP DB retention audit: HTTP ${response.status}`);
    rows.push(...(payload.data ?? []));
    if (!payload.meta?.next_cursor) return { rows, payload };
    cursor = payload.meta.next_cursor;
  }
  throw new Error("SERP DB retention audit pagination exceeded the safety limit");
};
const loadPayload = async (taskId) => {
  const normalizedTaskId = String(taskId ?? "").trim();
  if (!normalizedTaskId) {
    payloadOutput.hidden = false;
    payloadOutput.textContent = "task IDを入力してください。";
    return;
  }
  payloadOutput.hidden = false;
  payloadOutput.textContent = "読み込み中…";
  try {
    const response = await fetch(
      `/api/v1/raw-snapshot?task_id=${encodeURIComponent(normalizedTaskId)}&view=payload`,
    );
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error ?? `raw snapshot: HTTP ${response.status}`);
    payloadOutput.textContent = JSON.stringify(payload.payload, null, 2);
  } catch (error) {
    payloadOutput.textContent = error.message;
  }
};
payloadLoadButton?.addEventListener("click", () => loadPayload(payloadTaskInput?.value));
rowsRoot?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-raw-task-id]");
  if (!button) return;
  const taskId = button.dataset.rawTaskId ?? "";
  if (payloadTaskInput) payloadTaskInput.value = taskId;
  loadPayload(taskId);
});
const render = async () => {
  if (!metricsRoot || !rowsRoot || !emptyRoot) return;
  metricsRoot.innerHTML =
    '<div class="metric"><span>raw→DB保持</span><strong>読込中</strong><small>—</small></div>';
  try {
    const summaryResponse = await fetchRows("summary");
    const fieldResponse = await fetchRows("fields");
    const summary = summaryResponse.payload.summary;
    const scopes = new Map(
      (summary.scope_summary ?? []).map((row) => [row.scope, row]),
    );
    const all = scopes.get("all") ?? {};
    const connected = scopes.get("connected") ?? {};
    const unconnected = scopes.get("unconnected") ?? {};
    metricsRoot.innerHTML = [
      ["raw非空観測", all.raw_nonempty_observation_count ?? 0, "件"],
      ["exact保持", all.exact_retained_observation_count ?? 0, "件"],
      ["非空値drop", all.not_retained_nonempty_observation_count ?? 0, "件"],
      ["connected非空drop", connected.not_retained_nonempty_observation_count ?? 0, "件"],
      ["unconnected非空drop", unconnected.not_retained_nonempty_observation_count ?? 0, "件"],
      ["drop field", summary.dropped_nonempty_field_count ?? 0, "field"],
      ["unconnected exact率", unconnected.exact_retention_ratio ?? 0, "率"],
    ]
      .map(
        ([label, value, unit]) =>
          `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(unit === "率" ? percent.format(value) : number.format(value))}</strong><small>${escapeHtml(unit)}</small></div>`,
      )
      .join("");
    const severityOrder = {
      dropped_nonempty: 0,
      projection_gap: 1,
      state_only_dropped: 2,
      implicit_context_only: 3,
      retained: 4,
    };
    const rows = fieldResponse.rows
      .slice()
      .sort(
        (left, right) =>
          (severityOrder[left.severity] ?? 9) - (severityOrder[right.severity] ?? 9) ||
          right.not_retained_nonempty_observation_count - left.not_retained_nonempty_observation_count ||
          left.scope.localeCompare(right.scope) ||
          left.field.localeCompare(right.field, "ja-JP"),
      );
    rowsRoot.innerHTML = rows
      .map((row) => {
        const taskId = row.example_task_ids?.[0] ?? "";
        return `<tr><td><strong>${escapeHtml(row.scope)}</strong></td><td>${escapeHtml(row.field)}</td><td>${escapeHtml(severityLabel[row.severity] ?? row.severity)}<small class="cell-note">${escapeHtml(retentionLabel[row.retention_state] ?? row.retention_state)}</small></td><td>${escapeHtml(number.format(row.raw_nonempty_observation_count ?? 0))}</td><td>${escapeHtml(number.format(row.not_retained_nonempty_observation_count ?? 0))}</td><td>${escapeHtml(number.format(row.not_retained_observation_count ?? 0))}</td><td>${escapeHtml((row.source_tables ?? []).join(", "))}</td><td>${taskId ? `<button type="button" class="detail-button raw-payload-task" data-raw-task-id="${escapeHtml(taskId)}" title="verbatim payloadを表示">${escapeHtml(taskId.slice(0, 12))}…</button>` : "—"}</td></tr>`;
      })
      .join("");
    emptyRoot.hidden = rows.length > 0;
    emptyRoot.innerHTML = rows.length
      ? ""
      : "<strong>DB保持差分はありません</strong><span>観測rawとSQLite投影の差分監査結果が空です。</span>";
  } catch (error) {
    metricsRoot.innerHTML = "";
    rowsRoot.innerHTML = "";
    emptyRoot.hidden = false;
    emptyRoot.innerHTML = `<strong>raw→DB保持監査を読み込めませんでした</strong><span>${escapeHtml(error.message)}</span>`;
  }
};
render();
