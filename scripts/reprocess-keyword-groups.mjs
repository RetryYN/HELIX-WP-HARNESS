import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {GROUPING_ALGORITHM,GROUPING_DECISION,buildLatestKeywordGroups,evidenceDigest} from "./keyword-grouping.mjs";

const resultPath=path.resolve(process.argv[2]??"artifacts/poc/keyword-workbook-100-live/result.json");
const evidence=JSON.parse(await readFile(resultPath,"utf8"));
if(!Array.isArray(evidence.tasks)||evidence.tasks.length===0)throw new Error("actual DFS task evidence is required");
const {policyVersion,hierarchy,grouping,articleKeywordGroups}=buildLatestKeywordGroups(evidence.tasks);
const next={...evidence,schema_version:"wp-keyword-serp-poc.v2",keyword_policy_version:policyVersion,grouping:{algorithm:GROUPING_ALGORITHM,decision:GROUPING_DECISION,...grouping},keyword_hierarchy:hierarchy,article_keyword_groups:articleKeywordGroups};
next.reproducibility_digest=evidenceDigest({tasks:next.tasks,algorithm:GROUPING_ALGORITHM,hierarchy,grouping,articleKeywordGroups});
await writeFile(resultPath,`${JSON.stringify(next,null,2)}\n`);
console.log(JSON.stringify({result:resultPath,actual_keywords:next.tasks.length,display_roots:new Set(hierarchy.map((row)=>row.root_source_keyword_id)).size,aliases:hierarchy.filter((row)=>row.relation==="reordered_alias").length,article_keyword_groups:articleKeywordGroups.length,unresolved_groups:articleKeywordGroups.filter((group)=>group.resolution_state==="unresolved").length},null,2));
