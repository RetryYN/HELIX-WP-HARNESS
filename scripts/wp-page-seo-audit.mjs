import {createHash} from "node:crypto";
const sha=(value)=>createHash("sha256").update(value).digest("hex"),chars=(value)=>[...String(value??"")].length;
const canonical=(value)=>{try{const url=new URL(value);url.hash="";url.search="";url.pathname=url.pathname.replace(/\/+$/u,"")||"/";return url.href}catch{return null}};
const duplicates=(rows,key)=>new Map(Object.entries(Object.groupBy(rows.filter((row)=>row[key]),(row)=>row[key])).filter(([,values])=>values.length>1).map(([value,values])=>[value,values.map((row)=>row.wp_article_id)]));

export function auditWpPageSeoMetadata(rows){
  const duplicateTitles=duplicates(rows,"title"),duplicateDescriptions=duplicates(rows,"description"),duplicateCanonicals=duplicates(rows,"canonical_url");
  return rows.map((row)=>{const findings=[],add=(code,severity,detail)=>findings.push({code,severity,detail});
    if(row.error)add("fetch_error","critical",row.error);else if(row.http_status!==200)add("http_not_200","critical",`HTTP ${row.http_status}`);
    if(!row.title)add("title_missing","critical","title要素なし");else if(chars(row.title)<20||chars(row.title)>65)add("title_length","warning",`${chars(row.title)}文字（観測目安20–65）`);
    if(!row.description)add("description_missing","warning","meta descriptionなし");else if(chars(row.description)<70||chars(row.description)>160)add("description_length","warning",`${chars(row.description)}文字（観測目安70–160）`);
    if(/(?:^|[,\s])noindex(?:[,\s]|$)/iu.test(row.robots??"")||/(?:^|[,\s])noindex(?:[,\s]|$)/iu.test(row.googlebot??""))add("noindex","critical",row.robots??row.googlebot);
    if(!row.canonical_url)add("canonical_missing","critical","canonicalなし");else if(canonical(row.canonical_url)!==canonical(row.final_url))add("canonical_mismatch","critical",`${row.final_url} → ${row.canonical_url}`);
    if(row.open_graph?.["og:title"]&&row.open_graph["og:title"]!==row.title)add("og_title_mismatch","warning","title要素とog:titleが不一致");if(row.open_graph?.["og:url"]&&canonical(row.open_graph["og:url"])!==canonical(row.canonical_url))add("og_url_mismatch","warning","og:urlとcanonicalが不一致");
    if((row.schema_types??[]).length===0)add("json_ld_not_observed","info","今回の公開headでJSON-LDを観測せず");if(duplicateTitles.has(row.title))add("duplicate_title","warning",`WP ${duplicateTitles.get(row.title).join(", ")}`);if(duplicateDescriptions.has(row.description))add("duplicate_description","warning",`WP ${duplicateDescriptions.get(row.description).join(", ")}`);if(duplicateCanonicals.has(row.canonical_url))add("duplicate_canonical","critical",`WP ${duplicateCanonicals.get(row.canonical_url).join(", ")}`);
    const state=findings.some((item)=>item.severity==="critical")?"critical":findings.some((item)=>item.severity==="warning")?"warning":findings.some((item)=>item.severity==="info")?"informational":"pass",base={site_id:row.site_id,wp_article_id:row.wp_article_id,state,critical_count:findings.filter((item)=>item.severity==="critical").length,warning_count:findings.filter((item)=>item.severity==="warning").length,info_count:findings.filter((item)=>item.severity==="info").length,findings,policy:"wp-public-seo-audit.v1",source_evidence_digest:row.evidence_digest};return{...base,audit_digest:sha(JSON.stringify(base))}
  });
}
