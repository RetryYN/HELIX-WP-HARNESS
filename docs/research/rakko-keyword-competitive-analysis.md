---
artifact_id: WP-RESEARCH-RAKKO-COMPETITIVE-20260826
status: in-progress
evidence_cutoff: 2026-08-26
scope: public-product-research-and-reproducible-inference
---

# ラッコキーワード競合機能・推定処理台帳

## 1. 目的と調査境界

ラッコキーワードの公開機能、公開 API、公式マニュアルの入出力を棚卸しし、
`HELIX-WP-HARNESS` の SEO 分析基盤が同等機能を再現したうえで、site固有証跡、決定理由、
継続観測、WordPress実記事との閉ループで上回るための差分台帳とする。

認証回避、非公開 API の探索、利用規約に反する取得、実装コードの複製は行わない。
「DataForSEOを内部利用している」という直接証拠は現時点でないため断定しない。
公開出力と DataForSEO 公式 API のデータ形状が対応する場合も、`compatible` または
`high-confidence inference` と記録し、provider provenance の確証とは分ける。

## 2. 根拠クラス

| class | 意味 |
|---|---|
| `confirmed-public` | ラッコ公式ページまたは公開OpenAPIに明記 |
| `dfs-compatible` | DataForSEO公式APIだけで主要入力を再現可能 |
| `inferred-transform` | 公開出力から推定できる集計・正規化・ranking処理 |
| `unknown-provider` | 同等データ源が複数ありproviderを特定できない |
| `helix-implemented` | 現行リポジトリで実装・テスト済み |
| `helix-gap` | 現行リポジトリに未実装または証跡不足 |

## 3. 公開API inventory（2026-08-26）

公開 OpenAPI は24 operation、41 schemaを持つ。`scripts/refresh-rakko-openapi-inventory.mjs` が
公開Swaggerからsnapshotを保存し、952 nested fieldをflattenして全operationへ実装状態・DFS候補・推論確度・gapを割り当てる。
`scripts/test-rakko-openapi-inventory.mjs` は未割当operation、古いmapping、schema/field欠落をfailさせる。

- 正本snapshot: `docs/research/evidence/rakko-openapi.json`
- field inventory: `docs/research/rakko-openapi-inventory.json`
- 判断台帳: `docs/research/rakko-capability-decisions.json`
- snapshot SHA-256: `9787b2c19662e9b1946ae1fa4de539f4f8e1493f47b5a220d58410e011fe2573`

機能operationは次の18系統で、非同期機能には登録・status・results・history・SERP detailが追加される。

| 公開API | 公開上の処理 | 推定入力層 | 現行HELIX |
|---|---|---|---|
| `POST /v1/suggest-keywords` | 複数検索面のsuggest、最大約1万件 | suggest各社API/収集DB、SEO指標DB | gap |
| `POST /v1/related-keywords` | 部分一致DB検索、最大2.5万件 | 独自蓄積index + metrics | gap |
| `POST /v1/other-keywords` | LSI/PAAを最大2階層再帰取得 | Google SERP recursion | 1階層rawあり、再帰/importance gap |
| `POST /v1/question-search` | 質問DBを相対需要順に最大1,000件 | 蓄積質問index | gap |
| `POST /v1/ranking-keywords` | 上位ページの同時rank KW、最大5,000件 | rank database / page intersection | 100KW×上位10のpage-keyword graph実装。rank DB gap |
| `POST /v1/search-volume` | volume、月次推移、CPC、競合性、SEO難易度 | Google Ads + SERP/link metrics | 一部取込のみ、取得pipeline gap |
| `POST /v1/influx-keywords` | domain/URL別rank KW、推定流入 | ranked keywords DB | 観測100KW内のdomain/page→KW・順位逆引き実装。全rank DB・traffic/value/history gap |
| `POST /v1/influx-pages` | 集客page、KW数、traffic value | relevant/ranked pages DB | 観測565 pageのKW/group/rank/top-KW集計とUI実装。全rank DB・traffic/value/history gap |
| `POST /v1/competitive` | rank KW重複による競合domain | competitors/domain intersection | 観測100KW内で225競合、107複数KW、78複数記事群を実装。全rank DB・traffic/value gap |
| `POST /v1/bulk-site-research` | 最大100 URLの規模・推移比較 | domain metrics history | gap |
| `POST /v1/content-search` | title/description/top KWによるpage検索 | full-text page/rank index | 取得成功180 pageのtitle/H1-H6/SERP description/観測KW検索とrank逆引き実装。全page/traffic gap |
| `POST /v1/headline` | Google上位pageのH1-H6・文字数・平均 | SERP + page parsing | 上位3page実測・6,887 heading。上位20/除外条件 gap |
| `POST /v1/co-occurrence` | 上位20pageの本文/title/heading頻出語 | SERP + page parsing + token statistics | task/group別実装済み。上位20/getDetails互換 gap |
| `POST /v1/search-rank` | 指定site/KWの最新順位とSERP | live/queued SERP | raw SERPあり。継続rank tracking gap |
| `POST /v1/site-search` | contentとdomain metricsによるsite検索 | domain/content index | gap |
| metadata locations | region contract | provider metadata | location code固定のみ |
| metadata languages | language contract | provider metadata | `ja`固定のみ |
| AI生成群（Web UI） | title、heading、body、questions、related KW | SERP/heading/co-occurrence + LLM | evidence-bound title/heading 642候補。LLM/body gap |

### 3.1 Web UI・料金・運用inventory

API外を含む公開機能は `docs/research/rakko-web-capability-inventory.json` に34 capabilityとして整理した。
各行にinput、output、公開上限、credit、履歴、export、推定provider層、HELIX状態、gapを必須化している。
`scripts/test-rakko-web-capability-inventory.mjs` が主要34 IDの欠落と未記入fieldを検出する。

料金と課金条件は `docs/research/rakko-pricing-policy.json` に分離した。確認できた現行planはfree、entry、light、
standard、pro、enterpriseの6つ。年払い時の月額は順に0、660、990、2,475、4,950、9,900円で、
月払いは0、1,320、1,980、4,950、9,900、19,800円。動的料金表から確認できたcreditは
free 50/週、entry 400/月、light 1,000/月、standard 3,000/月であり、pro/enterpriseの割当量は
今回保存した公開根拠だけでは確定できないためnullのまま残した。

課金は「Webの結果表示成功」「API/MCPのデータ取得成功」が基本で、API/MCPは原則Web基準の1.5倍。
0件、1時間以内の同一keyword再検索、error、残高不足、表示前cancelはWebで原則非消費だが、
一括キーワード調査・検索順位チェックは取得実行時、site-searchはfilter変更時に消費する例外がある。
copy/CSV/JSON downloadと通常filter/sortは非消費である。

## 4. DataForSEO対応仮説

### 4.1 高い対応があるもの

| ラッコ出力 | DataForSEO候補 | 判定 | 理由 |
|---|---|---|---|
| volume / monthly searches / competition / CPC | Keywords Data Google Ads Search Volume | `dfs-compatible` | fieldと地域・言語指定、非同期/Live形状が一致する |
| organic rank / SERP detail / PAA / related searches / AIO | SERP Google Organic Advanced | `dfs-compatible` | SERP item typeが直接提供される |
| domain/URLの獲得KW・traffic・cost | DataForSEO Labs Ranked Keywords | `dfs-compatible` | rank、volume、ETV、traffic costを提供可能 |
| 競合domain・keyword overlap | Labs Competitors / Domain Intersection | `dfs-compatible` | keyword intersectionとdomain metricsを提供可能 |
| 同時rank keyword | Ranked Keywords + Page Intersection | `dfs-compatible` | 上位URL集合を軸に共通rank keywordを得られる |
| 集客page | Labs Relevant Pages / Ranked Keywords aggregation | `dfs-compatible` | page別KW・ETV・traffic costを集計可能 |
| headline | SERP Advanced + OnPage Content Parsing | `dfs-compatible` | URL発見後にheading/text/linkを構造取得可能 |
| co-occurrence | SERP + Content Parsing + tokenizer | `inferred-transform` | DFSは本文を供給できるが頻度・site数集計はconsumer処理 |

### 4.2 DataForSEOだけでは説明できないもの

- Google以外を含むsuggest横断と長期蓄積DB
- 最大25,000件の部分一致関連KW index
- 質問文の長期蓄積、出現時期、相対需要
- LSI/PAA再帰探索のimportance（公開説明では再帰中の出現回数）
- title/heading/body生成のprompt、model selection、quality gate
- 類語、連想語、Q&A、ニュース、SNS hashtag
- UI上のfilter、URL state、履歴、credit、export orchestration

したがって、類似出力だけから「すべてDataForSEO」と結論づけるのは不正確である。
妥当な作業仮説は、`provider datasets + 独自蓄積index + deterministic transforms + LLM generation`
の複合pipelineである。

## 5. 推定処理pipeline

```text
seed keyword / site / URL
  -> provider collection
     -> suggest surfaces
     -> Google Ads metrics
     -> SERP advanced (organic/PAA/related/AIO)
     -> ranked-keyword/domain datasets
     -> top-page content parsing
  -> immutable raw snapshot + provider/task/observed_at/digest/cost
  -> normalization and identity
     -> locale-aware canonical form
     -> alias/reordered-token relation
     -> occurrence preservation
  -> graph/index construction
     -> suggest tree
     -> recursive LSI/PAA graph
     -> SERP URL overlap graph
     -> page-keyword bipartite graph
     -> domain competitor graph
     -> question/topic index
  -> deterministic analysis
     -> demand/commerciality/trend
     -> intent proximity and cannibalization risk
     -> page type and content-format classification
     -> topic/headline/co-occurrence coverage
     -> content gap and internal-link opportunity
  -> AI hypothesis/generation
     -> title candidates
     -> heading candidates
     -> article brief/body candidate
  -> evidence-bound review/gate
  -> WordPress draft/publish
  -> GSC/rank/conversion observation
  -> refresh/regenerate/consolidate/retire decision
```

## 6. 現行HELIXの優位点

- `site_id`を全分析へ束縛し、別サイト混在をfail-closeできる。
- DFS task ID、raw snapshot、digest、costから画面表示へ逆引きできる。
- 観測926 organic edgeから565 page coverage・339同時rank keyword関係・226競合domain coverageを再現し、共有URLへ逆引きできる。
- keyword hierarchy、64 article group、SERP URL overlapを決定論で再現できる。
- main/intent keywordと実WP article ID、title、heading、GSC queryを同じDBで照合できる。
- PAA/関連検索878論点を実WP title/H1-H6へ厳格照合し、covered・missing・記事未割当を混同せず逆引きできる。現行実測は評価可能220論点中title 3、heading 1、missing 216。
- 「提案」と「承認済みrequired topic」を分離し、AI出力を自動的な正本にしない。
- 公開後のGSC実績から施策KW獲得率と想定外queryを閉ループ評価できる。

競合の単発調査画面を模倣するのではなく、`調査 -> 判断 -> WP実行 -> 実績 -> 再判断` の
traceable lifecycleを完成させることが主要な勝ち筋になる。

## 7. 現行gapと実装優先度

### P0: content planを成立させる差分

1. raw PAA / related searchesのoccurrence付き正規化tableは実装済み（1,188 occurrence / 878 proposal）。
2. 2階層recursionと出現回数ベースimportanceを再現可能にする。
3. 上位SERP pageのtitle/description/heading/text取得契約は上位3候補190 URLで実装済み（180成功）。上位20対応が残る。
4. heading/co-occurrenceのpage・task・group別集計は実装済み。page-topicの意味分類が残る。
5. PAA、related、競合co-occurrence由来の根拠付きproposalは実装済み。承認workflowが残る。
6. 決定論title/heading候補とevidence digest・coverageは実装済み。LLM model/prompt version付き生成が残る。

### P1: strategyを上回る差分

1. keyword-page bipartite graphと観測内の同時rank KWは実装済み。Labs全rank母集団による拡張が残る。
2. 自site title/heading対PAA/関連検索のcontent gapは実装済み。weak-domain opportunity、SERP volatilityが残る。
3. rank history、GSC、page versionを結んだ変更前後impact評価。
4. cannibalization、consolidate、refresh、new pageの排他的decision proposal。
5. query clusterごとのAIO/AI Mode引用源・非引用gap。

### P2: discovery面の拡張

- multi-engine suggest、question corpus、trend、news、Q&A、social hashtag。
- providerごとの利用規約、保持期限、再配布可否を満たす収集契約が先に必要。

## 8. 「超えた」の判定条件

機能名の数ではなく、次を全て証明して初めて競合超過とする。

1. 公開機能inventoryの各行に `implemented / intentionally-out-of-scope / blocked-by-license` がある。
2. implemented機能はfixtureではなく実データで再現可能なtestとevidence digestを持つ。
3. keyword、question、topic、page、site、snapshotの母集団差分が0である。
4. title/heading proposalの全要素をsource evidenceへ逆引きできる。
5. 生成案を既存記事、SERP、GSC、site strategyへ照合し、重複・カニバリ・幻覚をgateする。
6. WordPress実記事と公開後成果まで閉ループで追跡できる。
7. provider変更時もconsumer analysisのsemantic resultをreplay比較できる。
8. 取得費、cache hit、freshness、失敗、partial resultを画面で説明できる。

## 9. 主要公開根拠

- ラッコキーワード公開OpenAPI: <https://api.rakkokeyword.com/docs>
- ラッコキーワード機能一覧: <https://rakkokeyword.com/knowledge/1332/>
- ラッコキーワード更新履歴: <https://rakkokeyword.com/knowledge/1338/>
- ラッコキーワード見出し抽出: <https://rakkokeyword.com/knowledge/487/>
- DataForSEO SERP Advanced: <https://docs.dataforseo.com/v3/serp-se-type-live-advanced/>
- DataForSEO Google Ads Search Volume: <https://docs.dataforseo.com/v3/keywords_data-google_ads-search_volume-live/>
- DataForSEO OnPage Content Parsing: <https://docs.dataforseo.com/v3/on_page-content_parsing-live/>

## 10. 現行100KWの取得・drop監査

`scripts/audit-serp-data-coverage.mjs` でraw 100ファイルをfield単位に走査する。
raw snapshot自体は保持しているため再投影は可能だが、現行DB/UIが利用していない情報が多い。

### 10.1 rawからDBへ投影済み

- task ID、seed keyword、cost、observed time、snapshot path、SHA-256 digest
- organicのrank、URL、domain、titleと導出page type
- organicのdescription、pre-snippet、breadcrumb、highlight、timestamp、sitelink、rating、price
- PAA質問396 occurrence
- related searches 792 occurrence
- AIO 68件の有無、取得できた本文17件、69要素、96参照

### 10.2 監査で検出したraw-only fieldと救出状況

| field/data | 実データ量 | 現状 |
|---|---:|---|
| organic description | 918 / 926 result | v10 DB/APIへ救出済み。v17競合content検索へ接続済み |
| organic highlighted terms | 839 result | v10 DB/APIへ救出済み。v17競合content検索へ接続済み |
| organic pre-snippet | 492 result | v10 DB/APIへ救出済み。分析接続待ち |
| organic timestamp | 511 result | v10 DB/APIへ救出済み。v17競合content検索の公開日時filterへ接続済み |
| organic sitelinks | 257 result | v10 DB/APIへ救出済み。分析接続待ち |
| AIO markdown | 17 / 68 AIO | v10 DB/APIへ救出済み。topic分析待ち |
| AIO elements | 69 element | v10 DB/APIへ救出済み。section分解待ち |
| AIO references | 96 reference | v10 DB/APIへ救出済み。citation gap分析待ち |
| spell correction | 1 query | alias/normalizationへ未接続 |
| knowledge graph | 1 query | entity分析へ未接続 |
| people-also-search | 1 query | demand graphへ未接続 |
| image/video packs | 各1 query | content format判断へ未接続 |
| price / rating | 6 / 2 organic result | commercial SERP分析へ未接続 |
| task status/time/result count/check URL/result counts | 全taskに存在 | provider health・再現性画面へ未投影 |

### 10.3 取得自体をしていない

| dataset | 原因・必要な取得 |
|---|---|
| PAA回答本文・参照URL | `people_also_ask_click_depth`なし。現在は質問396件だけで回答0件 |
| SERP pixel位置 | `calculate_rectangles`なし |
| 競合page H1-H6・本文・内部/外部link | v14で上位3候補190 URLを全件処理済み。180成功、robots拒否3、HTTP error 5、fetch error 2 |
| 最新volume、4年月次、CPC、competition、SEO difficulty | Keywords Data / Labs未実行 |
| domain/URL ranked KW、集客page、競合domain、履歴 | Labs dataset未実行 |
| multi-engine suggest、質問DB、trend、news、Q&A、hashtag | 対応provider取得なし |

この区別により、再取得なしで救出できるデータと、費用・利用規約・freshnessを伴う新規取得を混同しない。

### 10.5 競合content取得の実装・実測（2026-08-26）

`scripts/fetch-competitor-content-evidence.mjs` を追加し、現行SERPの上位3位から自domainを除外した
190 URLを候補化・全件処理した。180 URLのHTML取得に成功し、robots拒否3、HTTP error 5、fetch error 2だった。
失敗も欠損行として保持し、成功ページだけに分析結果を付与する。

- `robots.txt`をorigin単位で確認し、denyされたURLは本文を取得しない。
- raw HTML、SHA-256、最終URL、HTTP status、content type、取得時刻を保存する。
- title、canonical、H1-H6、本文digest/文字数、内部・外部link数を分離保存する。
- kuromojiで意味語（名詞・形容詞）を抽出し、機能動詞を除外する。本文・title・headingの出現回数、各出現page数、rank加重scoreを分離する。
- 公式仕様と同じく2 page未満にしか現れない語を共起語集計から除外する。
- DB v14では190 page、6,887 heading、16,995 group×term、24,052 task×termを保持し、各termから根拠page IDへ逆引きできる。
- group集計だけでなくDFS task（検索KW）単位の上位3page集計も保持するため、記事KW群への統合前後を比較できる。
- UIの「コンテンツ設計」でgroupごとの競合page数、heading数、上位共起語と `page count / heading page count` を表示する。
- evidence-bound生成候補642件を追加した。内訳はPAA/関連検索由来title 57・heading 376、競合共起語由来title 29・heading 180。全件`proposed`で、根拠IDが空の候補は0件。

現行取得は各検索KWの上位3pageであり、ラッコの上位20サイト深度とは異なる。取得母集団190 URLについては差分0だが、
上位20深度への拡張は追加SERP取得・freshness・取得負荷・利用条件を伴う別runとして扱う。

公式仕様で確認できた集計軸は、本文共起回数、title共起回数、heading共起回数、本文出現site数、heading出現site数である。
当実装はこれらにtitle出現page数、検索KW別統計、記事KW群別統計、rank加重score、page ID逆引きを加える。

### 10.4 DFS以外の入力監査

#### 元キーワードExcel

`IT就活大学キーワードマップ.xlsx` は15 sheet、A列に値があるkeyword行だけで10,694行ある。
現行PoCは先頭sheet `IT就活` の先頭100行だけを取得している。

| sheet | keyword行 |
|---|---:|
| IT就活 | 104 |
| IT 文系 | 112 |
| ITインターン | 153 |
| IT新卒 | 231 |
| IT業界 | 935 |
| SES | 1,342 |
| SIer | 1,059 |
| Webマーケター | 166 |
| Webデザイナー | 636 |
| ITエンジニア | 679 |
| 新卒 | 1,583 |
| 就活 | 1,684 |
| 就活エージェント | 380 |
| レバテックルーキー | 76 |
| インターン | 1,554 |

したがって、現行100KWは全体の約0.94%であり、残り10,594行は未取得である。
さらに別入力として競合メディアkeyword workbook 14 sheet、サイトコンセプト・カテゴリー・
ライティングregulation workbookが存在するが、現行SEO DBへ未取込である。

#### GSC

現行証跡は59記事について `page filter × query`、過去28日、search type=`web` のCSVだけを取得している。
681 raw query行はDBへ保持し、678 normalized queryへ集約しているため、この母集団内でのdropはない。
一方、次は取得していない。

- 日別推移（date dimension）
- country、device、search appearance
- Discover、Google News、image、video等のsearch type
- site全体queryとpage別queryのintersection
- API row limit、匿名化queryによる欠測量の推定
- 7/28/90日など同一取得時刻の複数window

#### WordPress

WP RESTから59記事の`content.rendered`を一時取得しているが、fixtureへ残すのはtitle、URL、modified、
H2/H3だけである。本文全量を重複保持しない方針自体は正しいが、現状は次の派生証跡も捨てている。

- content digest（公開直前compare-and-setに必要）
- paragraph/section位置とsectionごとのtext digest
- internal/external link、anchor、所属H2/H3
- image、alt、caption、table/list/FAQ/schema/block type
- author、status、date、modified GMT、slug、categories/tagsの完全なidentity snapshot
- H1およびH4-H6（現行抽出はH2/H3のみ）

本文そのものを永続化せず、上記の構造化派生値とdigestだけを保存するのが適切な是正となる。

## 11. 未検証事項

- 公開API 24 operation / 41 schema / 952 fieldの契約棚卸しは完了。各fieldとHELIX DB columnの個別1:1対応は未完了
- Web UI 34 capabilityのinput/output/主要limit/credit/history/export棚卸しは完了。動的料金表の全セルと8補助ツール個別契約は未完了
- SEO難易度の公開説明とDFS Labs指標の数式・分布比較
- 同一seedでのラッコ出力とDFS出力の合法的なside-by-side実測
- AI title/headingの入力選択、重複抑制、文字数、coverage quality oracle
- 利用規約・データ保持・派生データ再配布条件

これらを埋めるまでは「全機能調査完了」「DataForSEO利用確定」「競合超過完了」を主張しない。
