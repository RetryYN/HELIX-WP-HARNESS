import {createHash} from "node:crypto";

const featureGuidance={
  knowledge_graph:{signal:"entity",formats:["entity_definition","authoritative_citations"],title:"「{keyword}とは」をタイトル候補として検討",heading:"冒頭で対象語を定義し、一次情報または公的根拠を示す"},
  people_also_search:{signal:"choice_support",formats:["comparison_table","service_selection_guide"],title:"比較・おすすめなど選択支援の意図をタイトル候補として検討",heading:"関連する商品・サービスの比較軸と選び方を設ける"},
  images:{signal:"visual",formats:["original_images","example_gallery","descriptive_alt_text"],title:"画像・写真・例があることをタイトル候補として検討",heading:"検索意図を満たすオリジナル画像と具体例を設ける"},
  video:{signal:"video",formats:["video_embed","video_summary","transcript"],title:"動画・実演解説は補助形式として検討",heading:"動画の要点を本文と文字起こしでも提供する"},
  jobs:{signal:"jobs",formats:["job_listing","filterable_database"],title:"求人・募集情報の鮮度をタイトル候補として検討",heading:"職種・勤務地・条件で比較できる求人データを設ける"},
};
const unique=(values)=>[...new Set(values)];
const fill=(value,keyword)=>value.replace("{keyword}",keyword);

export function buildSerpActionSignals({tasks,features,organicResults,featureItems=[]}){
  const featuresByTask=new Map(),organicByTask=new Map(),itemsByFeature=Map.groupBy(featureItems,(item)=>item.feature_id);
  for(const feature of features){const rows=featuresByTask.get(feature.task_id)??[];rows.push(feature);featuresByTask.set(feature.task_id,rows)}
  for(const organic of organicResults){const rows=organicByTask.get(organic.task_id)??[];rows.push(organic);organicByTask.set(organic.task_id,rows)}
  const signals=[];
  for(const task of tasks){
    const taskFeatures=featuresByTask.get(task.task_id)??[],organic=organicByTask.get(task.task_id)??[],signalTypes=[],formats=[],titles=[],headings=[],evidence=[];
    for(const feature of taskFeatures){const guidance=featureGuidance[feature.feature_type];if(!guidance)continue;signalTypes.push(guidance.signal);formats.push(...guidance.formats);titles.push(fill(guidance.title,task.keyword));headings.push(fill(guidance.heading,task.keyword));evidence.push({evidence_type:"serp_feature",evidence_id:feature.feature_id,feature_type:feature.feature_type,rank_absolute:feature.rank_absolute??null});for(const item of itemsByFeature.get(feature.feature_id)??[]){const linkDomains=[...new Set(item.links.map((link)=>link.domain).filter(Boolean))];evidence.push({evidence_type:"serp_feature_item",evidence_id:item.feature_item_id,feature_type:item.feature_type,item_type:item.item_type,url:item.url,source_link_ids:item.links.map((link)=>link.link_id),source_domains:linkDomains});if(item.feature_type==="people_also_search"&&item.text){titles.push(`比較対象候補「${item.text}」を検索意図と照合する`);headings.push(`「${item.text}」を比較対象に含めるか、対象読者・用途・選定基準で検証する`)}else if(item.feature_type==="images"&&item.alt){headings.push(`画像需要の題材「${item.alt}」を参考に、独自画像で具体例を示す`)}else if(item.feature_type==="video"&&(item.title||item.source)){headings.push(`動画SERPの論点「${item.title??item.source}」を本文で検証し、要点と出典を明記する`)}else if(item.feature_type==="knowledge_graph"){formats.push("source_link_review");headings.push(linkDomains.length?`定義はKnowledge Graph出典（${linkDomains.join(" / ")}）と一次情報を照合する`:"Knowledge Graphの定義を一次情報と照合する")}}}
    const priced=organic.filter((row)=>row.price!=null),rated=organic.filter((row)=>row.rating!=null),videoResults=organic.filter((row)=>Boolean(row.attributes?.is_video));
    if(priced.length||rated.length){signalTypes.push("commercial");formats.push("comparison_table");titles.push("価格・比較・おすすめの意図をタイトル候補として検討");headings.push("価格、比較条件、選定基準を更新日付きで示す");if(rated.length){formats.push("review_evidence");headings.push("評価値だけでなく件数・評価方法・出典を示す")};for(const row of unique([...priced,...rated]))evidence.push({evidence_type:"organic_result",evidence_id:`${row.task_id}:${row.rank_absolute}`,rank_absolute:row.rank_absolute,has_price:row.price!=null,has_rating:row.rating!=null})}
    if(videoResults.length){signalTypes.push("video");formats.push("video_embed","video_summary","transcript");titles.push("動画・実演解説は補助形式として検討");headings.push("動画の要点を本文と文字起こしでも提供する");for(const row of videoResults)evidence.push({evidence_type:"organic_result_attribute",evidence_id:`${row.task_id}:${row.rank_absolute}:is_video`,rank_absolute:row.rank_absolute,is_video:true})}
    const correctedKeyword=task.spell?.keyword??null;
    if(correctedKeyword){signalTypes.push("spelling");formats.push("canonical_spelling_review");titles.push(`正規表記候補「${correctedKeyword}」を確認し、元の検索語も本文で取りこぼさない`);evidence.push({evidence_type:"task_spell",evidence_id:task.task_id,correction_type:task.spell.type??null})}
    if(!signalTypes.length)continue;
    const row={task_id:task.task_id,group_id:task.group_id,keyword:task.keyword,corrected_keyword:correctedKeyword,correction_type:task.spell?.type??null,signal_types:unique(signalTypes),recommended_formats:unique(formats),title_guidance:unique(titles),heading_guidance:unique(headings),priced_result_count:priced.length,rated_result_count:rated.length,video_result_count:videoResults.length,evidence,status:"proposed"};
    row.evidence_digest=createHash("sha256").update(JSON.stringify(row)).digest("hex");signals.push(row);
  }
  return signals.sort((left,right)=>left.keyword.localeCompare(right.keyword,"ja"));
}
