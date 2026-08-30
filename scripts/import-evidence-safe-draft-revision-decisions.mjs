import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {projectDashboard} from "./keyword-dashboard-db.mjs";
import {validateEvidenceSafeDraftRevisionDecisions} from "./evidence-safe-draft-revisions.mjs";

const args=process.argv.slice(2),value=(flag)=>{const index=args.indexOf(flag);return index<0?null:args[index+1]},file=value("--file"),dbPath=resolve(value("--db")??".helix/keyword-dashboard.sqlite"),commit=args.includes("--commit");if(!file)throw new Error("usage: node scripts/import-evidence-safe-draft-revision-decisions.mjs --file decisions.json [--db dashboard.sqlite] [--commit]");
const input=JSON.parse(readFileSync(resolve(file),"utf8")),db=new DatabaseSync(dbPath,{readOnly:!commit});
try{
  const data=projectDashboard(db),site=data.sites.find((row)=>row.evidence_safe_draft_revisions?.proposal_set_digest===input.proposal_set_digest);if(!site)throw new Error("evidence-safe revision proposal set does not match any site in this dashboard");const validated=validateEvidenceSafeDraftRevisionDecisions(site.evidence_safe_draft_revisions,input);
  if(!commit)console.log(JSON.stringify({state:"validated_not_imported",db_path:dbPath,site_id:site.site_id,proposal_set_digest:validated.proposal_set_digest,reviewer_digest:validated.reviewer_digest,decision_count:validated.decision_count,complete:validated.complete,decision_set_digest:validated.decision_set_digest,auto_apply:false,auto_publication:false},null,2));
  else{
    if(db.prepare("SELECT 1 FROM evidence_safe_draft_revision_decision_sets WHERE proposal_set_digest=? AND reviewer_digest=?").get(validated.proposal_set_digest,validated.reviewer_digest))throw new Error("reviewer evidence-safe revision decision set already imported for this proposal set");const insertSet=db.prepare("INSERT INTO evidence_safe_draft_revision_decision_sets VALUES (?, ?, ?, ?, ?, ?)"),insertDecision=db.prepare("INSERT INTO evidence_safe_draft_revision_decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");db.exec("BEGIN");try{insertSet.run(validated.proposal_set_digest,validated.reviewer_digest,validated.decision_set_digest,new Date().toISOString(),validated.decision_count,Number(validated.complete));for(const row of validated.decisions)insertDecision.run(validated.proposal_set_digest,row.revision_proposal_id,row.proposal_digest,row.reviewer_digest,row.editorial_state,Number(row.unsupported_answer_removed),Number(row.no_new_factual_claim),Number(row.source_lineage_reviewed),row.reviewed_at,row.notes,row.decision_digest,0,0);db.exec("COMMIT")}catch(error){db.exec("ROLLBACK");throw error}console.log(JSON.stringify({state:"imported",db_path:dbPath,site_id:site.site_id,proposal_set_digest:validated.proposal_set_digest,reviewer_digest:validated.reviewer_digest,decision_count:validated.decision_count,complete:validated.complete,auto_apply:false,auto_publication:false},null,2));
  }
}finally{db.close()}
