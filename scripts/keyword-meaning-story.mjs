import {createHash} from "node:crypto";

const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const key=(a,b)=>[a,b].sort().join("\0");
const required=(value,name)=>{if(typeof value!=="string"||!value.trim())throw Error(`missing ${name}`);};

// Interpretations and relations are explicit hypotheses, never inferred from SERP rank order.
export function buildKeywordMeaningStory(packets,interpretations,relations){
  const sources=new Map(packets.map(p=>[p.task_id,p]));
  if(sources.size!==packets.length)throw Error("duplicate evidence task");
  for(const packet of packets){
    const {evidence_packet_digest,...body}=packet;
    if(hash(body)!==evidence_packet_digest)throw Error("evidence packet content digest mismatch");
  }
  const nodes=new Map();
  for(const input of interpretations){
    const n=structuredClone(input);
    for(const field of ["id","task_id","reader","trigger","prior_knowledge","problem","barrier","desired_outcome","answer_scope","rationale"])required(n[field],field);
    if(nodes.has(n.id))throw Error("duplicate interpretation");
    const packet=sources.get(n.task_id);
    if(!packet||n.evidence_packet_digest!==packet.evidence_packet_digest)throw Error("stale or missing evidence packet");
    const evidence=new Set(packet.demand_observations.map(d=>d.evidence_id));
    for(const p of packet.serp.pages)evidence.add(`serp:${p.url}`);
    for(const h of packet.benchmark_heading_evidence??[]){
      if(!h.evidence_id||!h.snapshot_digest||!h.heading_text_digest||!Number.isInteger(h.position))throw Error("invalid benchmark heading evidence");
      evidence.add(h.evidence_id);
    }
    if(!Array.isArray(n.evidence_ids)||!n.evidence_ids.length||n.evidence_ids.some(id=>!evidence.has(id)))throw Error("unbound interpretation evidence");
    if(!Array.isArray(n.alternative_interpretations)||!Array.isArray(n.unknowns))throw Error("missing uncertainty fields");
    nodes.set(n.id,{...n,state:"hypothesis",independently_verified:false});
  }
  const pairs=new Map(),links=[];
  for(const input of relations){
    const r=structuredClone(input),a=nodes.get(r.from),b=nodes.get(r.to);
    if(!a||!b||a.id===b.id)throw Error("invalid relation endpoints");
    if(!["same_problem","prerequisite","next_question","alternative","separate","unresolved"].includes(r.kind))throw Error("unknown relation kind");
    required(r.rationale,"relation rationale");
    const pk=key(a.id,b.id);if(pairs.has(pk))throw Error("conflicting or duplicate pair relation");
    if(r.kind==="same_problem"){
      // A shared answer alone cannot merge different readers or different desired outcomes.
      if(["reader","problem","desired_outcome","answer_scope"].some(f=>a[f]!==b[f]))throw Error("incompatible same-problem interpretations");
      required(r.shared_answer,"shared answer");
    }
    if(["prerequisite","next_question"].includes(r.kind)){
      required(r.resolved_before_transition,"resolved before transition");
      required(r.next_question,"next question");
    }
    const link={...r,state:"hypothesis",evidence_packets:[a.evidence_packet_digest,b.evidence_packet_digest],actual_user_transition_observed:false};
    pairs.set(pk,link);links.push(link);
  }
  // Complete-link grouping: A~B and B~C do not imply A~C.
  const clusters=[];
  for(const id of [...nodes.keys()].sort()){
    const c=clusters.find(c=>c.every(other=>pairs.get(key(id,other))?.kind==="same_problem"));
    if(c)c.push(id);else clusters.push([id]);
  }
  const owner=new Map(),articles=clusters.map(members=>{
    const id=`problem:${hash(members).slice(0,16)}`;members.forEach(m=>owner.set(m,id));
    return {id,interpretation_ids:members,reader:nodes.get(members[0]).reader,problem:nodes.get(members[0]).problem,answer_scope:nodes.get(members[0]).answer_scope,state:"candidate"};
  });
  const transitions=links.filter(r=>["prerequisite","next_question"].includes(r.kind)).map(r=>({...r,from_problem:owner.get(r.from),to_problem:owner.get(r.to)}));
  const indegree=new Map(articles.map(a=>[a.id,0])),outgoing=new Map(articles.map(a=>[a.id,[]]));
  for(const r of transitions){if(r.from_problem===r.to_problem)throw Error("transition inside same problem");outgoing.get(r.from_problem).push(r.to_problem);indegree.set(r.to_problem,indegree.get(r.to_problem)+1);}
  const available=[...indegree].filter(([,n])=>n===0).map(([id])=>id).sort(),order=[];
  while(available.length){const id=available.shift();order.push(id);for(const next of outgoing.get(id)){indegree.set(next,indegree.get(next)-1);if(indegree.get(next)===0){available.push(next);available.sort();}}}
  if(order.length!==articles.length)throw Error("cyclic story transitions require resolution");
  const result={schema_version:"keyword-meaning-story.v1",interpretations:[...nodes.values()],relations:links,problem_clusters:articles,story_transitions:transitions,dependency_order:order,
    ordering_policy:"dependency_order_not_observed_user_order",grouping_policy:"explicit_complete_link",independently_verified:false,auto_mutation:false};
  return {...result,story_digest:hash(result)};
}
