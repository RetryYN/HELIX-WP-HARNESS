# 意味分類の検証状況

2026-09-05。対象は `scripts/content-semantic-coverage-review.mjs`。

## 実測した問題

`buildContentSemanticCoverageReview` に同一groupのconceptを1件、タイトル候補を1件渡して確認した。
conceptの辞書pathは検証用fixtureであり、実際の検索需要や辞書の正当性を証明するものではない。

| concept | タイトル候補 | 現在のstate | coverage_ratio |
| --- | --- | --- | --- |
| 大学 | 大学院の選び方 | semantic_concept_observed | 1 |
| 大学 | 大学の選び方 | semantic_concept_observed | 1 |
| 仕事 | 仕事をしない選択 | semantic_concept_observed | 1 |
| 銀行 | 銀行と無関係な話 | semantic_concept_observed | 1 |

現在は正規化後の `text.includes(concept.normalized_term)` で判定する。
上記は文字列の出現を検出した結果であり、記事がconceptを説明している証拠ではない。
否定文も対象概念を扱う場合があるため、否定語を一律除外する修正も適切ではない。

`sense_disambiguation_required: true` 等の境界フラグはあるが、
`semantic_concept_observed` と coverage_ratio を意味分類精度や記事の十分性と解釈してはならない。
既存の単体テストは処理契約を確認しており、独立した正解ラベルによる精度検証ではない。

## 修正と評価の要件

1. 語の出現、文脈中の語義、記事での説明充足、同じ記事への統合可否を別々に評価する。
2. 部分一致による出現と単語としての出現を区別する。単語分割のみで語義の正しさを証明しない。
3. 実KWと保持SERPを根拠に、同記事・別記事・関連のみ・判断保留の評価セットを作る。
   ラベルには理由、根拠URL、観測時点、作成者、レビュー状況を付ける。
   自動生成した仮ラベルを独立した正解と呼ばない。
4. 多義語、部分一致、否定、比較、対象読者・地域・時期の違いを含める。
5. 誤統合率、誤分割率、クラス別precision/recall、保留率を測る。
   同じ語群が調整用と評価用の両方に入らないよう分離する。
6. 意味分類の妥当性が確認できるまで、自動記事統合の根拠にcoverage_ratioを使用しない。

判定：意味分類精度は未検証。上記の実測は全体の誤分類率を表さない。
今回の検証で外部API取得・モデル実行は行っていない。
