import {createHash} from 'node:crypto';

// Explicit article boundaries, not an inference that each problem cluster needs its own article.
export function buildKeywordArticleRouting(story,assignments){
  const problems=new Map(story.problem_clusters.map(p=>[p.id,p]));
  const assigned=new Map();
  for(const a of assignments){
    if(!problems.has(a.problem_id)||assigned.has(a.problem_id))throw Error('unknown or duplicate assigned problem');
    if(typeof a.article_candidate_id!=='string'||!a.article_candidate_id.trim()||typeof a.rationale!=='string'||!a.rationale.trim())throw Error('article boundary needs identity and rationale');
    assigned.set(a.problem_id,structuredClone(a));
  }
  const routes=story.story_transitions.map(t=>{
    const from=assigned.get(t.from_problem),to=assigned.get(t.to_problem);
    const kind=!from||!to?'boundary_unresolved':from.article_candidate_id===to.article_candidate_id?'in_article_question':'internal_link_question';
    const record={source_problem_id:t.from_problem,target_problem_id:t.to_problem,source_article_candidate_id:from?.article_candidate_id??null,target_article_candidate_id:to?.article_candidate_id??null,
      placement:kind,trigger_condition:t.resolved_before_transition,related_question:t.next_question,transition_rationale:t.rationale,
      target_answer_scope:problems.get(t.to_problem)?.answer_scope??null,target_url:null,target_resolution:'not_resolved',
      source_interpretation_id:t.from,target_interpretation_id:t.to,evidence_packets:t.evidence_packets,
      article_boundary_rationales:[from?.rationale??null,to?.rationale??null],state:'editorial_hypothesis',auto_publish:false};
    return {...record,route_digest:createHash('sha256').update(JSON.stringify(record)).digest('hex')};
  });
  return {schema_version:'keyword-article-routing.v1',story_digest:story.story_digest,assignments:[...assigned.values()],routes,
    unassigned_problem_ids:[...problems.keys()].filter(id=>!assigned.has(id)),summary:{in_article_questions:routes.filter(r=>r.placement==='in_article_question').length,internal_link_questions:routes.filter(r=>r.placement==='internal_link_question').length,unresolved_boundaries:routes.filter(r=>r.placement==='boundary_unresolved').length,actual_links_published:0}};
}
