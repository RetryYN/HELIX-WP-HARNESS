const metricsRoot=document.querySelector("#serp-field-state-audit-summary"),rowsRoot=document.querySelector("#serp-field-state-audit-rows"),emptyRoot=document.querySelector("#serp-field-state-audit-empty"),number=new Intl.NumberFormat("ja-JP"),escapeHtml=(value)=>String(value??"").replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
const fetchAllStates=async()=>{
  const rows=[];
  let cursor="";
  for(let page=0;page<10;page+=1){
    const params=new URLSearchParams({view:"states",value_state:"all",limit:"100"});
    if(cursor)params.set("cursor",cursor);
    const response=await fetch(`/api/v1/serp-field-lineage?${params}`),payload=await response.json();
    if(!response.ok)throw new Error(payload.error??`SERP field state audit: HTTP ${response.status}`);
    rows.push(...(payload.data??[]));
    if(!payload.meta?.next_cursor) return {rows,summary:payload.summary??{}};
    cursor=payload.meta.next_cursor;
  }
  throw new Error("SERP field state audit pagination exceeded the safety limit");
};
const render=async()=>{
  if(!metricsRoot||!rowsRoot||!emptyRoot)return;
  metricsRoot.innerHTML="<div class=\"metric\"><span>状態監査</span><strong>読込中</strong><small>—</small></div>";
  try{
    const {rows,summary}=await fetchAllStates(),stateSummary=summary.value_state??{};
    metricsRoot.innerHTML=[
      ["観測field",stateSummary.field_count??rows.length,"field"],
      ["観測値",stateSummary.observation_count??0,"件"],
      ["非空",stateSummary.nonempty_observation_count??0,"件"],
      ["null",stateSummary.null_observation_count??0,"件"],
      ["空値",stateSummary.empty_observation_count??0,"件"],
      ["0",stateSummary.zero_observation_count??0,"件"],
      ["false",stateSummary.false_observation_count??0,"件"],
    ].map(([label,value,unit])=>`<div class="metric"><span>${label}</span><strong>${escapeHtml(number.format(value))}</strong><small>${unit}</small></div>`).join("");
    const ordered=rows.slice().sort((left,right)=>{
      const leftSpecial=(left.state_counts?.null??0)+(left.state_counts?.empty??0)+(left.state_counts?.zero??0)+(left.state_counts?.false??0),rightSpecial=(right.state_counts?.null??0)+(right.state_counts?.empty??0)+(right.state_counts?.zero??0)+(right.state_counts?.false??0);
      return rightSpecial-leftSpecial||left.field.localeCompare(right.field,"ja-JP");
    });
    rowsRoot.innerHTML=ordered.map((row)=>{const states=row.state_counts??{};return`<tr><td><strong>${escapeHtml(row.field)}</strong></td><td>${escapeHtml(number.format(row.observation_count??0))}</td><td>${escapeHtml(number.format(states.nonempty??0))}</td><td>${escapeHtml(number.format(states.null??0))}</td><td>${escapeHtml(number.format(states.empty??0))}</td><td>${escapeHtml(number.format(states.zero??0))}</td><td>${escapeHtml(number.format(states.false??0))}</td></tr>`}).join("");
    emptyRoot.hidden=rows.length>0;
    emptyRoot.innerHTML=rows.length?"":"<strong>観測されたraw fieldがありません</strong><span>取得payloadの状態監査を実行できませんでした。</span>";
  }catch(error){
    metricsRoot.innerHTML="";
    rowsRoot.innerHTML="";
    emptyRoot.hidden=false;
    emptyRoot.innerHTML=`<strong>SERP field状態監査を読み込めませんでした</strong><span>${escapeHtml(error.message)}</span>`;
  }
};
render();
