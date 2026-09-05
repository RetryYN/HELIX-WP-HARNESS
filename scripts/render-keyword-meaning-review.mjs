const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=values=>`<ul>${values.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`;

export function renderKeywordMeaningReview({packets,story}){
  const nodes=new Map(story.interpretations.map(n=>[n.id,n]));
  const sources=new Map(packets.map(p=>[p.task_id,p]));
  const clusters=new Map(story.problem_clusters.map(p=>[p.id,p]));
  const target=id=>`#${encodeURIComponent(id)}`;
  const cards=story.problem_clusters.map(p=>{
    const transitions=story.story_transitions.filter(t=>t.from_problem===p.id);
    const interpretations=p.interpretation_ids.map(id=>{
      const n=nodes.get(id),packet=sources.get(n.task_id);
      const evidence=n.evidence_ids.map(id=>{
        const d=packet.demand_observations.find(d=>d.evidence_id===id);
        const h=(packet.benchmark_heading_evidence??[]).find(h=>h.evidence_id===id);
        return d?`${d.kind}：${d.text}（観測 ${d.observed_at??'不明'}）`:h?`上位記事：ページ ${h.page_id}／見出し位置 ${h.position}／原本 ${h.snapshot_digest}`:id;
      });
      return `<details><summary>${esc(packet.keyword)} — ${esc(n.trigger)}</summary><dl>${[['読者',n.reader],['既知事項',n.prior_knowledge],['障壁',n.barrier],['到達状態',n.desired_outcome],['解釈理由',n.rationale]].map(([label,value])=>`<dt>${label}</dt><dd>${esc(value)}</dd>`).join('')}</dl><h4>観測根拠</h4>${list(evidence)}<h4>代替解釈</h4>${list(n.alternative_interpretations)}<h4>未確認</h4>${list(n.unknowns)}</details>`;
    }).join('');
    const merge=story.relations.filter(r=>r.kind==='same_problem'&&p.interpretation_ids.includes(r.from)&&p.interpretation_ids.includes(r.to));
    return `<section id="${esc(p.id)}"><h2>${esc(p.problem)}</h2><p>読者：${esc(p.reader)}</p><p>回答範囲：${esc(p.answer_scope)}</p>${interpretations}${merge.length?`<h3>統合理由</h3>${list(merge.map(r=>`${r.rationale}／共通の回答：${r.shared_answer}`))}`:''}<h3>解決後に生まれる疑問</h3>${transitions.length?transitions.map(t=>`<div class="transition"><p>条件：${esc(t.resolved_before_transition)}</p><p>次の疑問：${esc(t.next_question)}</p><a href="${target(t.to_problem)}">→ ${esc(clusters.get(t.to_problem).problem)}</a><p class="note">推論理由：${esc(t.rationale)}</p></div>`).join(''):'<p class="note">次の遷移は未設定。ここで読者の行動が終わると確認したわけではありません。</p>'}</section>`;
  }).join('');
  const separate=story.relations.filter(r=>['separate','unresolved','alternative'].includes(r.kind));
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>キーワードの意味・統合・遷移</title><style>body{font:16px/1.7 system-ui,sans-serif;background:#f5f7fb;color:#182332;margin:0}header,main{max-width:1080px;margin:auto;padding:24px}section{background:white;border:1px solid #cbd5e1;border-radius:12px;padding:24px;margin:24px 0;scroll-margin-top:12px}h1{font-size:1.7rem}h2{font-size:1.3rem}h3{font-size:1.1rem}a{color:#174ea6}details{padding:12px;border-top:1px solid #ddd}summary{cursor:pointer;font-weight:600}dt{font-weight:600}dd{margin:0 0 10px}.transition{border-left:4px solid #557cc5;padding:4px 16px;margin:12px 0}.note{color:#526174}.warning{background:#fff0c2;padding:16px}p,li,dd,summary,a{overflow-wrap:anywhere}@media(max-width:600px){header,main{padding:12px}section{padding:16px}}</style><header><h1>キーワードの意味・統合・遷移</h1><p class="warning">${packets.length}検索タスクの試行。意味解釈は編集仮説で、独立評価・実際のユーザー遷移・順位効果は未検証です。</p><p>${story.interpretations.length}解釈／${story.problem_clusters.length}課題候補／${story.story_transitions.length}遷移。課題数は記事本数ではありません。</p><nav aria-label="課題一覧">${list([])}${story.problem_clusters.map(p=>`<p><a href="${target(p.id)}">${esc(p.problem)}</a></p>`).join('')}</nav></header><main>${cards}<section><h2>統合しない・判断を保留した関係</h2>${list(separate.map(r=>`${nodes.get(r.from).problem} ↔ ${nodes.get(r.to).problem} [${r.kind}]：${r.rationale}`))}</section></main></html>`;
}
