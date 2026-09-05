import {createHash} from 'node:crypto';
import {buildKeywordArticleRouting} from './keyword-article-routing.mjs';

// Preserve dependency constraints and reader branches; a topological order is not a single reader's journey.
export function buildKeywordStoryArticlePlans(story,assignments){
  const routing=buildKeywordArticleRouting(story,assignments),nodes=new Map(story.interpretations.map(n=>[n.id,n]));
  const problems=new Map(story.problem_clusters.map(p=>[p.id,p]));
  const index=new Map(story.dependency_order.map((id,i)=>[id,i]));
  const articles=Map.groupBy(assignments,a=>a.article_candidate_id);
  const plans=[...articles].map(([articleId,assigned])=>{
    const ids=new Set(assigned.map(a=>a.problem_id));
    const sections=[...ids].sort((a,b)=>index.get(a)-index.get(b)).map(id=>{
      const p=problems.get(id),members=p.interpretation_ids.map(id=>nodes.get(id));
      return {problem_id:id,reader_condition:p.reader,question_to_resolve:p.problem,answer_scope:p.answer_scope,
        triggers:[...new Set(members.map(n=>n.trigger))],barriers:[...new Set(members.map(n=>n.barrier))],
        expected_reader_outcomes:[...new Set(members.map(n=>n.desired_outcome))],
        source_task_ids:[...new Set(members.map(n=>n.task_id))],interpretation_ids:p.interpretation_ids,
        prerequisites:[...new Set(routing.routes.filter(r=>r.placement==='in_article_question'&&r.target_problem_id===id).map(r=>r.source_problem_id))],
        evidence:members.map(n=>({interpretation_id:n.id,task_id:n.task_id,packet_digest:n.evidence_packet_digest,evidence_ids:n.evidence_ids})),
        unknowns:[...new Set(members.flatMap(n=>n.unknowns))],heading_text:null};
    });
    const grouped=new Map();
    for(const r of routing.routes.filter(r=>r.source_article_candidate_id===articleId&&r.placement!=='boundary_unresolved')){
      const key=JSON.stringify([r.source_problem_id,r.target_problem_id,r.placement,r.trigger_condition,r.related_question]);
      const row=grouped.get(key)??{...r,supporting_route_digests:[],supporting_interpretation_pairs:[]};
      row.supporting_route_digests.push(r.route_digest);row.supporting_interpretation_pairs.push([r.source_interpretation_id,r.target_interpretation_id]);grouped.set(key,row);
    }
    const routes=[...grouped.values()];
    return {article_candidate_id:articleId,title:null,sections,
      in_article_transitions:routes.filter(r=>r.placement==='in_article_question'),
      related_questions:routes.filter(r=>r.placement==='internal_link_question'),
      unresolved_routes:routing.routes.filter(r=>r.source_article_candidate_id===articleId&&r.placement==='boundary_unresolved'),
      layout_policy:'reader_condition_branches_with_dependencies',copywriting_state:'not_generated',independently_verified:false,auto_publish:false};
  });
  return {schema_version:'keyword-story-article-plan.v1',source_story_digest:story.story_digest,plans,unassigned_problem_ids:routing.unassigned_problem_ids,plan_digest:createHash('sha256').update(JSON.stringify(plans)).digest('hex')};
}
