# キーワード正規化・同一 SERPs グルーピング PoC

- 実施日: 2026-08-23
- 判定: **PASS（限定スコープ）**
- 実データ: PO 提供 Excel 2 ファイルの8 KW
- API: DataForSEO Google organic、standard queue、日本、ja、desktop
- 実行証跡の正本: `artifacts/poc/keyword-workbook-100-live/result.json` と同ディレクトリの `raw/`
- 旧8KW評価経路 `scripts/evaluate-keyword-serp.mjs` は廃止し、100実KWの取得・分類結果へ一本化した。

## 成立したこと

1. Excel のファイル digest・シート・行に結びつく `source_keyword_id` を DFS task の tag として渡し、
   raw 応答まで逆引きできた。
2. NFKC、前後空白除去、連続空白統一、case fold による正規化が決定論で動作した。
3. 各 KW の organic 上位5 URLを比較し、**80%以上をhigh、60%以上80%未満をpossible**として
   `likely_same_intent=true` とした。5件揃わない結果は比較不能とする。
4. 実データの `it 就活サイト` と `it 就活 サイト` は5/5 URL一致（100%）となったが、これは
   空白差を吸収すると同じ正規化語になるため、main/sub KW 群ではなく normalization alias とした。
5. 記事作成時の coverage gate はNFKC等に加えて空白を除いた比較形を使い、main/sub KWごとに
   present/missing を返せた。表記上の空白差だけでは欠落扱いにしない。

## 判定規則

`一致率 = 共通URL数 / 5`

- `>= 0.8`: `high`。同一検索意図に内包される高確度候補。
- `>= 0.6` かつ `< 0.8`: `possible`。同一検索意図に内包される可能性あり。
- `< 0.6`: `separate`。自動的にはまとめない。
- 上位 organic が双方5件未満: 比較不能。自動的にはまとめない。

この判定は検索意図の確定ではない。UIでは比較URL、比率、取得日時、task id、raw digestを表示し、
POが分割・統合を上書きできるようにする。

## 実測結果

- 評価対象: 8 KW
- normalization alias: `it 就活サイト` / `it 就活 サイト`（5/5一致だが同一正規化語）
- 同一施策KW群: 1（`ライター 副業` + `記事作成 副業`、3/5 URL一致=60%、confidence possible。
  main は検索Vol最大の `ライター 副業` を採用）
- 80%以上（high）のみの群: 0
- 最終証跡に含まれる DFS 費用: $0.0048
- ID結合修正とstandard queue timeout再試行を含む、このPoC作業全体のtask post費用: 約 $0.012

## 限界と次工程

- 8 KW のPoCであり、全682 KWの精度を証明しない。
- クラスタ統合は complete-linkage（全メンバー対が60%以上の場合のみ統合）へ確定し、
  connected components の推移結合（A≈B、B≈C で A・C 不一致）を排除した。60%ブリッジが
  20%ペアを統合しないことは決定論テストで固定。truthset との精度比較は L3 設計時に行う。
- main KW選定は derived_parent → 検索Vol最大（修飾語付きは除外）の順で決定するが、
  検索Volは一部KWのscript内ハードコードであり、Excel/DFS からの取り込みは未実装。
- coverage gateは「KWが存在する」最低線であり、自然さ、配置、過剰出現、意図充足は別ゲートとする。

## 修飾語ペアの追加実測

`it 就活サイト おすすめ` と `it 就活サイト 比較` を別のDFS standard taskとして取得し、
同じ上位5件規則で比較した。結果は4/5 URL一致、比率0.8だった。

- 現規則 `>= 0.8`: **highとして同じ1記事の内包キーワード候補になる**。

証跡は `artifacts/poc/keyword-serp-intent-pair/` に保存した。境界演算子はSEO施策へ直接影響するため、
PO訂正により、80%以上をhigh、60%以上80%未満をpossibleとして候補化する。
