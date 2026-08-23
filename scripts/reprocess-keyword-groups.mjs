import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {digest} from "./keyword-serp-core.mjs";
import {buildLatestKeywordGroups} from "./keyword-grouping.mjs";

const resultPath=path.resolve(process.argv[2]??"artifacts/poc/keyword-workbook-100-live/result.json");
const evidence=JSON.parse(await readFile(resultPath,"utf8"));
if(!Array.isArray(evidence.tasks)||evidence.tasks.length===0)throw new Error("actual DFS task evidence is required");
const {policyVersion,hierarchy,grouping,articleKeywordGroups}=buildLatestKeywordGroups(evidence.tasks);
const next={...evidence,schema_version:"wp-keyword-serp-poc.v2",keyword_policy_version:policyVersion,grouping:{algorithm:"normalized-context-hierarchy-top5-complete-linkage.v4",decision:"形態素正規化と語順alias統合、文脈root境界、語数ツリーを先に確定する。同じroot内の代表KWだけを比較し、上位5 URL一致率60%以上を同一施策KW群、80%以上をhighとする。修飾語だけの群は最寄りの実在親施策へ内包する。",...grouping},keyword_hierarchy:hierarchy,article_keyword_groups:articleKeywordGroups};
next.reproducibility_digest=digest({snapshots:next.tasks.map(({source_keyword_id,response_digest})=>({source_keyword_id,response_digest})),algorithm:next.grouping.algorithm,hierarchy,grouping,articleKeywordGroups});
await writeFile(resultPath,`${JSON.stringify(next,null,2)}\n`);
console.log(JSON.stringify({result:resultPath,actual_keywords:next.tasks.length,roots:hierarchy.filter((row)=>row.relation==="root").length,aliases:hierarchy.filter((row)=>row.relation==="reordered_alias").length,article_keyword_groups:articleKeywordGroups.length},null,2));
