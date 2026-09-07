import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const badge = (value) => `<span class="badge ${escape(value)}">${escape(value)}</span>`;
const percent = (value) => value == null ? '—' : `${Number(value).toFixed(2)}%`;
const list = (rows, render) => rows?.length ? `<ul>${rows.map((row) => `<li>${render(row)}</li>`).join('')}</ul>` : '<span class="muted">なし</span>';

export function renderTwoSidedSemanticReview(review, verification, context = {}) {
  assert.equal(review.schema_version, 'two-sided-semantic-review-aggregate.v1');
  assert.equal(verification.schema_version, 'two-sided-semantic-review-verification.v1');
  const reviewByCandidate = new Map(review.candidates.map((row) => [row.article_candidate_id, row]));
  const ledgerByCandidate = new Map((context.ledger?.candidates ?? []).map((row) => [row.article_candidate_id, row]));
  const headingByCandidate = new Map((context.headingSource?.candidates ?? []).map((row) => [row.article_candidate_id, row]));
  assert.equal(reviewByCandidate.size, review.candidates.length, 'duplicate review candidate');
  assert.deepEqual(new Set(verification.candidates.map((row) => row.article_candidate_id)), new Set(reviewByCandidate.keys()), 'review and verification candidates differ');
  const rows = [...verification.candidates].sort((left, right) => right.conjunction_percent - left.conjunction_percent || right.page_keyword_agreement_percent - left.page_keyword_agreement_percent || left.article_candidate_id.localeCompare(right.article_candidate_id)).map((metric) => {
    const candidate = reviewByCandidate.get(metric.article_candidate_id);
    const demandText = new Map((ledgerByCandidate.get(metric.article_candidate_id)?.target_demands ?? []).map((row) => [row.evidence_id, row.text]));
    const headingText = new Map((headingByCandidate.get(metric.article_candidate_id)?.heading_reviews ?? []).map((row) => [row.position, row.text]));
    const details = `<details><summary>${escape(metric.article_candidate_id)} ${badge(metric.verdict)} — AND ${percent(metric.conjunction_percent)}</summary>
      <div class="metrics"><span>需要核 ${metric.demand_units}</span><span>編集要件 ${metric.editorial_requirements}</span><span>獲得語一致 ${percent(metric.page_keyword_agreement_percent)}</span><span>見出し一致 ${percent(metric.heading_alignment_percent)}</span><span>拒否誤統合 ${metric.rejected_false_merge_count}</span></div>
      <h3>意味単位</h3>${list(candidate.unit_reviews, (unit) => `${badge(unit.layer)} <b>${escape(unit.demand_core ?? unit.unit_id)}</b><br>${escape(unit.rationale)}${unit.editorial_requirements?.length ? `<br><span class="muted">編集要件: ${escape(unit.editorial_requirements.join(' / '))}</span>` : ''}`)}
      <h3>target需要の処遇</h3>${list(candidate.target_demand_reviews, (row) => `${badge(row.disposition)} <b>${escape(demandText.get(row.evidence_id) ?? row.evidence_id)}</b> — ${escape(row.rationale)}`)}
      <h3>1位ページ獲得語</h3>${list(candidate.acquired_keyword_reviews, (row) => `${badge(row.relation)} <b>${escape(row.text)}</b> — ${escape(row.rationale)}`)}
      <h3>見出し照合</h3>${list(candidate.heading_reviews, (row) => `${badge(row.classification)} #${escape(row.position)} <b>${escape(headingText.get(row.position) ?? '')}</b> — ${escape(row.rationale)}`)}
      <h3>遷移仮説</h3>${list(candidate.transitions, (row) => `${escape(row.from_unit_id)} → ${escape(row.to_unit_id)} ${badge(row.state)} — ${escape(row.rationale)}`)}
      <h3>拒否・未解決の誤統合</h3>${list(candidate.false_merges, (row) => `${badge(row.kind)} ${escape(row.unit_id)} — ${escape(row.rationale)}`)}
    </details>`;
    return `<section data-verdict="${escape(metric.verdict)}" data-id="${escape(metric.article_candidate_id.toLowerCase())}">${details}</section>`;
  }).join('');
  const summary = verification.summary;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>二側キーワード意味照合</title><style>
  :root{color-scheme:dark;background:#101216;color:#e8edf2;font:14px/1.55 system-ui,sans-serif}body{margin:0}header{position:sticky;top:0;background:#161a20;padding:16px 22px;border-bottom:1px solid #333;z-index:2}h1{margin:0 0 10px;font-size:20px}.cards,.metrics{display:flex;gap:8px;flex-wrap:wrap}.cards span,.metrics span,.badge{border:1px solid #3b4654;border-radius:999px;padding:3px 9px}.PASS,.common,.supported,.demand{color:#8ee6aa;border-color:#347647}.FAIL,.unresolved,.gap,.other_intent{color:#ff9a9a;border-color:#8a3f3f}.partial,.mixed,.hold{color:#ffd27e;border-color:#806329}.editorial,.internal_link,.separate_article,.context_only,.page_only{color:#9fc8ff;border-color:#385f8d}main{max-width:1240px;margin:auto;padding:18px}input,select{background:#0d0f12;color:#fff;border:1px solid #444;border-radius:6px;padding:8px;margin:8px 6px 0 0}section{border:1px solid #303640;border-radius:8px;margin:10px 0;background:#171b21}summary{cursor:pointer;padding:13px;font-weight:650}details>div,details>h3,details>ul{margin-left:18px;margin-right:18px}h3{font-size:14px;margin-bottom:4px}ul{margin-top:4px;padding-left:20px}li{margin:5px 0}.muted{color:#99a3ad}[hidden]{display:none}</style></head><body>
  <header><h1>二側キーワード意味照合</h1><div class="cards"><span>レビュー ${summary.reviewed_candidates}/${summary.total_candidates} (${percent(summary.review_coverage_percent)})</span><span>未観測 ${summary.unobserved_candidates}</span><span>全体PASS ${summary.passed_candidates}/${summary.total_candidates} (${percent(summary.candidate_pass_percent)})</span><span>需要核 ${summary.demand_units}</span><span>編集要件 ${summary.editorial_requirements}</span><span>target需要 ${summary.target_demand_rows}</span><span>獲得語 ${summary.acquired_keywords}</span><span>見出し ${summary.headings}</span><span>拒否誤統合 ${summary.rejected_false_merges}</span><span>未解決誤統合 ${summary.unresolved_false_merges}</span></div><input id="q" placeholder="候補IDを検索"><select id="v"><option value="">すべて</option><option>PASS</option><option>FAIL</option></select></header>
  <main>${rows}<p class="muted">PASSは順位保証・公開承認ではありません。遷移は観測された行動ではなく編集仮説です。canonical query未観測候補は未完了のままです。</p></main>
  <script>const q=document.querySelector('#q'),v=document.querySelector('#v');function filter(){for(const row of document.querySelectorAll('main section'))row.hidden=!(row.dataset.id.includes(q.value.toLowerCase())&&(!v.value||row.dataset.verdict===v.value))}q.addEventListener('input',filter);v.addEventListener('change',filter);</script></body></html>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [ledgerPath, headingPath, reviewPath, verificationPath, outputPath] = process.argv.slice(2);
  if (!outputPath) throw new Error('usage: node scripts/render-two-sided-semantic-review.mjs LEDGER HEADINGS REVIEW VERIFICATION OUTPUT');
  fs.writeFileSync(outputPath, renderTwoSidedSemanticReview(JSON.parse(fs.readFileSync(reviewPath, 'utf8')), JSON.parse(fs.readFileSync(verificationPath, 'utf8')), { ledger: JSON.parse(fs.readFileSync(ledgerPath, 'utf8')), headingSource: JSON.parse(fs.readFileSync(headingPath, 'utf8')) }));
}
