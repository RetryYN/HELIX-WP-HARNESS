const collator=new Intl.Collator("ja",{numeric:true,sensitivity:"base"});
export const filterStateKey=(id)=>`f.${id}`;
export const sortStateKey=(tableKey)=>`sort.${tableKey}`;
export function sortValue(text){const value=String(text??"").normalize("NFKC").trim(),numeric=value.replaceAll(",","").replace(/^[¥￥$]/u,"").replace(/(?:%|位|件|語|秒|記事|field)$/u,"").trim();if(/^[-+]?\d+(?:\.\d+)?$/u.test(numeric))return{kind:"number",value:Number(numeric)};return{kind:"text",value}}
export function compareCellText(left,right,direction="asc"){const a=sortValue(left),b=sortValue(right),result=a.kind==="number"&&b.kind==="number"?a.value-b.value:collator.compare(String(a.value),String(b.value));return direction==="desc"?-result:result}
export function parseSortState(value){const match=/^(\d+):(asc|desc)$/u.exec(String(value??""));return match?{column:Number(match[1]),direction:match[2]}:null}
