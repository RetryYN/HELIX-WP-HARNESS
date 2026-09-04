import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const labels = { same_article: "同じ記事", separate_articles: "別記事", related_only: "関連のみ", insufficient_evidence: "判断保留" };
const safeUrl = (value) => {
  try { const u = new URL(value); return ["http:", "https:"].includes(u.protocol) ? u.href : null; } catch { return null; }
};

export function renderBlindSemanticReview(packet) {
  if (packet.schema_version !== "blind-semantic-evaluation.v1" || packet.review_mode !== "predictions_withheld" || !Array.isArray(packet.cases)) throw new Error("A blinded review packet is required");
  if (packet.cases.some((row) => row.classifier_prediction || row.annotation?.label)) throw new Error("First-pass packet must not contain predictions or prior labels");
  const evidence = (side) => `<h3>${escape(side.keyword)}</h3><p>観測: ${escape(side.observed_at)}</p><ol>${(side.results ?? []).map((r) => {
    const url = safeUrl(r.url);
    return `<li>${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escape(r.title || r.url)}</a>` : escape(r.title)}<small>${escape(r.url)}</small></li>`;
  }).join("")}</ol>`;
  // Retain only the fields required by the form: no raw evidence in executable JS.
  const metadata = JSON.stringify({ dataset_digest: packet.dataset_digest, source_dataset_digest: packet.source_dataset_digest, case_ids: packet.cases.map((row) => row.case_id) }).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'">
<title>検索意図・記事境界の初回レビュー</title><style>body{font:16px system-ui;margin:24px;line-height:1.6;background:#f5f7fa;color:#18212f}header,article{background:white;padding:20px;margin-bottom:20px;border:1px solid #ccd3dd;border-radius:8px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}small{display:block;overflow-wrap:anywhere;color:#596577}label{display:block;margin:12px 0}textarea{display:block;box-sizing:border-box;width:100%;min-height:80px}input,select,button{font:inherit;padding:8px}button{cursor:pointer}@media(max-width:700px){.columns{grid-template-columns:1fr}}</style>
<header><h1>検索意図・記事境界の初回レビュー</h1><p>自動判定は非表示です。語義・対象読者・目的・範囲・記事形式を比較してください。共通URLだけで統合を決めず、証拠不足なら判断保留にします。</p><p>この画面からの自動通信はありません。リンクを押した場合のみ対象サイトを開きます。入力は自動保存されません。閉じる前にJSONを保存してください。保存内容は正解・精度証明として自動認定されません。</p><label>レビュアー識別子（氏名不要）<input id="reviewer" autocomplete="off"></label><button id="save" type="button">入力済みレビューをJSON保存</button><p id="status" role="status"></p></header>
${packet.cases.map((row, i) => `<article data-case="${i}"><h2>比較 ${i + 1}</h2><small>${escape(row.case_id)}</small><div class="columns"><section>${evidence(row.left)}</section><section>${evidence(row.right)}</section></div><p>識別可能なURLの完全一致: ${escape(row.result_comparison?.shared_urls?.length ?? "未集計")}件。伏せ字URLは比較対象外（左 ${escape(row.result_comparison?.left_redacted_url_count ?? "未集計")}件・右 ${escape(row.result_comparison?.right_redacted_url_count ?? "未集計")}件）。意味同一性・統合妥当性は未検証。</p><label>判断<select data-label><option value="">未判断</option>${Object.entries(labels).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></label><label>理由（対象・目的・範囲の差を含める）<textarea data-rationale></textarea></label><label>根拠URL（1行1件。判断保留は空欄可）<textarea data-evidence></textarea></label></article>`).join("")}
<script>
const metadata=${metadata};
document.querySelector('#save').addEventListener('click',()=>{
 const status=document.querySelector('#status');
 try {
  const reviewer=document.querySelector('#reviewer').value.trim();
  if(!reviewer)throw Error('レビュアー識別子を入力してください');
  const annotations=[];
  for(const article of document.querySelectorAll('[data-case]')){
   const label=article.querySelector('[data-label]').value;
   const rationale=article.querySelector('[data-rationale]').value.trim();
   const evidence_urls=article.querySelector('[data-evidence]').value.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);
   if(!label){if(rationale||evidence_urls.length)throw Error('入力途中の比較で判断を選んでください');continue;}
   if(!rationale)throw Error('判断した比較には理由が必要です');
   if(label!=='insufficient_evidence'&&!evidence_urls.length)throw Error('判断の根拠URLが必要です');
   for(const value of evidence_urls){let u;try{u=new URL(value)}catch{throw Error('根拠URLを確認してください')}if(!['http:','https:'].includes(u.protocol))throw Error('根拠URLはHTTP(S)にしてください');}
   annotations.push({case_id:metadata.case_ids[Number(article.dataset.case)],label,rationale,evidence_urls,reviewer,reviewed_at:new Date().toISOString()});
  }
  if(!annotations.length)throw Error('判断済みの比較がありません');
  const output={schema_version:'semantic-first-pass-annotations.v1',source_packet_digest:metadata.dataset_digest,source_dataset_digest:metadata.source_dataset_digest,review_state:'pending_independent_validation',gold_labels:false,accuracy_claim:'not_evaluated',total_case_count:metadata.case_ids.length,annotated_case_count:annotations.length,annotations};
  const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='semantic-first-pass-annotations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent=annotations.length+'件を保存しました。未判断は保存対象外です。';
 }catch(error){status.textContent=error.message;}
});
</script></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) throw new Error("Usage: export-command | node scripts/render-blind-semantic-review.mjs OUTPUT.html");
  const packet = JSON.parse(readFileSync(0, "utf8"));
  writeFileSync(process.argv[2], renderBlindSemanticReview(packet), { flag: "wx" });
  console.log(`Review HTML created: ${packet.cases.length} cases; no acquisition or model execution`);
}
