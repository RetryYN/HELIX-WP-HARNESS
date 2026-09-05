import {createHash} from "node:crypto";
import {hasRedactedUrlIdentity} from "./retained-url-identity.mjs";

const digest=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

// Evidence assembly only. Group-level lexical paths are context candidates, not task-level facts.
export function buildKeywordMeaningEvidence({tasks,edges,demands,semanticReviews=[]}){
  const ids=new Set();
  for(const task of tasks){if(ids.has(task.task_id))throw Error("duplicate task");ids.add(task.task_id);}
  const reviews=new Map(semanticReviews.map(r=>[r.group_id,r]));
  return tasks.map(task=>{
    const pages=edges.filter(e=>e.task_id===task.task_id).map(e=>({url:e.canonical_url??e.url,rank:e.rank}));
    const identifiable=pages.filter(p=>p.url&&!hasRedactedUrlIdentity(p.url)).sort((a,b)=>a.rank-b.rank||a.url.localeCompare(b.url));
    const observations=demands.filter(d=>d.task_id===task.task_id).map(d=>({
      evidence_id:d.occurrence_id,kind:d.demand_type,text:d.value,
      source_keyword:d.source_keyword,observed_at:d.observed_at,snapshot_digest:d.snapshot_digest,
      seed_value:d.seed_value,recursion_depth:d.recursion_depth,
      interpretation:"observed_search_feature_not_user_transition",
    })).sort((a,b)=>a.evidence_id.localeCompare(b.evidence_id));
    const review=reviews.get(task.group_id);
    const concepts=structuredClone(review?.concepts??[]);
    const record={schema_version:"keyword-meaning-evidence.v1",task_id:task.task_id,group_id:task.group_id,keyword:task.keyword,
      serp:{state:identifiable.length?"identifiable_pages_retained":"no_identifiable_pages_available",pages:identifiable},
      demand_observations:observations,
      lexical_context:{scope:"group_not_individual_keyword",review_digest:review?.review_digest??null,concepts,requires_context_disambiguation:true},
      reader_interpretations:[],problem_relations:[],story_transitions:[],
      interpretation_state:"not_inferred",actual_user_journey_observed:false,
      article_generation_ready:false,auto_mutation:false};
    return {...record,evidence_packet_digest:digest(record)};
  }).sort((a,b)=>a.task_id.localeCompare(b.task_id));
}
