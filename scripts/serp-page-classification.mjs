const socialHosts=["x.com","twitter.com","instagram.com","tiktok.com","facebook.com","note.com"];
const videoHosts=["youtube.com","youtu.be","vimeo.com"];
const qaHosts=["sub2.competitor-253.example","quora.com","teratail.com"];
const databaseSignals=[/\/jobs?(?:\/|$)/,/\/companies?(?:\/|$)/,/\/reviews?(?:\/|$)/,/\/search(?:\/|$)/,/\/ranking(?:\/|$)/,/business_categories/,/求人/,/企業一覧/,/口コミ/];
const articleSignals=[/\/articles?(?:\/|$)/,/\/column(?:s)?(?:\/|$)/,/\/blog(?:\/|$)/,/\/guide(?:\/|$)/,/\/news(?:\/|$)/,/\/media(?:\/|$)/,/\/qa(?:\/|$)/,/\/archives?\//];
const newsHosts=["news.competitor-253.example","nhk.or.jp","nikkei.com","asahi.com","mainichi.jp","yomiuri.co.jp"];
const hostname=(url)=>{try{return new URL(url).hostname.toLowerCase().replace(/^www\./,"")}catch{return""}};
export const PAGE_TYPE_LABELS={article:"記事",pdf:"PDF",video:"動画",social:"SNS",service_top:"サービスTOP",corporate_home:"企業HP",database:"データベース型",category:"一覧・カテゴリ",qa_forum:"Q&A・掲示板",news:"ニュース",tool:"ツール",other:"その他"};

export function classifySerpPage(item){
  const url=String(item?.url??""),title=String(item?.title??""),domain=hostname(url);let parsed;
  try{parsed=new URL(url)}catch{return{url,domain,page_type:"other",confidence:"low",signals:["invalid_url"]}}
  const path=decodeURIComponent(parsed.pathname).replace(/\/+$/,"")||"/",text=`${path} ${title}`.toLowerCase();
  if(/\.pdf$/i.test(path)||item?.type==="pdf")return{url,domain,page_type:"pdf",confidence:"high",signals:["pdf_extension_or_serp_type"]};
  if(videoHosts.some((host)=>domain===host||domain.endsWith(`.${host}`)))return{url,domain,page_type:"video",confidence:"high",signals:["video_host"]};
  if(socialHosts.some((host)=>domain===host||domain.endsWith(`.${host}`)))return{url,domain,page_type:"social",confidence:"high",signals:["social_host"]};
  if(qaHosts.some((host)=>domain===host||domain.endsWith(`.${host}`))||/掲示板|q&a|質問/.test(text))return{url,domain,page_type:"qa_forum",confidence:"high",signals:["qa_host_or_path"]};
  if(path==="/")return{url,domain,page_type:/株式会社|corporate|コーポレート/.test(title)?"corporate_home":"service_top",confidence:"medium",signals:["root_path"]};
  if(databaseSignals.some((signal)=>signal.test(text)))return{url,domain,page_type:"database",confidence:"medium",signals:["database_path_or_title"]};
  if(/\/tag\/|\/category\/|\/page\/\d+|一覧/.test(text))return{url,domain,page_type:"category",confidence:"medium",signals:["listing_path_or_title"]};
  if(/診断|シミュレーション|calculator|checker/.test(text))return{url,domain,page_type:"tool",confidence:"medium",signals:["interactive_title_or_path"]};
  if(newsHosts.some((host)=>domain===host||domain.endsWith(`.${host}`)))return{url,domain,page_type:"news",confidence:"medium",signals:["news_host"]};
  if(articleSignals.some((signal)=>signal.test(path))||/解説|例文|方法|ポイント|とは/.test(title))return{url,domain,page_type:"article",confidence:"medium",signals:["article_path_or_title"]};
  return{url,domain,page_type:"other",confidence:"low",signals:["no_rule_matched"]};
}
export function classifySerpResult(result,depth=10){return(result?.items??[]).filter((item)=>item.type==="organic"&&item.url).slice(0,depth).map((item,index)=>({rank:index+1,title:item.title??"",...classifySerpPage(item)}))}
export function recommendPageType(classifications){const weighted=new Map();for(const item of classifications){const type=["news","qa_forum"].includes(item.page_type)?"article":item.page_type;weighted.set(type,(weighted.get(type)??0)+(item.rank<=5?2:1))}return[...weighted].filter(([type])=>type!=="other").sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??"other"}
