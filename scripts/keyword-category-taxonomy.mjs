import { normalizeKeyword } from "./keyword-serp-core.mjs";

export const wpCategoryTaxonomy = [
  { id: 1, name: "IT就活", slug: "it-shukatu", parent: 0 },
  { id: 3, name: "IT就活エージェント", slug: "it-shukatu-agent", parent: 0 },
  { id: 5, name: "就活対策", slug: "job-hunting-measures", parent: 0 },
  { id: 6, name: "キャリア", slug: "career", parent: 5 },
  { id: 9, name: "面接対策", slug: "interview-preparation", parent: 5 },
  { id: 10, name: "文系就活", slug: "liberal-arts", parent: 1 },
  { id: 11, name: "SNS", slug: "sns", parent: 5 },
  { id: 12, name: "就活サービス一覧", slug: "shukatu-service-list", parent: 3 },
  { id: 19, name: "IT業界研究", slug: "it-industry-research", parent: 0 },
  { id: 20, name: "IT業界分析", slug: "it-industry-analysis", parent: 19 },
  { id: 22, name: "就活サービスの噂", slug: "shukatu-service-gossip", parent: 3 },
  { id: 25, name: "IT職種分析", slug: "it-profession-analysis", parent: 19 },
  { id: 27, name: "ITエンジニア就活", slug: "it-engineer-shukatu", parent: 1 },
  { id: 29, name: "比較・ランキング", slug: "ranking", parent: 3 },
  { id: 30, name: "IT企業分析", slug: "it-company-analysis", parent: 19 },
  { id: 35, name: "理系就活", slug: "science", parent: 1 },
  { id: 37, name: "ガクチカ", slug: "gakuchika", parent: 5 },
];

const includesAny = (text, terms) => terms.some((term) => text.includes(term));

export function categoryPathForKeywords(keywords) {
  const text = keywords.map(normalizeKeyword).join(" ");
  if (text.includes("文系")) return ["IT就活", "文系就活"];
  if (text.includes("理系")) return ["IT就活", "理系就活"];
  if (includesAny(text, ["ポートフォリオ", "成果物", "エンジニア", "専門学校", "未経験"])) return ["IT就活", "ITエンジニア就活"];
  if (includesAny(text, ["面接", "逆質問"])) return ["就活対策", "面接対策"];
  if (includesAny(text, ["ツイッター", "twitter", "sns"])) return ["就活対策", "SNS"];
  if (text.includes("ガクチカ")) return ["就活対策", "ガクチカ"];
  if (includesAny(text, ["キャリアプラン", "将来の夢", "入社後", "やりたいこと", "5年後", "10年後", "就活の軸"])) return ["就活対策", "キャリア"];
  if (includesAny(text, ["企業", "メーカー", "外資", "ベンチャー", "倍率", "偏差値", "難易度"])) return ["IT業界研究", "IT企業分析"];
  if (text.includes("職種")) return ["IT業界研究", "IT職種分析"];
  if (includesAny(text, ["ニュース", "業界", "it系"])) return ["IT業界研究", "IT業界分析"];
  if (includesAny(text, ["クチコミ", "口コミ", "なんj", "2ch", "評判", "噂"])) return ["IT就活エージェント", "就活サービスの噂"];
  if (includesAny(text, ["ランキング", "比較"])) return ["IT就活エージェント", "比較・ランキング"];
  if (includesAny(text, ["エージェント", "就活サイト", "就活 サイト", "タイムズ", "就活ツール", "就活ネット", "就活イベント"])) return ["IT就活エージェント", "就活サービス一覧"];
  if (includesAny(text, ["志望動機", "自己pr", "筆記試験", "適性検査", "一般常識", "小論文", "作文", "髪型", "スーツ", "suit"])) return ["就活対策"];
  return ["IT就活"];
}
