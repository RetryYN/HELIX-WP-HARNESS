import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const textValue=(value)=>typeof value==="string"?value:null;

export function normalizeSerpFeatureItems(features){
  const items=[],links=[];
  for(const feature of features){
    for(const [itemOrder,value] of (feature.payload?.items??[]).entries()){
      const payload=typeof value==="string"?{value}:value??{},itemType=typeof value==="string"?"text":payload.type??"unknown",itemId=digest({feature_id:feature.feature_id,item_order:itemOrder,item_type:itemType,payload});
      const row={feature_item_id:itemId,feature_id:feature.feature_id,task_id:feature.task_id,group_id:feature.group_id,feature_type:feature.feature_type,item_order:itemOrder,item_type:itemType,text:textValue(value)??payload.text??null,title:payload.title??null,alt:payload.alt??null,source:payload.source??null,url:payload.url??null,image_url:payload.image_url??null,published_at:payload.timestamp??null,payload};
      row.evidence_digest=digest(row);items.push(row);
      for(const [linkOrder,link] of (payload.links??[]).entries()){
        const linkRow={link_id:digest({feature_item_id:itemId,link_order:linkOrder,link}),feature_item_id:itemId,link_order:linkOrder,title:link.title??null,url:link.url??null,domain:link.domain??null,description:link.description??null,payload:link};linkRow.evidence_digest=digest(linkRow);links.push(linkRow);
      }
    }
  }
  return{items,links};
}
