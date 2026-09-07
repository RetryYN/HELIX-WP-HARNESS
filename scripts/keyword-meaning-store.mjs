import {buildKeywordMeaningStory} from "./keyword-meaning-story.mjs";
import {createHash} from "node:crypto";

// A separate projection database. No tables in the acquisition database are changed.
export function storeKeywordMeaning(db,{packets,story,lexicalReviews=[]}){
  const rebuilt=buildKeywordMeaningStory(packets,story.interpretations,story.relations);
  if(rebuilt.story_digest!==story.story_digest)throw Error("story digest mismatch");
  const taskIds=new Set(packets.map(p=>p.task_id));
  for(const review of lexicalReviews){
    if(!review.context||!Array.isArray(review.task_ids)||!review.task_ids.length||review.task_ids.some(id=>!taskIds.has(id)))throw Error("invalid lexical review scope");
    if(review.auto_replacement!==false||review.independently_verified!==false)throw Error("lexical review must remain a non-replacing hypothesis");
    if(!Array.isArray(review.decisions)||review.decisions.some(d=>!d.left||!d.right||!d.reason||!d.state||!/^[a-f0-9]{64}$/.test(d.evidence_digest)))throw Error("invalid lexical decision evidence");
  }
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("BEGIN IMMEDIATE");
  try{
    db.exec(`
      CREATE TABLE meaning_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE meaning_packets(task_id TEXT PRIMARY KEY,digest TEXT NOT NULL,payload_json TEXT NOT NULL);
      CREATE TABLE meaning_interpretations(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES meaning_packets(task_id),reader TEXT NOT NULL,trigger TEXT NOT NULL,problem TEXT NOT NULL,desired_outcome TEXT NOT NULL,payload_json TEXT NOT NULL);
      CREATE TABLE meaning_problems(id TEXT PRIMARY KEY,reader TEXT NOT NULL,problem TEXT NOT NULL,answer_scope TEXT NOT NULL);
      CREATE TABLE meaning_members(problem_id TEXT NOT NULL REFERENCES meaning_problems(id),interpretation_id TEXT NOT NULL UNIQUE REFERENCES meaning_interpretations(id),PRIMARY KEY(problem_id,interpretation_id));
      CREATE TABLE meaning_relations(position INTEGER PRIMARY KEY,source_id TEXT NOT NULL REFERENCES meaning_interpretations(id),target_id TEXT NOT NULL REFERENCES meaning_interpretations(id),kind TEXT NOT NULL,rationale TEXT NOT NULL,payload_json TEXT NOT NULL);
      CREATE TABLE meaning_transitions(position INTEGER PRIMARY KEY,source_problem TEXT NOT NULL REFERENCES meaning_problems(id),target_problem TEXT NOT NULL REFERENCES meaning_problems(id),resolved_before_transition TEXT NOT NULL,next_question TEXT NOT NULL,payload_json TEXT NOT NULL);
      CREATE TABLE meaning_lexical_reviews(review_digest TEXT PRIMARY KEY,context TEXT NOT NULL,payload_json TEXT NOT NULL);
      CREATE TABLE meaning_lexical_review_tasks(review_digest TEXT NOT NULL REFERENCES meaning_lexical_reviews(review_digest),task_id TEXT NOT NULL REFERENCES meaning_packets(task_id),PRIMARY KEY(review_digest,task_id));
    `);
    const meta=db.prepare("INSERT INTO meaning_metadata VALUES (?,?)");
    for(const [key,value] of Object.entries({schema:"keyword-meaning-store.v2",story_digest:story.story_digest,independently_verified:false,scope:"supplied_packets_only",actual_user_journey_observed:false}))meta.run(key,JSON.stringify(value));
    const packet=db.prepare("INSERT INTO meaning_packets VALUES (?,?,?)");
    for(const p of packets)packet.run(p.task_id,p.evidence_packet_digest,JSON.stringify(p));
    const lexical=db.prepare("INSERT INTO meaning_lexical_reviews VALUES (?,?,?)"),lexicalTask=db.prepare("INSERT INTO meaning_lexical_review_tasks VALUES (?,?)");
    for(const review of lexicalReviews){
      const payload=JSON.stringify(review),id=createHash('sha256').update(payload).digest('hex');
      lexical.run(id,review.context,payload);
      for(const taskId of new Set(review.task_ids))lexicalTask.run(id,taskId);
    }
    const node=db.prepare("INSERT INTO meaning_interpretations VALUES (?,?,?,?,?,?,?)");
    for(const n of story.interpretations)node.run(n.id,n.task_id,n.reader,n.trigger,n.problem,n.desired_outcome,JSON.stringify(n));
    const problem=db.prepare("INSERT INTO meaning_problems VALUES (?,?,?,?)"),member=db.prepare("INSERT INTO meaning_members VALUES (?,?)");
    for(const p of story.problem_clusters){problem.run(p.id,p.reader,p.problem,p.answer_scope);for(const id of p.interpretation_ids)member.run(p.id,id);}
    const relation=db.prepare("INSERT INTO meaning_relations VALUES (?,?,?,?,?,?)");
    story.relations.forEach((r,i)=>relation.run(i,r.from,r.to,r.kind,r.rationale,JSON.stringify(r)));
    const transition=db.prepare("INSERT INTO meaning_transitions VALUES (?,?,?,?,?,?)");
    story.story_transitions.forEach((r,i)=>transition.run(i,r.from_problem,r.to_problem,r.resolved_before_transition,r.next_question,JSON.stringify(r)));
    if(db.prepare("PRAGMA foreign_key_check").all().length)throw Error("meaning foreign key failure");
    db.exec("COMMIT");
  }catch(error){db.exec("ROLLBACK");throw error;}
  return {tasks:packets.length,interpretations:story.interpretations.length,problems:story.problem_clusters.length,transitions:story.story_transitions.length,lexical_reviews:lexicalReviews.length};
}
