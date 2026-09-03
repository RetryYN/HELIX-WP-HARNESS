const panel=document.querySelector("#demand-payload-retention");
let requestId=0;
const activeSite=()=>document.querySelector("#site-selector .site-tab.active")?.dataset.site??document.querySelector("#site-selector .site-tab")?.dataset.site;
const render=async()=>{
  if(!panel)return;
  const siteId=activeSite();
  if(!siteId){panel.textContent="需要payload監査はサイト選択後に表示します。";return}
  const current=++requestId;
  panel.textContent="需要occurrenceとfeature payloadの保持境界を確認中…";
  try{
    const response=await fetch(`/api/v1/demand-occurrence-integrity?site_id=${encodeURIComponent(siteId)}&limit=1`),payload=await response.json();
    if(current!==requestId)return;
    if(!response.ok)throw new Error(payload.error??`需要payload監査: ${response.status}`);
    const summary=payload.summary??{},states=summary.paa_answer_state_counts??{},linked=Number(summary.feature_payload_linked_occurrence_count??0),unlinked=Number(summary.feature_payload_unlinked_occurrence_count??0),occurrences=Number(summary.occurrence_count??0),snapshot=Number(summary.snapshot_provenance_retained_occurrence_count??0),resolved=Number(states.resolved??0),notReturned=Number(summary.paa_answer_not_returned_occurrence_count??0);
    panel.innerHTML=`<strong>需要payload保持境界</strong><span>featureリンク ${linked}/${occurrences} · 未接続 ${unlinked} · snapshot digest保持 ${snapshot} · PAA回答payload保持 ${resolved} · provider未返却 ${notReturned}</span><small>未返却・非同期placeholderは「保持後に破棄」とは扱いません。自動取得・自動編集・自動公開はありません。</small>`;
    panel.classList.toggle("error",unlinked>0);
  }catch(error){
    if(current!==requestId)return;
    panel.textContent=error.message;
    panel.classList.add("error");
  }
};
const siteSelector=document.querySelector("#site-selector");
if(siteSelector)new MutationObserver(()=>{void render()}).observe(siteSelector,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});
document.addEventListener("click",event=>{if(event.target.closest("[data-site]"))setTimeout(()=>void render(),0)});
void render();
