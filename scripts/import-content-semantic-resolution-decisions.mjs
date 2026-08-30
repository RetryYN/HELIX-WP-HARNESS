import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {projectDashboard} from "./keyword-dashboard-db.mjs";
import {validateSemanticResolutionDecisions} from "./content-semantic-resolution-decisions.mjs";

const args=process.argv.slice(2),value=(flag)=>{const index=args.indexOf(flag);return index<0?null:args[index+1]},file=value("--file"),dbPath=resolve(value("--db")??".helix/keyword-dashboard.sqlite"),commit=args.includes("--commit");if(!file)throw new Error("usage: node scripts/import-content-semantic-resolution-decisions.mjs --file decisions.json [--db dashboard.sqlite] [--commit]");
const input=JSON.parse(readFileSync(resolve(file),"utf8")),db=new DatabaseSync(dbPath,{readOnly:!commit});
try{
  const data=projectDashboard(db),site=data.sites.find((row)=>row.semantic_resolution_decision_packet?.packet_digest===input.packet_digest);if(!site)throw new Error("semantic decision packet does not match any site in this dashboard");const validated=validateSemanticResolutionDecisions(site.semantic_resolution_decision_packet,input);
  if(!commit)console.log(JSON.stringify({state:"validated_not_imported",db_path:dbPath,site_id:site.site_id,packet_digest:validated.packet_digest,reviewer_digest:validated.reviewer_digest,decision_count:validated.decision_count,complete:validated.complete,decision_set_digest:validated.decision_set_digest,auto_apply:false},null,2));
  else{
    if(db.prepare("SELECT 1 FROM content_semantic_resolution_decision_sets WHERE packet_digest=? AND reviewer_digest=?").get(validated.packet_digest,validated.reviewer_digest))throw new Error("reviewer semantic decision set already imported for this packet");const insertSet=db.prepare("INSERT INTO content_semantic_resolution_decision_sets VALUES (?, ?, ?, ?, ?, ?)"),insertDecision=db.prepare("INSERT INTO content_semantic_resolution_decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");db.exec("BEGIN");try{insertSet.run(validated.packet_digest,validated.reviewer_digest,validated.decision_set_digest,new Date().toISOString(),validated.decision_count,Number(validated.complete));for(const row of validated.decisions)insertDecision.run(validated.packet_digest,row.task_id,row.task_digest,row.reviewer_digest,row.sense_state,row.group_evidence_state,row.demand_evidence_state,row.editorial_state,row.resolution_state,row.reviewed_at,row.notes,row.decision_digest,0);db.exec("COMMIT")}catch(error){db.exec("ROLLBACK");throw error}console.log(JSON.stringify({state:"imported",db_path:dbPath,site_id:site.site_id,packet_digest:validated.packet_digest,reviewer_digest:validated.reviewer_digest,decision_count:validated.decision_count,complete:validated.complete,auto_apply:false},null,2));
  }
}finally{db.close()}
