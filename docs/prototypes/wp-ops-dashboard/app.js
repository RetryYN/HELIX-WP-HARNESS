const data = await fetch("data.json").then((response) => {
  if (!response.ok) throw new Error(`data.json: ${response.status}`);
  return response.json();
});
const yen = new Intl.NumberFormat("ja-JP");
document.querySelector("#freshness").textContent = `DFS実測 · ${new Date(data.generated_at).toLocaleString("ja-JP")}`;

const metricLabels = {actionable_main_keywords:"施策メインKW",new_article_candidates:"新規記事候補",unresolved_parent_groups:"親KW未確定",wp_articles_assigned:"記事ID割当"};
document.querySelector("#metrics").innerHTML = Object.entries(data.metrics).map(([key,value])=>`<div class="metric"><span>${metricLabels[key]}</span><strong>${yen.format(value)}</strong><small>件</small></div>`).join("");

document.querySelectorAll(".tab").forEach((tab)=>tab.addEventListener("click",()=>{
  document.querySelectorAll(".tab,.view").forEach((node)=>node.classList.remove("active"));
  tab.classList.add("active"); document.querySelector(`#${tab.dataset.view}`).classList.add("active");
}));

const rowsRoot = document.querySelector("#keyword-rows");
const detail = document.querySelector("#group-detail");
const dialog = document.querySelector("#detail-dialog");
document.querySelector("#detail-close").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",(event)=>{if(event.target===dialog)dialog.close()});
const filters={search:document.querySelector("#keyword-search"),category:document.querySelector("#category-filter"),parent:document.querySelector("#parent-filter"),state:document.querySelector("#state-filter")};
function label(group){return group.main_keyword ?? group.sibling_keywords.join(" ／ ")}
function renderDetail(group){
  const keywords=group.intent_keywords.length?group.intent_keywords:group.sibling_keywords;
  const judgment=group.confidence==="high"?"同一記事候補（高）":"統合検討候補";
  detail.innerHTML=`<span class="badge ${group.confidence}">${judgment}</span><h2>${label(group)}</h2><p class="detail-label">${group.main_origin}</p><div class="detail-block"><div class="detail-label">この判定で比較したキーワード</div><div class="chips">${keywords.map((kw)=>`<span class="chip">${kw}</span>`).join("")}</div></div><div class="detail-block"><div class="detail-row"><span>メインKW検索Vol</span><strong>${group.search_volume==null?"未取得":yen.format(group.search_volume)}</strong></div><div class="detail-row"><span>検索Vol出典</span><strong>${group.search_volume_source??"未取得"}</strong></div><div class="detail-row"><span>比較ペア</span><strong>${keywords.join(" ↔ ")}</strong></div><div class="detail-row"><span>上位5 URLの一致</span><strong>${group.overlap.shared}/${group.overlap.depth} · ${Math.round(group.overlap.ratio*100)}%</strong></div><div class="detail-row"><span>グループ判定</span><strong>${judgment}</strong></div><div class="detail-row"><span>施策状態</span><strong>${group.state}</strong></div><div class="detail-row"><span>WP記事ID</span><strong>${group.wp_article_id??"未割当"}</strong></div><div class="detail-row"><span>DFS費用</span><strong>$${group.cost.toFixed(4)}</strong></div></div><div class="detail-block"><div class="detail-label">両キーワードに共通したURL</div>${group.shared_urls.length?`<ul class="url-list">${group.shared_urls.map((url)=>`<li title="${url}">${url}</li>`).join("")}</ul>`:"<p class='detail-row'>URL詳細はraw snapshot参照</p>"}</div><div class="detail-block"><div class="detail-label">比較に使用したDFS Task ID</div>${group.task_ids.map((id)=>`<div class="detail-row"><code>${id}</code></div>`).join("")}</div>`;
}
const keywordRows=data.groups.filter((group)=>group.main_keyword).map((group)=>({keyword:group.main_keyword,parent:group.main_keyword,group}));
const option=(value)=>`<option value="${value}">${value}</option>`;
[...new Set(keywordRows.map((row)=>row.group.category))].sort().forEach((value)=>filters.category.insertAdjacentHTML("beforeend",option(value)));
[...new Set(keywordRows.map((row)=>row.parent).filter(Boolean))].sort().forEach((value)=>filters.parent.insertAdjacentHTML("beforeend",option(value)));
[...new Set(keywordRows.map((row)=>row.group.state))].sort().forEach((value)=>filters.state.insertAdjacentHTML("beforeend",option(value)));
function renderRows(){
  const query=filters.search.value.trim().toLocaleLowerCase("ja-JP");
  const rows=keywordRows.filter((row)=>(!query||`${row.keyword} ${row.parent??""}`.toLocaleLowerCase("ja-JP").includes(query))&&(filters.category.value==="all"||row.group.category===filters.category.value)&&(filters.parent.value==="all"||row.parent===filters.parent.value)&&(filters.state.value==="all"||row.group.state===filters.state.value));
  rowsRoot.innerHTML=rows.map((row)=>`<tr data-id="${row.group.id}"><td><strong>${row.keyword}</strong></td><td><strong>${row.group.search_volume==null?"未取得":yen.format(row.group.search_volume)}</strong><small class="cell-note">${row.group.search_volume_source??""}</small></td><td>${row.group.intent_keywords.length}語</td><td>${row.group.category}</td><td>${row.group.state}</td><td>${row.group.wp_article_id??"—"}</td><td><button class="detail-button" type="button">詳細</button></td></tr>`).join("");
  document.querySelector("#table-empty").innerHTML=rows.length?"":"<div class='empty'><strong>該当KWなし</strong><span>フィルターを変更してください。</span></div>";
  if(!rows.length){detail.innerHTML="";return}
  rowsRoot.querySelectorAll(".detail-button").forEach((button)=>button.addEventListener("click",()=>{const row=button.closest("tr");renderDetail(data.groups.find((group)=>group.id===row.dataset.id));dialog.showModal()}));
}
Object.values(filters).forEach((filter)=>filter.addEventListener(filter.type==="search"?"input":"change",renderRows));renderRows();

document.querySelector("#query-empty").innerHTML=`<strong>獲得クエリはまだありません</strong><span>WP記事IDの割当が${data.metrics.wp_articles_assigned}件のため、記事とGSCクエリを結合できません。記事ID照合後に実データを表示します。</span>`;
document.querySelector("#link-map").innerHTML=`<div class="map-placeholder"><strong>内部リンク構造は未生成です</strong><span>WP記事IDを取得し、記事本文から内部リンクを抽出した後に表示します。推測リンクやダミーノードは表示しません。</span></div>`;
