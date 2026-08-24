export const KEYWORD_POLICY_VERSION="ja-seo-keyword-policy.v2";
export const contextAnchors=Object.freeze(["it"]);
export const modifierTerms=Object.freeze(["おすすめ","比較","ランキング","口コミ","評判","選び方","方法"]);
export const genericMatchTokens=Object.freeze(["it","就活","新卒","方法"]);
export const lexicalReplacements=Object.freeze([["ねくたい","ネクタイ"]]);
export const compoundTerms=Object.freeze(["難易度","偏差値","成果物","自己pr","なんj","2ch","未経験","キャリアプラン","5年後","10年後"]);
export const keywordDisplayText=(rawKeyword,normalizedTerms)=>{const raw=String(rawKeyword??"").normalize("NFKC").toLowerCase();return normalizedTerms.map((term)=>lexicalReplacements.find(([source,normalized])=>normalized.toLowerCase()===term&&raw.includes(source))?.[0]??term).join(" ")};
