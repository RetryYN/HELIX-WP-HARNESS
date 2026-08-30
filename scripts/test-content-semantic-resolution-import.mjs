import assert from "node:assert/strict";
import {copyFileSync,mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {buildSemanticResolutionDecisionExport} from "../docs/prototypes/wp-ops-dashboard/semantic-resolution-export.mjs";

const directory=mkdtempSync(path.join(tmpdir(),"helix-semantic-decisions-")),dbPath=path.join(directory,"dashboard.sqlite"),inputPath=path.join(directory,"decisions.json");copyFileSync(".helix/keyword-dashboard.sqlite",dbPath);
try{
  let db=openDashboardDb(dbPath),data=projectDashboard(db),packet=data.sites[0].semantic_resolution_decision_packet,item=packet.items[0];db.close();const input=await buildSemanticResolutionDecisionExport(packet.packet_digest,"fixture-reviewer",[{task_id:item.task_id,task_digest:item.task_digest,sense_state:"relevant",group_evidence_state:"supported",demand_evidence_state:"observed",editorial_state:"approved_for_consideration",reviewed_at:"2026-08-30T15:30:00+09:00",notes:"fixture decision"}]);writeFileSync(inputPath,JSON.stringify(input));
  const dry=spawnSync(process.execPath,["scripts/import-content-semantic-resolution-decisions.mjs","--file",inputPath,"--db",dbPath],{encoding:"utf8"});assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).state,"validated_not_imported");db=openDashboardDb(dbPath);assert.equal(db.prepare("SELECT COUNT(*) count FROM content_semantic_resolution_decisions").get().count,0);db.close();
  const committed=spawnSync(process.execPath,["scripts/import-content-semantic-resolution-decisions.mjs","--file",inputPath,"--db",dbPath,"--commit"],{encoding:"utf8"});assert.equal(committed.status,0,committed.stderr);assert.equal(JSON.parse(committed.stdout).state,"imported");db=openDashboardDb(dbPath);data=projectDashboard(db);const progress=data.sites[0].semantic_resolution_decision_packet;assert.equal(progress.summary.decision_count,1);assert.equal(progress.summary.approved_for_consideration_count,1);assert.equal(progress.summary.auto_apply_count,0);assert.equal(db.prepare("SELECT auto_apply FROM content_semantic_resolution_decisions").get().auto_apply,0);db.close();
  const duplicate=spawnSync(process.execPath,["scripts/import-content-semantic-resolution-decisions.mjs","--file",inputPath,"--db",dbPath,"--commit"],{encoding:"utf8"});assert.notEqual(duplicate.status,0);assert.match(duplicate.stderr,/already imported/);console.log("content semantic resolution import: OK (dry-run, explicit commit, restart progress, duplicate rejection, no auto apply)");
}finally{rmSync(directory,{recursive:true,force:true})}
