import {readFileSync} from "node:fs";
const evidence=JSON.parse(readFileSync(new URL("../docs/research/evidence/public-search-metadata.json",import.meta.url),"utf8"));
const locationRows=evidence.locations.rows.map((row)=>({...row,source:"retained_public_metadata",catalog_digest:evidence.locations.response_sha256}));
const languageRows=evidence.languages.rows.map((row)=>({...row,source:"retained_public_metadata",catalog_digest:evidence.languages.response_sha256}));
export function searchPublicLocations({locationName="",countryCode=""}={}){const name=String(locationName).trim().toLowerCase(),country=String(countryCode).trim().toUpperCase();if(country&&!/^[A-Z]{2}$/u.test(country))throw new TypeError("countryCode must be an ISO alpha-2 code");return locationRows.filter((row)=>(!name||row.name.toLowerCase().includes(name))&&(!country||row.countryIsoCode===country))}
export function listPublicLanguages(){return languageRows}
export function findPublicLocationName(value){const key=String(value??"").trim().toLowerCase();return key?locationRows.find((row)=>row.name.toLowerCase()===key)??null:null}
export function findPublicLanguageName(value){const key=String(value??"").trim().toLowerCase();return key?languageRows.find((row)=>row.name.toLowerCase()===key)??null:null}
export const publicSearchMetadataSummary={location_count:locationRows.length,language_count:languageRows.length,location_catalog_digest:evidence.locations.response_sha256,language_catalog_digest:evidence.languages.response_sha256,consumed_credit:evidence.locations.consumed_credit+evidence.languages.consumed_credit,authentication_required:false,external_acquisition_triggered:false,policy:"retained-public-search-metadata.v1"};
