# キーワード正規化・同一 SERPs グルーピング PoC

- 実施日: 2026-08-23
- 判定: **PASS（限定スコープ）**
- 実データ: PO 提供 Excel 2 ファイルの8 KW
- API: DataForSEO Google organic、standard queue、日本、ja、desktop
- 実行証跡: `artifacts/poc/keyword-serp/result.json` と同ディレクトリの `raw/`

## 成立したこと

1. Excel のファイル digest・シート・行に結びつく `source_keyword_id` を DFS task の tag として渡し、
   raw 応答まで逆引きできた。
2. NFKC、前後空白除去、連続空白統一、case fold による正規化が決定論で動作した。
3. 各 KW の organic 上位5 URLを比較し、**一致率が80%を超える**場合だけ
   `likely_same_intent=true` とした。5件揃わない結果は比較不能とする。
4. 実データの `it 就活サイト` と `it 就活 サイト` は5/5 URL一致（100%）となり、
   1記事が保有する main KW + sub KW 群へ投影できた。
5. 記事作成時の coverage gate はNFKC等に加えて空白を除いた比較形を使い、main/sub KWごとに
   present/missing を返せた。表記上の空白差だけでは欠落扱いにしない。

## 判定規則

`一致率 = 共通URL数 / 5`

- `> 0.8`: 同一検索意図に内包される可能性が高い。記事 KW 群の候補にする。
- `<= 0.8`: 自動的にはまとめない。
- 上位 organic が双方5件未満: 比較不能。自動的にはまとめない。

この判定は検索意図の確定ではない。UIでは比較URL、比率、取得日時、task id、raw digestを表示し、
POが分割・統合を上書きできるようにする。

## 実測結果

- 評価対象: 8 KW
- 高確度グループ: 1
- グループ: main `it 就活サイト` / sub `it 就活 サイト`
- 一致: 5/5（100%）
- 最終証跡に含まれる DFS 費用: $0.0048
- ID結合修正とstandard queue timeout再試行を含む、このPoC作業全体のtask post費用: 約 $0.012

## 限界と次工程

- 8 KW のPoCであり、全682 KWの精度を証明しない。
- connected components は A≈B、B≈C の推移結合を起こし得る。全メンバー対の条件にするかは
  truthsetで比較してL3設計時に確定する。
- main KW選定は現在入力順であり、検索Vol・戦略優先度による決定規則が未実装。
- coverage gateは「KWが存在する」最低線であり、自然さ、配置、過剰出現、意図充足は別ゲートとする。
