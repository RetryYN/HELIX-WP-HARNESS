import {createHash} from "node:crypto";
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {buildJapanLocationDataset} from "./japan-location-core.mjs";

const sourceUrl="https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip",sourcePage="https://www.post.japanpost.jp/service/search/zipcode/download/utf-zip.html",sourceUpdatedAt=process.env.JP_LOCATION_SOURCE_UPDATED_AT??"2026-07-31",output=path.resolve(process.env.JP_LOCATION_OUTPUT??"docs/prototypes/wp-ops-dashboard/japan-locations.json"),temporary=mkdtempSync(path.join(tmpdir(),"helix-japan-location-"));
try{const response=await fetch(sourceUrl);if(!response.ok)throw new Error(`日本郵便dataset取得失敗: ${response.status}`);const archive=Buffer.from(await response.arrayBuffer()),archivePath=path.join(temporary,"utf_ken_all.zip");writeFileSync(archivePath,archive);const unzip=spawnSync("unzip",["-q",archivePath,"-d",temporary],{encoding:"utf8"});if(unzip.status!==0)throw new Error(`unzip失敗: ${unzip.stderr}`);const csv=readFileSync(path.join(temporary,"utf_ken_all.csv"),"utf8"),dataset=buildJapanLocationDataset(csv,{sourceUrl,sourcePage,sourceUpdatedAt,sourceDigest:createHash("sha256").update(archive).digest("hex")});writeFileSync(output,`${JSON.stringify(dataset)}\n`);console.log(`Japan locations: ${dataset.coverage.prefectures} prefectures / ${dataset.coverage.municipalities} municipalities -> ${output}`)}finally{rmSync(temporary,{recursive:true,force:true})}
