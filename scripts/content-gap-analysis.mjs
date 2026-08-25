import {createHash} from "node:crypto";

export const normalizeContentEvidence=(value)=>String(value??"").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[\s\p{P}\p{S}]+/gu,"");

export function assessContentTopicCoverage(groups,proposals,articles){
  const articleByKey=new Map(articles.map((article)=>[`${article.site_id}\0${article.wp_article_id}`,article]));
  return proposals.map((proposal)=>{
    const group=groups.find((item)=>item.id===proposal.group_id),article=group?.wp_article_id==null?null:articleByKey.get(`${group.site_id}\0${group.wp_article_id}`)??null,needle=normalizeContentEvidence(proposal.display_topic);
    let coverage_status="unassigned",match_source=null,matched_heading_level=null,matched_heading_position=null,matched_text=null;
    if(article){
      const title=normalizeContentEvidence(article.title);
      if(needle&&title.includes(needle)){coverage_status="covered_title";match_source="title";matched_text=article.title}
      else{const heading=(article.headings??[]).find((item)=>needle&&normalizeContentEvidence(item.text).includes(needle));if(heading){coverage_status="covered_heading";match_source="heading";matched_heading_level=heading.level;matched_heading_position=heading.position;matched_text=heading.text}else coverage_status="missing"}
    }
    const evidence_digest=createHash("sha256").update(JSON.stringify([proposal.proposal_id,group?.wp_article_id??null,coverage_status,match_source,matched_heading_level,matched_heading_position,matched_text])).digest("hex");
    return{proposal_id:proposal.proposal_id,group_id:proposal.group_id,site_id:group.site_id,wp_article_id:group.wp_article_id??null,coverage_status,match_source,matched_heading_level,matched_heading_position,matched_text,evidence_digest};
  });
}
