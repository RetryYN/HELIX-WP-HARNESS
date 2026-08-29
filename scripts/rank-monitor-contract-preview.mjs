import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function previewRankMonitorContracts(rows,{device="desktop",locationCode=null,locationName=null,languageName=null}={}){
  if(!["desktop","mobile"].includes(device))throw new Error("device must be desktop or mobile");
  if(locationCode!=null&&(!Number.isInteger(locationCode)||locationCode<=0))throw new Error("location_code must be a positive integer");
  return rows.map((row)=>{
    const observed=row.coverage_contracts?.find((item)=>item.evidence_state==="retained_observation")??row.contract,requestedLocation=locationCode??observed.location_code,locationExplicit=locationCode!=null,locationChanged=requestedLocation!==observed.location_code,requestedLocationName=locationName??"Japan",requestedLanguageName=languageName??"Japanese",regionalName=requestedLocationName!=="Japan",foreignLanguage=requestedLanguageName!=="Japanese",nameCodeMappingState=regionalName?(locationExplicit?"user_supplied_unverified_name_code_pair":"blocked_missing_provider_code_for_location_name"):locationChanged?"user_supplied_unverified_provider_code":"retained_japan_mapping",languageMappingState=foreignLanguage?"blocked_missing_internal_language_code_mapping":"retained_japanese_mapping",blocked=nameCodeMappingState.startsWith("blocked_")||languageMappingState.startsWith("blocked_");
    const contract={location_code:requestedLocation,location_name:requestedLocationName,language_code:observed.language_code,language_name:requestedLanguageName,se_domain:observed.se_domain,device,os:device==="mobile"?"android":observed.os??null};
    const base={site_id:row.site_id,group_id:row.group_id,keyword:row.keyword,source_task_id:row.source_task_id,target:row.target,contract,device_evidence_state:device===observed.device?"retained_observation":"planned_unobserved_variant",location_evidence_state:locationChanged?"user_supplied_unverified_provider_code":"retained_observation",public_location_validation_state:"retained_catalog_validated",public_language_validation_state:"retained_catalog_validated",location_code_mapping_state:nameCodeMappingState,language_code_mapping_state:languageMappingState,location_code_explicit:locationExplicit,regional_variant:locationChanged||regionalName,contract_review_state:blocked?"blocked_unverified_metadata_mapping":"ready_for_registration_review",registration_state:"preview_only_not_registered",external_acquisition_triggered:false,auto_registration:false,policy:"rank-monitor-contract-preview.v2"};
    return{...base,preview_digest:digest(base)};
  });
}
