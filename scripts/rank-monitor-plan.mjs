import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const iso=(value)=>new Date(value).toISOString();
const addDays=(value,days)=>new Date(new Date(value).getTime()+days*864e5).toISOString();

export function buildRankMonitorPlan(site,reuseRows,comparisons,{cadenceDays=7,targetDays=120,requestedDepth=100}={}){
  const current=reuseRows.filter((row)=>row.reuse_state==="current_analysis"&&row.inventory?.keyword),comparisonByCurrent=new Map(comparisons.map((row)=>[row.current_task_id,row]));
  const targetObservationCount=Math.ceil(targetDays/cadenceDays)+1;
  const rows=current.map((row)=>{
    const comparison=comparisonByCurrent.get(row.task_id),observedAt=iso(row.inventory.observed_at),observationCount=comparison?2:1,observedDepth=comparison?.current_observed_depth??null;
    const base={site_id:site.site_id,target:site.domain,match_mode:"domain",group_id:row.group_id,keyword:row.inventory.keyword,source_task_id:row.task_id,latest_observed_at:observedAt,observation_count:observationCount,target_observation_count:targetObservationCount,remaining_observation_count:Math.max(0,targetObservationCount-observationCount),cadence_days:cadenceDays,target_window_days:targetDays,next_due_at:addDays(observedAt,cadenceDays),requested_depth:requestedDepth,latest_observed_depth:observedDepth,history_state:observationCount>=targetObservationCount?"window_satisfied":"insufficient_history",registration_state:"plan_only_not_registered",acquisition_state:"not_executed",absence_policy:"not_observed_within_depth_is_not_unranked",contract:{location_code:row.location_code,language_code:row.language_code,se_domain:row.se_domain},external_acquisition_triggered:false,auto_registration:false,policy:"rank-monitor-plan.v1"};
    return{...base,evidence_digest:digest(base)};
  }).sort((a,b)=>a.next_due_at.localeCompare(b.next_due_at)||a.keyword.localeCompare(b.keyword,"ja"));
  return{rows,summary:{candidate_count:rows.length,registered_count:0,executed_count:0,insufficient_history_count:rows.filter((row)=>row.history_state==="insufficient_history").length,keywords_with_two_observations_count:rows.filter((row)=>row.observation_count>=2).length,keywords_with_120_day_window_count:rows.filter((row)=>row.history_state==="window_satisfied").length,target_observation_count:targetObservationCount,cadence_days:cadenceDays,target_window_days:targetDays,requested_depth:requestedDepth,external_acquisition_triggered:false,auto_registration:false},policy:"rank-monitor-plan.v1"};
}
