const data = await fetch("data.json").then((response) => {
  if (!response.ok) throw new Error(`data.json: ${response.status}`);
  return response.json();
});
const yen = new Intl.NumberFormat("ja-JP");
document.querySelector("#freshness").textContent = `DFS実測 · ${new Date(data.generated_at).toLocaleString("ja-JP")}`;

const metricLabels = {solobiz_unique_keywords:"solobiz KW",it_map_unique_keywords:"ITマップ KW",competitor_unique_keywords:"競合獲得 KW",wp_articles_assigned:"記事ID割当"};
document.querySelector("#metrics").innerHTML = Object.entries(data.metrics).map(([key,value])=>`<div class="metric"><span>${metricLabels[key]}</span><strong>${yen.format(value)}</strong><small>件</small></div>`).join("");

document.querySelectorAll(".tab").forEach((tab)=>tab.addEventListener("click",()=>{
  document.querySelectorAll(".tab,.view").forEach((node)=>node.classList.remove("active"));
  tab.classList.add("active"); document.querySelector(`#${tab.dataset.view}`).classList.add("active");
}));

const rowsRoot = document.querySelector("#keyword-rows");
const detail = document.querySelector("#group-detail");
const filters={search:document.querySelector("#keyword-search"),category:document.querySelector("#category-filter"),parent:document.querySelector("#parent-filter"),confidence:document.querySelector("#confidence-filter"),state:document.querySelector("#state-filter")};
function label(group){return group.main_keyword ?? group.sibling_keywords.join(" ／ ")}
function renderDetail(group){
  const keywords=group.intent_keywords.length?group.intent_keywords:group.sibling_keywords;
  detail.innerHTML=`<span class="badge ${group.confidence}">${group.confidence.toUpperCase()}</span><h2>${label(group)}</h2><p class="detail-label">${group.main_origin}</p><div class="detail-block"><div class="detail-label">内包・関連キーワード</div><div class="chips">${keywords.map((kw)=>`<span class="chip">${kw}</span>`).join("")}</div></div><div class="detail-block"><div class="detail-row"><span>SERP一致</span><strong>${group.overlap.shared}/${group.overlap.depth} · ${Math.round(group.overlap.ratio*100)}%</strong></div><div class="detail-row"><span>施策状態</span><strong>${group.state}</strong></div><div class="detail-row"><span>WP記事ID</span><strong>${group.wp_article_id??"未割当"}</strong></div><div class="detail-row"><span>DFS費用</span><strong>$${group.cost.toFixed(4)}</strong></div></div><div class="detail-block"><div class="detail-label">共通URL</div>${group.shared_urls.length?`<ul class="url-list">${group.shared_urls.map((url)=>`<li title="${url}">${url}</li>`).join("")}</ul>`:"<p class='detail-row'>URL詳細はraw snapshot参照</p>"}</div><div class="detail-block"><div class="detail-label">Task ID</div>${group.task_ids.map((id)=>`<div class="detail-row"><code>${id}</code></div>`).join("")}</div>`;
}
const keywordRows=data.groups.flatMap((group)=>group.main_keyword?[{keyword:group.main_keyword,parent:group.main_keyword,relation:"parent",group},...group.intent_keywords.map((keyword)=>({keyword,parent:group.main_keyword,relation:"intent",group}))]:group.sibling_keywords.map((keyword)=>({keyword,parent:null,relation:"sibling",group})));
const option=(value)=>`<option value="${value}">${value}</option>`;
[...new Set(keywordRows.map((row)=>row.group.category))].sort().forEach((value)=>filters.category.insertAdjacentHTML("beforeend",option(value)));
[...new Set(keywordRows.map((row)=>row.parent).filter(Boolean))].sort().forEach((value)=>filters.parent.insertAdjacentHTML("beforeend",option(value)));
[...new Set(keywordRows.map((row)=>row.group.state))].sort().forEach((value)=>filters.state.insertAdjacentHTML("beforeend",option(value)));
function renderRows(){
  const query=filters.search.value.trim().toLocaleLowerCase("ja-JP");
  const rows=keywordRows.filter((row)=>(!query||`${row.keyword} ${row.parent??""}`.toLocaleLowerCase("ja-JP").includes(query))&&(filters.category.value==="all"||row.group.category===filters.category.value)&&(filters.parent.value==="all"||row.parent===filters.parent.value)&&(filters.confidence.value==="all"||row.group.confidence===filters.confidence.value)&&(filters.state.value==="all"||row.group.state===filters.state.value));
  rowsRoot.innerHTML=rows.map((row,index)=>`<tr tabindex="0" class="${index===0?"selected":""}" data-id="${row.group.id}"><td><strong>${row.keyword}</strong></td><td>${row.parent??"未確定"}</td><td><span class="relation ${row.relation}">${row.relation}</span></td><td>${row.group.category}</td><td><span class="badge ${row.group.confidence}">${row.group.confidence}</span></td><td>${row.group.overlap.shared}/${row.group.overlap.depth} · ${Math.round(row.group.overlap.ratio*100)}%</td><td>${row.group.state}</td><td>${row.group.wp_article_id??"—"}</td></tr>`).join("");
  document.querySelector("#table-empty").innerHTML=rows.length?"":"<div class='empty'><strong>該当KWなし</strong><span>フィルターを変更してください。</span></div>";
  if(!rows.length){detail.innerHTML="";return} renderDetail(rows[0].group);
  rowsRoot.querySelectorAll("tr").forEach((row)=>{const select=()=>{rowsRoot.querySelectorAll("tr").forEach((item)=>item.classList.remove("selected"));row.classList.add("selected");renderDetail(data.groups.find((group)=>group.id===row.dataset.id))};row.addEventListener("click",select);row.addEventListener("keydown",(event)=>{if(event.key==="Enter"||event.key===" ")select()})});
}
Object.values(filters).forEach((filter)=>filter.addEventListener(filter.type==="search"?"input":"change",renderRows));renderRows();

document.querySelector("#source-list").innerHTML=data.sources.map((source)=>`<article class="source-card"><p class="detail-label">${source.role}</p><h3>${source.name}</h3><div class="source-stat"><span>入力行</span><strong>${yen.format(source.rows)}</strong></div><div class="source-stat"><span>ユニークKW</span><strong>${yen.format(source.unique_keywords)}</strong></div><div class="source-stat"><span>取込判断</span><strong>分離保持</strong></div><p class="card-meta">${source.detail}</p></article>`).join("");

document.querySelector("#evidence-list").innerHTML=data.groups.map((group)=>`<article class="evidence-card"><header><div><p class="detail-label">${group.id}</p><h3>${label(group)}</h3></div><span class="badge ${group.confidence}">${group.confidence}</span></header><progress max="1" value="${group.overlap.ratio}" aria-label="SERP一致率"></progress><div class="card-meta"><span>${group.overlap.shared}/${group.overlap.depth} URL一致</span><span>${group.task_ids.length} DFS tasks</span><span>raw digest保持</span></div></article>`).join("");
