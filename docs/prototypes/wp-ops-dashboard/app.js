const data = await fetch("data.json").then((response) => {
  if (!response.ok) throw new Error(`data.json: ${response.status}`);
  return response.json();
});
const yen = new Intl.NumberFormat("ja-JP");
const formatVolume=(value)=>typeof value==="number"?yen.format(value):(value??"未取得");
document.querySelector("#freshness").textContent = `DFS実測 · ${new Date(data.generated_at).toLocaleString("ja-JP")}`;

const siteSelector=document.querySelector("#site-selector");
const pinnedSites=data.sites.filter((site)=>site.is_pinned).sort((a,b)=>a.display_order-b.display_order).slice(0,4);
siteSelector.value=pinnedSites[0]?.site_id??data.sites[0].site_id;
pinnedSites.forEach((site,index)=>siteSelector.insertAdjacentHTML("beforeend",`<button type="button" role="tab" class="site-tab ${index===0?"active":""}" data-site="${site.site_id}">${site.label}</button>`));
siteSelector.insertAdjacentHTML("beforeend",'<button type="button" class="site-directory-trigger">サイト一覧</button>');
const metricLabels = {actionable_main_keywords:"施策メインKW",new_article_candidates:"新規記事候補",wp_articles_assigned:"記事ID割当"};
function renderMetrics(groups){const metrics={actionable_main_keywords:groups.length,new_article_candidates:groups.filter((group)=>group.state.startsWith("新規記事候補")).length,wp_articles_assigned:groups.filter((group)=>group.wp_article_id!=null).length};document.querySelector("#metrics").innerHTML=Object.entries(metrics).map(([key,value])=>`<div class="metric"><span>${metricLabels[key]}</span><strong>${yen.format(value)}</strong><small>件</small></div>`).join("")}

document.querySelectorAll(".tab").forEach((tab)=>tab.addEventListener("click",()=>{
  document.querySelectorAll(".tab,.view").forEach((node)=>node.classList.remove("active"));
  tab.classList.add("active"); document.querySelector(`#${tab.dataset.view}`).classList.add("active");
}));

const rowsRoot = document.querySelector("#keyword-rows");
const detail = document.querySelector("#group-detail");
const dialog = document.querySelector("#detail-dialog");
document.querySelector("#detail-close").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",(event)=>{if(event.target===dialog)dialog.close()});
const siteDialog=document.querySelector("#site-dialog");
const siteSearch=document.querySelector("#site-search");
const siteList=document.querySelector("#site-list");
document.querySelector("#site-close").addEventListener("click",()=>siteDialog.close());
siteSelector.querySelector(".site-directory-trigger").addEventListener("click",()=>siteDialog.showModal());
function activateSite(siteId){siteSelector.value=siteId;siteSelector.querySelectorAll(".site-tab").forEach((item)=>item.classList.toggle("active",item.dataset.site===siteId));selectSite();if(siteDialog.open)siteDialog.close()}
function renderSiteList(){const query=siteSearch.value.trim().toLocaleLowerCase("ja-JP");const sites=data.sites.filter((site)=>`${site.label} ${site.domain}`.toLocaleLowerCase("ja-JP").includes(query));siteList.innerHTML=sites.map((site)=>`<button type="button" class="site-list-item" data-site="${site.site_id}"><span><strong>${site.label}</strong><small>${site.domain}</small></span><em>${site.status}</em></button>`).join("");siteList.querySelectorAll(".site-list-item").forEach((item)=>item.addEventListener("click",()=>activateSite(item.dataset.site)))}
siteSearch.addEventListener("input",renderSiteList);renderSiteList();
const filters={search:document.querySelector("#keyword-search"),category:document.querySelector("#category-filter"),parent:document.querySelector("#parent-filter"),state:document.querySelector("#state-filter")};
function label(group){return group.main_keyword ?? group.sibling_keywords.join(" ／ ")}
function renderDetail(group){
  const keywords=group.intent_keywords.length?group.intent_keywords:group.sibling_keywords;
  const compared=group.comparison_keywords;
  const judgment=`SERP一致 ${Math.round(group.overlap.ratio*100)}%`;
  detail.innerHTML=`<span class="badge ${group.confidence}">${judgment}</span><h2>${label(group)}</h2><p class="detail-label">${group.main_origin}</p><div class="detail-block"><div class="detail-label">SERPを比較したキーワード</div><div class="chips">${keywords.map((kw)=>`<span class="chip">${kw}</span>`).join("")}</div></div><div class="detail-block"><div class="detail-row"><span>メインKW検索Vol</span><strong>${group.search_volume==null?"未取得":yen.format(group.search_volume)}</strong></div><div class="detail-row"><span>検索Vol出典</span><strong>${group.search_volume_source??"未取得"}</strong></div><div class="detail-row"><span>比較ペア</span><strong>${keywords.join(" ↔ ")}</strong></div><div class="detail-row"><span>上位5 URLの一致</span><strong>${group.overlap.shared}/${group.overlap.depth} · ${Math.round(group.overlap.ratio*100)}%</strong></div><div class="detail-row"><span>判定</span><strong>${judgment}</strong></div><div class="detail-row"><span>施策状態</span><strong>${group.state}</strong></div><div class="detail-row"><span>WP記事ID</span><strong>${group.wp_article_id??"未割当"}</strong></div><div class="detail-row"><span>DFS費用</span><strong>$${group.cost.toFixed(4)}</strong></div></div><div class="detail-block"><div class="detail-label">両キーワードに共通したURL</div>${group.shared_urls.length?`<ul class="url-list">${group.shared_urls.map((url)=>`<li title="${url}">${url}</li>`).join("")}</ul>`:"<p class='detail-row'>URL詳細はraw snapshot参照</p>"}</div><div class="detail-block"><div class="detail-label">比較に使用したDFS Task ID</div>${group.task_ids.map((id)=>`<div class="detail-row"><code>${id}</code></div>`).join("")}</div>`;
  detail.querySelectorAll(".detail-row").forEach((row)=>{const key=row.querySelector("span")?.textContent;if(key==="メインKW検索Vol")row.querySelector("strong").textContent=formatVolume(group.search_volume);if(key==="比較ペア")row.querySelector("strong").textContent=compared.join(" ↔ ")});
}
const compareSourceOrder=(left,right)=>left.group.source_order.file-right.group.source_order.file||left.group.source_order.sheet-right.group.source_order.sheet||left.group.source_order.row-right.group.source_order.row;
const allKeywordRows=data.groups.filter((group)=>group.main_keyword).map((group)=>({keyword:group.main_keyword,parent:group.main_keyword,group}));
let keywordRows=[];
const option=(value)=>`<option value="${value}">${value}</option>`;
function resetFilter(select){while(select.options.length>1)select.remove(1);select.value="all"}
function selectSite(){keywordRows=allKeywordRows.filter((row)=>row.group.site_id===siteSelector.value).sort(compareSourceOrder);Object.values(filters).forEach((filter)=>{if(filter.tagName==="SELECT")resetFilter(filter);else filter.value=""});[...new Set(keywordRows.map((row)=>row.group.category))].forEach((value)=>filters.category.insertAdjacentHTML("beforeend",option(value)));[...new Set(keywordRows.map((row)=>row.parent))].forEach((value)=>filters.parent.insertAdjacentHTML("beforeend",option(value)));[...new Set(keywordRows.map((row)=>row.group.state))].forEach((value)=>filters.state.insertAdjacentHTML("beforeend",option(value)));renderMetrics(keywordRows.map((row)=>row.group));renderRows();renderEmptyViews()}
function renderRows(){
  const query=filters.search.value.trim().toLocaleLowerCase("ja-JP");
  const rows=keywordRows.filter((row)=>(!query||`${row.keyword} ${row.parent??""}`.toLocaleLowerCase("ja-JP").includes(query))&&(filters.category.value==="all"||row.group.category===filters.category.value)&&(filters.parent.value==="all"||row.parent===filters.parent.value)&&(filters.state.value==="all"||row.group.state===filters.state.value));
  rowsRoot.innerHTML=rows.map((row)=>`<tr data-id="${row.group.id}"><td>${row.group.category}</td><td><strong>${row.keyword}</strong></td><td><strong>${row.group.search_volume==null?"未取得":yen.format(row.group.search_volume)}</strong></td><td>${row.group.intent_keywords.length}語</td><td>${row.group.state}</td><td>${row.group.wp_article_id??"—"}</td><td><button class="detail-button" type="button">詳細</button></td></tr>`).join("");
  rowsRoot.querySelectorAll("tr").forEach((tr)=>{const group=data.groups.find((item)=>item.id===tr.dataset.id);tr.children[2].querySelector("strong").textContent=formatVolume(group.search_volume)});
  document.querySelector("#table-empty").innerHTML=rows.length?"":"<div class='empty'><strong>該当KWなし</strong><span>フィルターを変更してください。</span></div>";
  if(!rows.length){detail.innerHTML="";return}
  rowsRoot.querySelectorAll(".detail-button").forEach((button)=>button.addEventListener("click",()=>{const row=button.closest("tr");renderDetail(data.groups.find((group)=>group.id===row.dataset.id));dialog.showModal()}));
}
Object.values(filters).forEach((filter)=>filter.addEventListener(filter.type==="search"?"input":"change",renderRows));siteSelector.querySelectorAll(".site-tab").forEach((tab)=>tab.addEventListener("click",()=>activateSite(tab.dataset.site)));

function renderEmptyViews(){const site=data.sites.find((item)=>item.site_id===siteSelector.value);const assigned=keywordRows.filter((row)=>row.group.wp_article_id!=null).length;document.querySelector("#query-empty").innerHTML=`<strong>${site.label}の獲得クエリはまだありません</strong><span>WP記事IDの割当が${assigned}件のため、記事とGSCクエリを結合できません。記事ID照合後に実データを表示します。</span>`;document.querySelector("#link-map").innerHTML=`<div class="map-placeholder"><strong>${site.label}の内部リンク構造は未生成です</strong><span>このサイトのWP記事IDを取得し、記事本文から内部リンクを抽出した後に表示します。他サイトの記事やリンクは混在させません。</span></div>`}
selectSite();
