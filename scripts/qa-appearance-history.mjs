import {createHash} from "node:crypto";
import {qaSourceForDomain} from "./retained-qa-site-evidence.mjs";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildQaAppearanceHistory(comparisons){
  const rows=[];
  for(const comparison of comparisons)for(const movement of comparison.url_rank_changes??[]){
    const qaSource=qaSourceForDomain(movement.domain);if(!qaSource)continue;
    const base={site_id:comparison.site_id,group_id:comparison.group_id,keyword:comparison.keyword,qa_source:qaSource,domain:movement.domain,url:movement.url,state:movement.state,previous_rank:movement.previous_rank,current_rank:movement.current_rank,rank_delta:movement.rank_delta,previous_title:movement.previous_title,current_title:movement.current_title,title_changed:movement.title_changed,previous_observation_state:movement.previous_observation_state,current_observation_state:movement.current_observation_state,previous_observed_depth:movement.previous_observed_depth,current_observed_depth:movement.current_observed_depth,previous_observed_at:comparison.previous_observed_at,current_observed_at:comparison.current_observed_at,contract_match:comparison.contract_match,confirmed_unranked:false,absence_interpretation:movement.state==="retained"?null:"outside_observed_set_unknown_rank",answer_text_retained:false,external_acquisition_triggered:false,policy:"qa-appearance-history.v1"};rows.push({...base,evidence_digest:digest(base)});
  }
  rows.sort((a,b)=>a.keyword.localeCompare(b.keyword,"ja")||a.state.localeCompare(b.state)||a.url.localeCompare(b.url));
  return{rows,summary:{comparison_keyword_count:new Set(rows.map((row)=>row.keyword)).size,appearance_count:rows.length,retained_count:rows.filter((row)=>row.state==="retained").length,entered_observed_depth_count:rows.filter((row)=>row.state==="entered_observed_depth").length,exited_observed_depth_count:rows.filter((row)=>row.state==="exited_observed_depth").length,title_changed_count:rows.filter((row)=>row.title_changed).length,confirmed_unranked_count:0,answer_text_retained:false,external_acquisition_triggered:false},policy:"qa-appearance-history.v1",absence_confirms_unranked:false,external_acquisition_triggered:false};
}
