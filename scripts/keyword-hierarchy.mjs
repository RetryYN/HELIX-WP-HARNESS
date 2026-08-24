import {tokenizeMatchText} from "./keyword-article-matching.mjs";
import {contextAnchors,modifierTerms} from "./keyword-policy.mjs";

const counts=(tokens)=>tokens.reduce((map,token)=>map.set(token,(map.get(token)??0)+1),new Map());
const subset=(left,right)=>[...left].every(([token,count])=>(right.get(token)??0)>=count);
const key=(tokens)=>[...tokens].sort((a,b)=>a.localeCompare(b,"ja")).join("\0");
const modifierTokenSequences=modifierTerms.map((modifier)=>tokenizeMatchText(modifier));
const hasTrailingModifier=(row)=>modifierTokenSequences.some((sequence)=>sequence.length<=row.tokens.length&&sequence.every((token,offset)=>row.tokens[row.tokens.length-sequence.length+offset]===token));
const contextScope=(row)=>`context:${contextAnchors.filter((anchor)=>row.terms.has(anchor)).join("+")||"general"}`;

export function buildKeywordHierarchy(rows){
  const prepared=rows.map((row,index)=>{const tokens=tokenizeMatchText(row.raw_keyword??row.keyword);return{...row,index,tokens,term_count:tokens.length,term_key:key(tokens),terms:counts(tokens)}});
  const representatives=new Map();
  for(const row of prepared){const current=representatives.get(row.term_key);if(!current||Number(row.search_volume??0)>Number(current.search_volume??0)||(Number(row.search_volume??0)===Number(current.search_volume??0)&&row.index<current.index))representatives.set(row.term_key,row)}
  const concepts=[...representatives.values()];
  const documentFrequency=new Map();
  for(const row of concepts)for(const token of new Set(row.tokens))documentFrequency.set(token,(documentFrequency.get(token)??0)+1);
  for(const row of concepts)row.tree_path=[...row.tokens].sort((left,right)=>(documentFrequency.get(right)??0)-(documentFrequency.get(left)??0)||row.tokens.indexOf(left)-row.tokens.indexOf(right));
  const conceptByPath=new Map(concepts.map((row)=>[row.tree_path.join("\0"),row]));
  const parentByKey=new Map();
  for(const child of concepts){
    let parent=null;
    for(let length=child.tree_path.length-1;length>0;length-=1){const candidate=conceptByPath.get(child.tree_path.slice(0,length).join("\0"));if(candidate&&!hasTrailingModifier(candidate)){parent=candidate;break}}
    parentByKey.set(child.term_key,parent);
  }
  const depthFor=(row,seen=new Set())=>{const parent=parentByKey.get(row.term_key);if(!parent)return 0;if(seen.has(row.term_key))throw new Error(`keyword hierarchy cycle: ${row.raw_keyword??row.keyword}`);return 1+depthFor(parent,new Set([...seen,row.term_key]))};
  const rootFor=(row)=>conceptByPath.get(row.tree_path.slice(0,1).join("\0"))??{source_keyword_id:`derived:${row.tree_path[0]}`,raw_keyword:row.tree_path[0],keyword:row.tree_path[0]};
  return prepared.map((row)=>{const representative=representatives.get(row.term_key),parent=parentByKey.get(row.term_key),root=rootFor(representative);return{source_keyword_id:row.source_keyword_id,keyword:row.raw_keyword??row.keyword,normalized_terms:row.tokens,normalized_keyword:row.tokens.join(" "),tree_path:representative.tree_path,term_count:row.term_count,relation:representative.source_keyword_id===row.source_keyword_id?(representative.tree_path.length===1?"root":"child"):"reordered_alias",representative_source_keyword_id:representative.source_keyword_id,parent_source_keyword_id:parent?.source_keyword_id??null,parent_keyword:parent?.raw_keyword??parent?.keyword??null,root_source_keyword_id:root.source_keyword_id,root_keyword:root.raw_keyword??root.keyword,context_scope_id:contextScope(row),depth:representative.tree_path.length-1}});
}
