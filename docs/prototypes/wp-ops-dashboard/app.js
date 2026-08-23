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

const list = document.querySelector("#group-list");
const detail = document.querySelector("#group-detail");
const filter = document.querySelector("#confidence-filter");
function label(group){return group.main_keyword ?? group.sibling_keywords.join(" ／ ")}
function renderDetail(group){
  const keywords=group.intent_keywords.length?group.intent_keywords:group.sibling_keywords;
  detail.innerHTML=`<span class="badge ${group.confidence}">${group.confidence.toUpperCase()}</span><h2>${label(group)}</h2><p class="detail-label">${group.main_origin}</p><div class="detail-block"><div class="detail-label">内包・関連キーワード</div><div class="chips">${keywords.map((kw)=>`<span class="chip">${kw}</span>`).join("")}</div></div><div class="detail-block"><div class="detail-row"><span>SERP一致</span><strong>${group.overlap.shared}/${group.overlap.depth} · ${Math.round(group.overlap.ratio*100)}%</strong></div><div class="detail-row"><span>施策状態</span><strong>${group.state}</strong></div><div class="detail-row"><span>WP記事ID</span><strong>${group.wp_article_id??"未割当"}</strong></div><div class="detail-row"><span>DFS費用</span><strong>$${group.cost.toFixed(4)}</strong></div></div><div class="detail-block"><div class="detail-label">共通URL</div>${group.shared_urls.length?`<ul class="url-list">${group.shared_urls.map((url)=>`<li title="${url}">${url}</li>`).join("")}</ul>`:"<p class='detail-row'>URL詳細はraw snapshot参照</p>"}</div><div class="detail-block"><div class="detail-label">Task ID</div>${group.task_ids.map((id)=>`<div class="detail-row"><code>${id}</code></div>`).join("")}</div>`;
}
function renderGroups(){
  const groups=data.groups.filter((group)=>filter.value==="all"||group.confidence===filter.value);
  list.innerHTML=groups.map((group,index)=>`<button class="group-card ${index===0?"selected":""}" data-id="${group.id}"><div class="card-top"><div><p class="detail-label">${group.category}</p><h3>${label(group)}</h3></div><span class="badge ${group.confidence}">${group.confidence}</span></div><div class="chips">${(group.intent_keywords.length?group.intent_keywords:group.sibling_keywords).map((kw)=>`<span class="chip">${kw}</span>`).join("")}</div><div class="card-meta"><span>SERP ${group.overlap.shared}/${group.overlap.depth}</span><span>${group.state}</span><span>WP ID ${group.wp_article_id??"—"}</span></div></button>`).join("");
  if(!groups.length){list.append(document.querySelector("#empty-template").content.cloneNode(true));detail.innerHTML="";return}
  renderDetail(groups[0]);
  list.querySelectorAll(".group-card").forEach((card)=>card.addEventListener("click",()=>{list.querySelectorAll(".group-card").forEach((item)=>item.classList.remove("selected"));card.classList.add("selected");renderDetail(data.groups.find((group)=>group.id===card.dataset.id));}));
}
filter.addEventListener("change",renderGroups);renderGroups();

document.querySelector("#source-list").innerHTML=data.sources.map((source)=>`<article class="source-card"><p class="detail-label">${source.role}</p><h3>${source.name}</h3><div class="source-stat"><span>入力行</span><strong>${yen.format(source.rows)}</strong></div><div class="source-stat"><span>ユニークKW</span><strong>${yen.format(source.unique_keywords)}</strong></div><div class="source-stat"><span>取込判断</span><strong>分離保持</strong></div><p class="card-meta">${source.detail}</p></article>`).join("");

document.querySelector("#evidence-list").innerHTML=data.groups.map((group)=>`<article class="evidence-card"><header><div><p class="detail-label">${group.id}</p><h3>${label(group)}</h3></div><span class="badge ${group.confidence}">${group.confidence}</span></header><progress max="1" value="${group.overlap.ratio}" aria-label="SERP一致率"></progress><div class="card-meta"><span>${group.overlap.shared}/${group.overlap.depth} URL一致</span><span>${group.task_ids.length} DFS tasks</span><span>raw digest保持</span></div></article>`).join("");
