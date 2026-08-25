import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildJapanLocationDataset} from "./japan-location-core.mjs";

const csv='01101,"060  ","0600000","ホッカイドウ","サッポロシチュウオウク","イカニケイサイガナイバアイ","北海道","札幌市中央区","以下に掲載がない場合",0\n01303,"06102","0610200","ホッカイドウ","イシカリグントウベツチョウ","イカニケイサイガナイバアイ","北海道","石狩郡当別町","以下に掲載がない場合",0\n01303,"06102","0610211","ホッカイドウ","イシカリグントウベツチョウ","ナカコザワ","北海道","石狩郡当別町","中小屋",0';
const fixture=buildJapanLocationDataset(csv,{sourceUrl:"https://example.test/data.zip",sourcePage:"https://example.test/",sourceUpdatedAt:"2026-07-31",sourceDigest:"a".repeat(64)});assert.equal(fixture.coverage.prefectures,1);assert.equal(fixture.coverage.municipalities,2);assert.equal(fixture.municipalities[1].county,"石狩郡");assert.equal(fixture.municipalities[1].locality,"当別町");assert.equal(fixture.evidence_digest.length,64);
const actual=JSON.parse(readFileSync(new URL("../docs/prototypes/wp-ops-dashboard/japan-locations.json",import.meta.url)));assert.equal(actual.coverage.prefectures,47);assert.ok(actual.coverage.municipalities>1800);assert.equal(actual.coverage.stations,0);assert.equal(actual.source.archive_sha256.length,64);assert.equal(actual.evidence_digest.length,64);console.log(`Japan location dataset: OK (${actual.coverage.prefectures} prefectures / ${actual.coverage.municipalities} municipalities, station gap explicit)`);
