import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const flags=["is_image","is_video","is_featured_snippet","is_malicious","is_web_story"];

export function buildSerpPresentationIntegrity(tasks,organicRows){
  const byTask=Map.groupBy(organicRows,(row)=>row.task_id),rows=[];
  for(const task of tasks){
    const organic=(byTask.get(task.task_id)??[]).filter((row)=>row.rank_absolute<=10),anomalies=[];
    for(const row of organic){
      const attributes=row.attributes??row;
      if((attributes.type??"organic")!=="organic")anomalies.push({rank_absolute:row.rank_absolute,code:"unexpected_result_type"});
      if(row.page!==1)anomalies.push({rank_absolute:row.rank_absolute,code:"unexpected_page"});
      if(row.position!=="left")anomalies.push({rank_absolute:row.rank_absolute,code:"unexpected_position"});
      if(!attributes.xpath)anomalies.push({rank_absolute:row.rank_absolute,code:"missing_xpath"});
      const checks=attributes.checks??[];
      for(const flag of flags){if(checks.includes(flag)!==Boolean(attributes[flag]))anomalies.push({rank_absolute:row.rank_absolute,code:"check_flag_mismatch",flag})}
    }
    const counts=Object.fromEntries(flags.map((flag)=>[`${flag}_count`,organic.filter((row)=>Boolean((row.attributes??row)[flag])).length]));
    const ampCount=organic.filter((row)=>Boolean((row.attributes??row).amp_version)).length,record={site_id:task.site_id,group_id:task.group_id,task_id:task.task_id,keyword:task.keyword,observed_at:task.observed_at,organic_top10_count:organic.length,...counts,amp_version_count:ampCount,xpath_variant_count:new Set(organic.map((row)=>(row.attributes??row).xpath).filter(Boolean)).size,anomaly_count:anomalies.length,anomalies,integrity_state:anomalies.length?"review_required":"verified",interpretation_policy:"true_is_observed_format_false_is_not_proof_of_absence",auto_mutation:false,external_acquisition_triggered:false,policy:"serp-presentation-integrity.v1"};
    rows.push({...record,evidence_digest:digest(record)});
  }
  return rows.sort((a,b)=>a.site_id.localeCompare(b.site_id)||a.keyword.localeCompare(b.keyword,"ja")||a.task_id.localeCompare(b.task_id));
}
