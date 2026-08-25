export function buildQuickSearchBookmarklet({dashboardUrl,siteId}){
  const base=new URL(dashboardUrl);base.search="";base.hash="";
  const source=`(()=>{const q=(String(getSelection?.()??"").trim()||document.title||"").trim();const u=new URL(${JSON.stringify(base.toString())});u.searchParams.set("site",${JSON.stringify(siteId)});u.searchParams.set("quick_q",q);u.hash="quick-search";open(u.toString(),"_blank","noopener")})()`;
  return `javascript:${encodeURIComponent(source)}`;
}
