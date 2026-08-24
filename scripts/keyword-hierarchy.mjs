import {tokenizeMatchText} from "./keyword-article-matching.mjs";
import {contextAnchors} from "./keyword-policy.mjs";
import {modifierTerms} from "./keyword-policy.mjs";

const counts=(tokens)=>tokens.reduce((map,token)=>map.set(token,(map.get(token)??0)+1),new Map());
const subset=(left,right)=>[...left].every(([token,count])=>(right.get(token)??0)>=count);
const key=(tokens)=>[...tokens].sort((a,b)=>a.localeCompare(b,"ja")).join("\0");
// These terms change the search domain rather than merely narrowing a topic.
// A parent candidate must retain the same context boundary.
const sameContext=(left,right)=>contextAnchors.every((anchor)=>left.terms.has(anchor)===right.terms.has(anchor));
const modifierTokenSequences=modifierTerms.map((modifier)=>tokenizeMatchText(modifier));
const hasTrailingModifier=(row)=>modifierTokenSequences.some((sequence)=>sequence.length<=row.tokens.length&&sequence.every((token,offset)=>row.tokens[row.tokens.length-sequence.length+offset]===token));

export function buildKeywordHierarchy(rows){
  const prepared=rows.map((row,index)=>{const tokens=tokenizeMatchText(row.raw_keyword??row.keyword);return{...row,index,tokens,term_count:tokens.length,term_key:key(tokens),terms:counts(tokens)}});
  const representatives=new Map();
  for(const row of prepared){const current=representatives.get(row.term_key);if(!current||Number(row.search_volume??0)>Number(current.search_volume??0)||(Number(row.search_volume??0)===Number(current.search_volume??0)&&row.index<current.index))representatives.set(row.term_key,row)}
  const concepts=[...representatives.values()];
  const parentByKey=new Map();
  for(const child of concepts){
    const candidates=concepts.filter((candidate)=>!hasTrailingModifier(candidate)&&candidate.term_count<child.term_count&&sameContext(candidate,child)&&subset(candidate.terms,child.terms)).sort((left,right)=>right.term_count-left.term_count||Number(right.search_volume??0)-Number(left.search_volume??0)||left.index-right.index);
    parentByKey.set(child.term_key,candidates[0]??null);
  }
  const depthFor=(row,seen=new Set())=>{const parent=parentByKey.get(row.term_key);if(!parent)return 0;if(seen.has(row.term_key))throw new Error(`keyword hierarchy cycle: ${row.raw_keyword??row.keyword}`);return 1+depthFor(parent,new Set([...seen,row.term_key]))};
  const rootFor=(row)=>{let current=representatives.get(row.term_key);while(parentByKey.get(current.term_key))current=parentByKey.get(current.term_key);return current};
  return prepared.map((row)=>{const representative=representatives.get(row.term_key),parent=parentByKey.get(row.term_key),root=rootFor(row);return{source_keyword_id:row.source_keyword_id,keyword:row.raw_keyword??row.keyword,normalized_terms:row.tokens,term_count:row.term_count,relation:representative.source_keyword_id===row.source_keyword_id?(parent?"child":"root"):"reordered_alias",representative_source_keyword_id:representative.source_keyword_id,parent_source_keyword_id:parent?.source_keyword_id??null,parent_keyword:parent?.raw_keyword??parent?.keyword??null,root_source_keyword_id:root.source_keyword_id,root_keyword:root.raw_keyword??root.keyword,depth:depthFor(row)}});
}
