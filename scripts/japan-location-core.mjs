import {createHash} from "node:crypto";
import {parseCsv} from "./read-csv.mjs";

export function buildJapanLocationDataset(csv,{sourceUrl,sourcePage,sourceUpdatedAt,sourceDigest}){
  const rows=parseCsv(`jis_code,old_zip,new_zip,prefecture_kana,municipality_kana,town_kana,prefecture,municipality,town,flag1,flag2,flag3,flag4,flag5,flag6\n${csv}`),municipalities=new Map(),prefectures=new Map();
  for(const row of rows){const {jis_code:jisCode,prefecture,municipality}=row;if(!jisCode||!prefecture||!municipality)continue;prefectures.set(prefecture,{name:prefecture});const countyEnd=municipality.indexOf("郡");const county=countyEnd>=0?municipality.slice(0,countyEnd+1):null;municipalities.set(`${jisCode}:${municipality}`,{jis_code:jisCode,prefecture,municipality,county,locality:county?municipality.slice(countyEnd+1):municipality})}
  const prefectureRows=[...prefectures.values()].sort((a,b)=>a.name.localeCompare(b.name,"ja")),municipalityRows=[...municipalities.values()].sort((a,b)=>a.jis_code.localeCompare(b.jis_code)||a.municipality.localeCompare(b.municipality,"ja"));
  const evidenceDigest=createHash("sha256").update(JSON.stringify({sourceUrl,sourceUpdatedAt,sourceDigest,prefectureRows,municipalityRows})).digest("hex");
  return {schema_version:"japan-location-keywords.v1",source:{provider:"日本郵便",url:sourceUrl,page:sourcePage,updated_at:sourceUpdatedAt,archive_sha256:sourceDigest},coverage:{prefectures:prefectureRows.length,municipalities:municipalityRows.length,stations:0,station_state:"not_acquired"},prefectures:prefectureRows,municipalities:municipalityRows,evidence_digest:evidenceDigest};
}
