const root = document.querySelector("#capability-audit");

if (root) {
  const search = document.querySelector("#capability-audit-search"),
    statusFilter = document.querySelector("#capability-audit-status"),
    blockerFilter = document.querySelector("#capability-audit-blocker"),
    viewFilter = document.querySelector("#capability-audit-view"),
    metrics = document.querySelector("#capability-audit-metrics"),
    message = document.querySelector("#capability-audit-status-message"),
    head = document.querySelector("#capability-audit-head"),
    rowsRoot = document.querySelector("#capability-audit-rows"),
    empty = document.querySelector("#capability-audit-empty"),
    number = new Intl.NumberFormat("ja-JP"),
    escapeHtml = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (character) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
          character
        ],
      ),
    label = (value) =>
      ({
        proven_complete: "完成証明済み",
        incomplete: "未完成・未証明",
        implemented: "実装済み",
        partial: "部分実装",
        planned: "計画のみ",
        blocked_by_license: "ライセンスblock",
        intentionally_out_of_scope: "対象外",
        integrity_verified_execution_not_attested: "証拠整合・実行未attest",
        artifact_integrity_and_execution_attested: "証拠整合・実行attest済み",
        execution_attestation_missing_or_stale: "実行attest不足・古い",
        corpus_or_acquisition_depth: "corpus / 取得深度",
        external_provider_or_account_data: "外部provider / account",
        generation_runtime_or_quality_oracle: "生成runtime / quality",
        contract_or_auth_parity: "契約 / auth parity",
      })[value] ?? value ?? "—";

  const renderMetrics = (payload) => {
    const summary =
        payload.view === "credits"
          ? payload.public_contract_credits ?? payload.summary ?? {}
          : payload.summary ?? {},
      values =
        payload.view === "credits"
          ? [
              ["API operation", summary.operation_count ?? 0],
              ["固定credit", summary.credit_contract_count ?? 0],
              ["動的credit", summary.dynamic_credit_contract_count ?? 0],
              ["無料", summary.zero_credit_operation_count ?? 0],
              ["未分類", summary.unclassified_operation_count ?? 0],
              ["有料実行", summary.paid_request_executed ? "あり" : "なし"],
            ]
          : [
              ["全機能", summary.capability_count ?? 0],
              ["完成証明", summary.proven_complete_count ?? 0],
              ["未完成", summary.incomplete_count ?? 0],
              ["証拠整合", summary.evidence_integrity_pass_count ?? 0],
              ["証拠異常", summary.evidence_integrity_failure_count ?? 0],
              ["実行証跡", summary.execution_attested_capability_count ?? 0],
            ];
    metrics.innerHTML = values
      .map(
        ([name, value]) =>
          `<div class="metric"><span>${escapeHtml(name)}</span><strong>${escapeHtml(
            typeof value === "number" ? number.format(value) : value,
          )}</strong><small>件</small></div>`,
      )
      .join("");
  };

  const renderTable = (payload) => {
    const view = payload.view,
      rows = payload.data ?? [];
    if (view === "integrity") {
      head.innerHTML =
        "<tr><th>機能</th><th>完成状態</th><th>証拠状態</th><th>artifact</th><th>command</th><th>digest</th></tr>";
      rowsRoot.innerHTML = rows
        .map(
          (row) =>
            `<tr><td><strong>${escapeHtml(row.name)}</strong><small class="cell-note">${escapeHtml(
              row.capability_id,
            )}</small></td><td>${escapeHtml(label(row.parity_status))}</td><td>${escapeHtml(
              label(row.evidence_integrity?.state),
            )}<small class="cell-note">実行attest ${
              row.evidence_integrity?.execution_attested ? "あり" : "なし"
            }</small></td><td>${number.format(
              row.evidence_integrity?.artifact_count ?? 0,
            )}<small class="cell-note">missing ${
              row.evidence_integrity?.missing_artifact_count ?? 0
            }</small></td><td>${number.format(
              row.evidence_integrity?.verification_command_count ?? 0,
            )}<small class="cell-note">unresolved ${
              row.evidence_integrity?.unresolved_command_count ?? 0
            }</small></td><td><code>${escapeHtml(
              row.evidence_digest?.slice(0, 12),
            )}</code></td></tr>`,
        )
        .join("");
      return;
    }
    if (view === "credits") {
      head.innerHTML =
        "<tr><th>機能</th><th>operation</th><th>credit</th><th>契約種別</th><th>inventory</th><th>証跡</th></tr>";
      rowsRoot.innerHTML = rows
        .map(
          (row) =>
            `<tr><td><strong>${escapeHtml(row.capability_id)}</strong></td><td>${escapeHtml(
              row.operation ?? row.operation_id,
            )}</td><td>${escapeHtml(row.credits ?? row.credit ?? row.amount ?? "—")}</td><td>${escapeHtml(
              row.contract_kind ?? "—",
            )}</td><td>${escapeHtml(row.inventory_credits ?? "—")}</td><td><code>${escapeHtml(
              row.operation_id ?? row.capability_id,
            )}</code></td></tr>`,
        )
        .join("");
      return;
    }
    head.innerHTML =
      "<tr><th>機能</th><th>完成判定</th><th>HELIX状態</th><th>blocker</th><th>残存gap</th><th>証拠</th><th>digest</th></tr>";
    rowsRoot.innerHTML = rows
      .map(
        (row) =>
          `<tr><td><strong>${escapeHtml(row.name)}</strong><small class="cell-note">${escapeHtml(
            row.capability_id,
          )}</small></td><td>${escapeHtml(label(row.parity_status))}<small class="cell-note">${escapeHtml(
            label(row.completion_evidence_state),
          )}</small></td><td>${escapeHtml(label(row.helix_status))}</td><td>${
            row.blocker_classes?.map((item) => escapeHtml(label(item))).join(" / ") ||
            "なし"
          }</td><td><span class="cell-note" title="${escapeHtml(row.remaining_gap)}">${escapeHtml(
            row.remaining_gap,
          )}</span></td><td>${number.format(
            row.authoritative_evidence?.length ?? 0,
          )} artifact<small class="cell-note">command ${number.format(
            row.verification_commands?.length ?? 0,
          )} · ${escapeHtml(row.evidence_integrity?.state)}</small></td><td><code>${escapeHtml(
            row.evidence_digest?.slice(0, 12),
          )}</code></td></tr>`,
      )
      .join("");
  };

  const load = async () => {
    message.textContent = "全機能の証拠境界を読み込み中…";
    message.classList.remove("error");
    const url = new URL("/api/v1/capability-audit", location.origin);
    url.searchParams.set("view", viewFilter.value);
    url.searchParams.set("q", search.value.trim());
    url.searchParams.set("status", statusFilter.value);
    url.searchParams.set("blocker", blockerFilter.value);
    url.searchParams.set("limit", "100");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`/api/v1/capability-audit: ${response.status}`);
      const payload = await response.json();
      renderMetrics(payload);
      renderTable(payload);
      empty.hidden = (payload.data ?? []).length > 0;
      empty.innerHTML = payload.data?.length
        ? ""
        : "<strong>一致する監査対象がありません</strong><span>filterを変更してください。</span>";
      message.textContent = `completion claim: ${payload.completion_claim ?? "not_proven"} · audit ${String(
        payload.audit_digest ?? "",
      ).slice(0, 12)} · 外部取得0 · model実行0 · 有料実行0`;
    } catch (error) {
      rowsRoot.innerHTML = "";
      empty.hidden = false;
      empty.innerHTML = `<strong>監査を読み込めませんでした</strong><span>${escapeHtml(
        error.message,
      )}</span>`;
      message.textContent = error.message;
      message.classList.add("error");
    }
  };

  let timer;
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(load, 180);
  });
  [statusFilter, blockerFilter, viewFilter].forEach((control) =>
    control.addEventListener("change", load),
  );
  load();
}
