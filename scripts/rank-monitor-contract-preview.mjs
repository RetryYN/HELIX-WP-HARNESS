import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function previewRankMonitorContracts(rows,{device="desktop",locationCode=null}={}){
  if(!["desktop","mobile"].includes(device))throw new Error("device must be desktop or mobile");
  if(locationCode!=null&&(!Number.isInteger(locationCode)||locationCode<=0))throw new Error("location_code must be a positive integer");
  return rows.map((row)=>{
    const observed=row.coverage_contracts?.find((item)=>item.evidence_state==="retained_observation")??row.contract,requestedLocation=locationCode??observed.location_code,locationExplicit=locationCode!=null,locationChanged=requestedLocation!==observed.location_code;
    const contract={location_code:requestedLocation,language_code:observed.language_code,se_domain:observed.se_domain,device,os:device==="mobile"?"android":observed.os??null};
    const base={site_id:row.site_id,group_id:row.group_id,keyword:row.keyword,source_task_id:row.source_task_id,target:row.target,contract,device_evidence_state:device===observed.device?"retained_observation":"planned_unobserved_variant",location_evidence_state:locationChanged?"user_supplied_unverified_provider_code":"retained_observation",location_code_explicit:locationExplicit,regional_variant:locationChanged,contract_review_state:locationChanged&&!locationExplicit?"blocked_location_code_required":"ready_for_registration_review",registration_state:"preview_only_not_registered",external_acquisition_triggered:false,auto_registration:false,policy:"rank-monitor-contract-preview.v1"};
    return{...base,preview_digest:digest(base)};
  });
}
