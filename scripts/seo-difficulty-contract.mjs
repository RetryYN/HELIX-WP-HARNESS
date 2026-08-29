export function classifySeoDifficulty(value){
  if(value==null)return{difficulty_band:"missing",difficulty_present:false};
  if(!Number.isInteger(value)||value<0||value>100)throw new RangeError("SEO difficulty must be an integer from 0 to 100");
  return{difficulty_band:value===0?"zero_observed":value<=33?"low":value<=66?"medium":"high",difficulty_present:true};
}
export function summarizeSeoDifficulty(rows){const counts={missing:0,zero_observed:0,low:0,medium:0,high:0};for(const row of rows)counts[row.difficulty_band]++;return{observed_count:rows.length,band_counts:counts,scale:{minimum:1,maximum:100,low:[1,33],medium:[34,66],high:[67,100]},zero_semantics:"observed_zero_separate_from_missing",relative_metric_only:true,ranking_outcome_guaranteed:false,external_acquisition_triggered:false,policy:"seo-difficulty-contract.v1"}}
