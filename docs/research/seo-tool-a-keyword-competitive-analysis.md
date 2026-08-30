---
artifact_id: WP-RESEARCH-SEO_TOOL_A-COMPETITIVE-20260826
status: in-progress
evidence_cutoff: 2026-08-26
scope: public-product-research-and-reproducible-inference
---

# seo-tool-a競合機能・推定処理台帳

## 1. 目的と調査境界

seo-tool-aの公開機能、公開 API、公式マニュアルの入出力を棚卸しし、
`HELIX-WP-HARNESS` の SEO 分析基盤が同等機能を再現したうえで、site固有証跡、決定理由、
継続観測、WordPress実記事との閉ループで上回るための差分台帳とする。

認証回避、非公開 API の探索、利用規約に反する取得、実装コードの複製は行わない。
「DataProviderBを内部利用している」という直接証拠は現時点でないため断定しない。
公開出力と DataProviderB 公式 API のデータ形状が対応する場合も、`compatible` または
`high-confidence inference` と記録し、provider provenance の確証とは分ける。

## 2. 根拠クラス

| class | 意味 |
|---|---|
| `confirmed-public` | seo-tool-a公式ページまたは公開OpenAPIに明記 |
| `data-provider-b-compatible` | DataProviderB公式APIだけで主要入力を再現可能 |
| `inferred-transform` | 公開出力から推定できる集計・正規化・ranking処理 |
| `unknown-provider` | 同等データ源が複数ありproviderを特定できない |
| `helix-implemented` | 現行リポジトリで実装・テスト済み |
| `helix-gap` | 現行リポジトリに未実装または証跡不足 |

## 3. 公開API inventory（2026-08-26）

公開 OpenAPI は24 operation、41 schemaを持つ。`scripts/refresh-seo-tool-a-openapi-inventory.mjs` が
公開Swaggerからsnapshotを保存し、952 nested fieldをflattenして全operationへ実装状態・DPB候補・推論確度・gapを割り当てる。
`scripts/test-seo-tool-a-openapi-inventory.mjs` は未割当operation、古いmapping、schema/field欠落をfailさせる。

- 正本snapshot: `docs/research/evidence/seo-tool-a-openapi.json`
- field inventory: `docs/research/seo-tool-a-openapi-inventory.json`
- 判断台帳: `docs/research/seo-tool-a-capability-decisions.json`
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
| `POST /v1/content-search` | title/description/top KWによるpage検索 | full-text page/rank index | 上位10候補の取得成功535 pageでtitle/H1-H6/SERP description/観測KW検索とrank逆引き実装。全page/traffic gap |
| `POST /v1/headline` | Google上位pageのH1-H6・文字数・平均 | SERP + page parsing | 上位10page実測・18,424 heading。階層/検索/除外語/scope/ページ構造/文字数統計を実装。上位11〜20・wire互換 gap |
| `POST /v1/co-occurrence` | 上位20pageの本文/title/heading頻出語 | SERP + page parsing + token statistics | task/group別実装済み。上位20/getDetails互換 gap |
| `POST /v1/search-rank` | 指定site/KWの最新順位とSERP | live/queued SERP | raw SERPあり。継続rank tracking gap |
| `POST /v1/site-search` | contentとdomain metricsによるsite検索 | domain/content index | gap |
| metadata locations | region contract | provider metadata | location code固定のみ |
| metadata languages | language contract | provider metadata | `ja`固定のみ |
| AI生成群（Web UI） | title、heading、body、questions、related KW | SERP/heading/co-occurrence + LLM | evidence-bound title/heading 642候補。LLM/body gap |

### 3.1 Web UI・料金・運用inventory

API外を含む公開機能は `docs/research/seo-tool-a-web-capability-inventory.json` に34 capabilityとして整理した。
各行にinput、output、公開上限、credit、履歴、export、推定provider層、HELIX状態、gapを必須化している。
`scripts/test-seo-tool-a-web-capability-inventory.mjs` が主要34 IDの欠落と未記入fieldを検出する。

料金と課金条件は `docs/research/seo-tool-a-pricing-policy.json` に分離した。確認できた現行planはfree、entry、light、
standard、pro、enterpriseの6つ。年払い時の月額は順に0、660、990、2,475、4,950、9,900円で、
月払いは0、1,320、1,980、4,950、9,900、19,800円。動的料金表から確認できたcreditは
free 50/週、entry 400/月、light 1,000/月、standard 3,000/月であり、pro/enterpriseの割当量は
今回保存した公開根拠だけでは確定できないためnullのまま残した。

課金は「Webの結果表示成功」「API/MCPのデータ取得成功」が基本で、API/MCPは原則Web基準の1.5倍。
0件、1時間以内の同一keyword再検索、error、残高不足、表示前cancelはWebで原則非消費だが、
一括キーワード調査・検索順位チェックは取得実行時、site-searchはfilter変更時に消費する例外がある。
copy/CSV/JSON downloadと通常filter/sortは非消費である。

## 4. DataProviderB対応仮説

### 4.1 高い対応があるもの

| seo-tool-a出力 | DataProviderB候補 | 判定 | 理由 |
|---|---|---|---|
| volume / monthly searches / competition / CPC | Keywords Data Google Ads Search Volume | `data-provider-b-compatible` | fieldと地域・言語指定、非同期/Live形状が一致する |
| organic rank / SERP detail / PAA / related searches / AIO | SERP Google Organic Advanced | `data-provider-b-compatible` | SERP item typeが直接提供される |
| domain/URLの獲得KW・traffic・cost | DataProviderB Labs Ranked Keywords | `data-provider-b-compatible` | rank、volume、ETV、traffic costを提供可能 |
| 競合domain・keyword overlap | Labs Competitors / Domain Intersection | `data-provider-b-compatible` | keyword intersectionとdomain metricsを提供可能 |
| 同時rank keyword | Ranked Keywords + Page Intersection | `data-provider-b-compatible` | 上位URL集合を軸に共通rank keywordを得られる |
| 集客page | Labs Relevant Pages / Ranked Keywords aggregation | `data-provider-b-compatible` | page別KW・ETV・traffic costを集計可能 |
| headline | SERP Advanced + OnPage Content Parsing | `data-provider-b-compatible` | URL発見後にheading/text/linkを構造取得可能 |
| co-occurrence | SERP + Content Parsing + tokenizer | `inferred-transform` | DPBは本文を供給できるが頻度・site数集計はconsumer処理 |

### 4.2 DataProviderBだけでは説明できないもの

- Google以外を含むsuggest横断と長期蓄積DB
- 最大25,000件の部分一致関連KW index
- 質問文の長期蓄積、出現時期、相対需要
- LSI/PAA再帰探索のimportance（公開説明では再帰中の出現回数）
- title/heading/body生成のprompt、model selection、quality gate
- 類語、連想語、Q&A、ニュース、SNS hashtag
- UI上のfilter、URL state、履歴、credit、export orchestration

したがって、類似出力だけから「すべてDataProviderB」と結論づけるのは不正確である。
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
- DPB task ID、raw snapshot、digest、costから画面表示へ逆引きできる。
- 観測926 organic edgeから565 page coverage・339同時rank keyword関係・226競合domain coverageを再現し、共有URLへ逆引きできる。
- keyword hierarchy、64 article group、SERP URL overlapを決定論で再現できる。
- main/intent keywordと実WP article ID、title、heading、GSC queryを同じDBで照合できる。
- PAA/関連検索878論点を実WP title/H1-H6へ厳格照合し、covered・missing・記事未割当を混同せず逆引きできる。現行実測は評価可能220論点中title 3、heading 1、missing 216。
- AIO 96引用を38 domainへ正規化し、同一query通常SERPとの同一URL 61件・同一domain 71件、自site引用0件を分離してcitation gapを説明できる。
- AIO回答69 elementを構造化し、見出し付き35論点を実WPへ照合できる。現行は記事割当済み16論点が全てmissing、未割当19、見出しなし34である。
- 「提案」と「承認済みrequired topic」を分離し、AI出力を自動的な正本にしない。
- 公開後のGSC実績から施策KW獲得率と想定外queryを閉ループ評価できる。

競合の単発調査画面を模倣するのではなく、`調査 -> 判断 -> WP実行 -> 実績 -> 再判断` の
traceable lifecycleを完成させることが主要な勝ち筋になる。

## 7. 現行gapと実装優先度

### P0: content planを成立させる差分

1. raw PAA / related searchesのoccurrence付き正規化tableは実装済み（1,188 occurrence / 878 proposal）。
2. 2階層recursionと出現回数ベースimportanceを再現可能にする。
3. 上位SERP pageのtitle/description/heading/text取得契約は上位10候補564 URLで実装済み（535成功）。上位11〜20対応が残る。
4. heading/co-occurrenceのpage・task・group別集計は実装済み。page-topicの意味分類が残る。
5. PAA、related、競合co-occurrence由来の根拠付きproposalは実装済み。承認workflowが残る。
6. 決定論title/heading候補とevidence digest・coverageは実装済み。LLM model/prompt version付き生成が残る。

### P1: strategyを上回る差分

1. keyword-page bipartite graphと観測内の同時rank KWは実装済み。Labs全rank母集団による拡張が残る。
2. 自site title/heading対PAA/関連検索のcontent gapは実装済み。weak-domain opportunity、SERP volatilityが残る。
3. rank history、GSC、page versionを結んだ変更前後impact評価。
4. cannibalization、consolidate、refresh、new pageの排他的decision proposal。
5. 観測AIOの引用URL/domain・通常SERP交差・自site非引用gap、およびAIO見出し対WP coverageは実装済み。AI Mode、意味的topic coverage、時系列が残る。

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

- seo-tool-a公開OpenAPI: <https://api.seo-tool-a.example/docs>
- seo-tool-a機能一覧: <https://seo-tool-a.example/knowledge/1332/>
- seo-tool-a更新履歴: <https://seo-tool-a.example/knowledge/1338/>
- seo-tool-a見出し抽出: <https://seo-tool-a.example/knowledge/487/>
- DataProviderB SERP Advanced: <https://docs.data-provider-b.example/v3/serp-se-type-live-advanced/>
- DataProviderB Google Ads Search Volume: <https://docs.data-provider-b.example/v3/keywords_data-google_ads-search_volume-live/>
- DataProviderB OnPage Content Parsing: <https://docs.data-provider-b.example/v3/on_page-content_parsing-live/>

## 10. 現行100KWの取得・drop監査

`scripts/audit-serp-data-coverage.mjs` でraw 100ファイルをfield単位に走査する。
raw snapshot自体は保持しているため再投影は可能である。v23再監査では、現行100 snapshot内の
non-empty fieldはすべて専用列または`serp_feature_occurrences.payload_json`へ投影済みで、rawにしか
残らないfieldは0件だった。ただし「保存済み」と「意思決定へ接続済み」は別であり、後者は未接続が残る。

注: 上記は当時の主分析corpus 100件に対する履歴記録である。現行v10監査は公開raw 3 dataset・110 taskへ拡張し、
195 primitive leaf fieldを検査する。追加で見つかった`jobs`系16 fieldは
`raw_snapshot_feature_evidence`へpayload、snapshot digest、evidence digest付きで構造化し、別corpus登録レビューから
検索可能にした。195 fieldすべて投影・consumer検証済み、raw-only 0である。求人featureは現行サイトへ自動割当せず、
施策判断にも昇格させない証拠専用データとして扱う。

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
| AIO elements | 69 element | v19でsection単位に正規化し、35見出しを既存WP title/heading gapへ接続済み |
| AIO references | 96 reference | v18で38 domainへ正規化し、通常SERP URL/domain交差と自site citation gapへ接続済み |
| spell correction | 1 query | v22で正規表記候補と元query保持のタイトルguidanceへ接続。自動置換せずproposed |
| organic xpath / flags / checks / AMP | 926 result | v20 DB/APIへ救出済み。表示形式・品質分析への接続待ち |
| knowledge graph | 1 query | v22でentity定義・一次情報citationの構成guidanceへ接続 |
| people-also-search | 1 query | v22で商品・サービスの比較軸／選び方guidanceへ接続 |
| image/video packs | 各1 query | v22でoriginal image・gallery・alt、video・要約・transcriptの素材guidanceへ接続 |
| price / rating | 6 / 2 organic result | v22で価格比較表・更新日・評価件数／方法／出典guidanceへ接続 |
| task status/time/result count/check URL/result counts | 全taskに存在 | v20 DB/APIへ救出し、provider health・再現性を取得状態画面へ投影済み |
| 現行分析fixture未接続のraw snapshot | 10 / raw全110 task | v21 raw取得台帳へ救出。現行IT就活100 taskとは分離し、SEO系8 task・比較PoC 2 task（jobs feature 1件を含む）を未接続理由付きで表示 |

### 10.3 取得自体をしていない

| dataset | 原因・必要な取得 |
|---|---|
| PAA回答本文・参照URL | `people_also_ask_click_depth`なし。現在は質問396件だけで回答0件 |
| SERP pixel位置 | `calculate_rectangles`なし |
| 競合page H1-H6・本文・内部/外部link | DB v36時点で上位10候補564 URLを全件処理済み。535成功、robots拒否13、HTTP error 12、fetch error 4。上位11〜20は未取得 |
| 最新volume、4年月次、CPC、competition、SEO difficulty | v22で課金前plan・公式価格上限・account balance確認・raw evidence保存pipelineを実装。live取得は未実行 |
| domain/URL ranked KW、集客page、競合domain、履歴 | v22で自domain ranked keywords最大1,000件の課金前planと保存pipelineを実装。live取得は未実行 |
| multi-engine suggest、質問DB、trend、news、Q&A、hashtag | 対応provider取得なし |

この区別により、再取得なしで救出できるデータと、費用・利用規約・freshnessを伴う新規取得を混同しない。

### 10.4 SERP実測からの記事形式・構成施策（DB v22）

現行100 taskのうち、特殊feature、spell、price/ratingの実測がある8 taskを施策候補へ変換した。内訳は
entity 1、選択支援1、画像1、動画1、commercial 3、表記補正1。各候補はfeature IDまたは
`task_id:organic rank`へ逆引きでき、SHA-256 evidence digestを持つ。タイトル・見出し・必要素材のguidanceは
全件`proposed`であり、観測だけから公開内容を自動確定しない。

### 10.5 質問・潜在需要の横断index

100 SERP snapshotにある1,188 occurrenceを、PAA 221固有質問・関連検索493固有語へ正規化した。
独立画面で本文と取得元KWを検索し、種別filter、occurrence数、task数、group数、SERP位置、再帰depth、
初回・最終観測を表示する。重要度は検索量と偽装せず、同じ需要種別内のtask数60%、group数25%、
occurrence数15%を各最大値で正規化した`observed-demand-relative.v1`（0–100）として明示する。
現状は1階層・100 seed由来であり、PAA回答、2階層再帰、大規模質問indexは未取得のままである。

### 10.6 追加課金データの取得契約（DB v22時点）

`npm run poc:data-provider-b-enrichment:plan` はnetwork callを行わず、現行100 keywordに対するrequest body、
provider上限、公式公開価格に基づく上限見積を出力する。既定選択はGoogle Ads Search Volume liveと
Labs Bulk Keyword Difficulty liveで、上限見積は合計`$0.114`。自domain Ranked Keywords最大1,000件を
加えた全planは`$0.246`。

課金実行には`--live`に加え、`WP_DATA_PROVIDER_B_ENRICHMENT_LIVE=1`、jobの明示選択、見積以上の
`WP_DATA_PROVIDER_B_ENRICHMENT_MAX_USD`、DPB credentialsがすべて必要。課金前に無料のUser Data endpointから
balanceとaccount pricing snapshotを取得し、残高不足なら停止する。response、reported cost、SHA-256、
request planをrun単位のmanifestへ保存する。clickstreamは明示的にfalseで、意図しない倍額課金を避ける。
`data-provider-b-enrichment-normalized.v1` は取得後のresponseを、keyword metrics、年月別volume、difficulty、
ranked keyword summary、ranked keyword明細へ分離する。観測値`0`は欠損へ変換せず、providerが返さなかった
入力語はcoverageの`missing_keywords`へ残す。全明細はsource job、raw SHA-256、行単位evidence digestを持つ。
DB v23はこのmanifestを`data_provider_b_enrichment_runs`、`keyword_market_metrics`、`keyword_monthly_searches`、
`keyword_difficulty_enrichment`、`domain_ranked_keyword_summaries`、`domain_ranked_keywords`へ正規化し、
APIと「市場データ」画面へ投影する。manifest未指定時は空配列と`not_acquired`を返し、workbook由来の
既存値を最新取得値として偽装しない。

- Google Ads Search Volume live: <https://docs.data-provider-b.example/v3/keywords_data-google_ads-search_volume-live/>
- Labs Bulk Keyword Difficulty live: <https://docs.data-provider-b.example/v3/data-provider-b_labs-google-bulk_keyword_difficulty-live/>
- Labs Ranked Keywords live: <https://docs.data-provider-b.example/v3/data-provider-b_labs-google-ranked_keywords-live/>
- User Data（無料、balance・account pricing）: <https://docs.data-provider-b.example/v3/appendix-user-data/>

### 10.7 競合content取得の実装・実測（2026-08-26）

`scripts/fetch-competitor-content-evidence.mjs` を追加し、現行SERPの上位3位から自domainを除外した
190 URLを候補化・全件処理した。180 URLのHTML取得に成功し、robots拒否3、HTTP error 5、fetch error 2だった。
失敗も欠損行として保持し、成功ページだけに分析結果を付与する。

- `robots.txt`をorigin単位で確認し、denyされたURLは本文を取得しない。
- raw HTML、SHA-256、最終URL、HTTP status、content type、取得時刻を保存する。
- title、canonical、H1-H6、本文digest/文字数、内部・外部link数を分離保存する。
- kuromojiで意味語（名詞・形容詞）を抽出し、機能動詞を除外する。本文・title・headingの出現回数、各出現page数、rank加重scoreを分離する。
- 公式仕様と同じく2 page未満にしか現れない語を共起語集計から除外する。
- DB v14では190 page、6,887 heading、16,995 group×term、24,052 task×termを保持し、各termから根拠page IDへ逆引きできる。
- group集計だけでなくDPB task（検索KW）単位の上位3page集計も保持するため、記事KW群への統合前後を比較できる。
- UIの「コンテンツ設計」でgroupごとの競合page数、heading数、上位共起語と `page count / heading page count` を表示する。
- evidence-bound生成候補642件を追加した。内訳はPAA/関連検索由来title 57・heading 376、競合共起語由来title 29・heading 180。全件`proposed`で、根拠IDが空の候補は0件。
- DB v24で全642候補に品質reviewを付与した。主KW包含、文字数heuristic、根拠数、H2/H3親関係、候補内重複、既存WP title/heading完全衝突を検査し、641件`ready`、1件`blocked`（WP #130 H2との衝突）となった。判定は候補と同じく自動承認せず、policy名とSHA-256 review digestを保持する。
- DB v25では需要複合・需要解説・競合解説のtitle variantと、PAA質問・関連検索・競合軸のheading variantを分離した。全候補に`deterministic_rule`、generator version、variant key、入力SHA-256を付け、LLM生成と区別する。区切り前後の意味重複も品質review対象とし、生成数だけを品質と誤認しない。

この節の数値は初回v14 runの履歴である。現行取得は10.44のとおり各検索KWの上位10pageへ拡張したが、
seo-tool-aの上位20サイト深度とは異なる。上位11〜20への拡張は追加SERP取得・freshness・取得負荷・利用条件を伴う別runとして扱う。

公式仕様で確認できた集計軸は、本文共起回数、title共起回数、heading共起回数、本文出現site数、heading出現site数である。
当実装はこれらにtitle出現page数、検索KW別統計、記事KW群別統計、rank加重score、page ID逆引きを加える。

### 10.8 DPB以外の入力監査

#### 元キーワードExcel

`IT就活大学キーワードマップ.xlsx` は15 sheet、A列に値があるkeyword行だけで10,694行ある。
DB v25で15 sheet全10,694行をsource sheet・row identity付きでキーワード台帳と階層へ取り込んだ。
このうちSERP実測・施策group接続済みは先頭sheet `IT就活` の100行だけであり、残りは明示的に
`SERP未取得`とする。

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

したがって、キーワード台帳のdropは0行になった。SERP取得率は100 / 10,694（約0.94%）で、
残り10,594行は台帳から消さず取得待ちとして保持する。同じ文字列が別sheetにある10行を誤って
取得済みにしないよう、状態判定は文字列ではなくsource IDで行う。
さらに別入力として競合メディアkeyword workbook 14 sheet、サイトコンセプト・カテゴリー・
ライティングregulation workbookが存在するが、現行SEO DBへ未取込である。

#### GSC

現行証跡は59記事について `page filter × query`、search type=`web` のCSVを取得している。
過去28日は681 raw query行（678 normalized）、過去7日は318 raw query行を確認した。従来ビルドは単一manifest
しか受けず7日分を未接続にしていたが、DB v29の複数manifest入力で合計999 raw行を保持するよう是正した。
同じqueryでもwindowと取得時刻が異なる観測は加算せず分離し、記事マッチング等の単一時点分析には最大windowの
最新観測だけを用いる。現在の実行環境では7日・28日の両方を投影し、リポジトリ標準fixtureは28日のみである。
一方、次は取得していない。

- 日別推移（date dimension）
- country、device、search appearance
- Discover、Google News、image、video等のsearch type
- site全体queryとpage別queryのintersection
- API row limit、匿名化queryによる欠測量の推定
- 90日等の追加window、および厳密に同一取得時刻へ揃えたwindow比較

#### WordPress

WP RESTから59記事の`content.rendered`を一時取得しているが、fixtureへ残すのはtitle、URL、modified、
H2/H3だけであった。本文全量を重複保持しない方針自体は正しいが、DB v29まで次の派生証跡を捨てていた。

- content digest（公開直前compare-and-setに必要）
- paragraph/section位置とsectionごとのtext digest
- internal/external link、anchor、所属H2/H3
- image、alt、caption、table/list/FAQ/schema/block type
- author、status、date、modified GMT、slug、categories/tagsの完全なidentity snapshot
- H1およびH4-H6（現行抽出はH2/H3のみ）

本文そのものを永続化せず、上記の構造化派生値とdigestだけを保存するのが適切な是正となる。

### 10.9 本文生成packageと公開前gate（DB v26）

resolved 63 groupごとに、品質`ready`のtitle、最大50の根拠付きheading、topic proposal IDs、
AIO citation候補、SERP形式signalをversioned packageへ固定した。v3では全63 packageのbrief入力が成立し、
H3の親H2と根拠も保持する。SQLite v42では後述の証拠境界draftを全63件生成したが、citation・一次情報確認は
未完なので公開可能な本文とは扱わない。入力とpackageは別々のSHA-256を持ち、後続LLMのmodel/prompt/output履歴と
再現比較できる。

### 10.10 類語・表記variant・連想語（DB v27）

全10,694行のnormalized token multisetから921の表記variant clusterを作り、source sheet・rowへ
逆引き可能にした。これは意味的同義語辞書ではなく、語順・空白・表記差の実測clusterである。
generic語と記号・数字・無関係な外国語断片をranking対象外にし、7,087有効documentから585基準語、
1,636連想関係を抽出した。各関係はpair support、両語document count、cosine score、最大20 source ID、
導出policy、SHA-256を持つ。元行自体は削除せず、ranking品質filterと台帳保持を分離する。

DB v28では、この連想indexとgroup token集合を10,594未取得KWへ戻し、token overlap、最大association
cosine、workbook検索量を別々に採点した。表記variantはrepresentative concept IDでdedupeし、60 groupへ
792候補を最大20件ずつ提案する。全候補は実在source row、`proposed`、SHA-256 evidenceを持ち、LLMが
作った語とは称さない。候補がない4 groupも空を維持し、無関係語で埋めない。

### 10.11 補助ツール再監査

公式現行一覧は更新履歴の「8件」から1件増え、9件掲載されている。掛け合わせ、リストA/B除外・
重複抽出、差分、置換、重複除去、NFKC正規化、Unicode code point文字数、競合/自サイト重複除去の
8操作をbrowser-localで実装した。入力はnetwork送信・DB保存せず、結果だけcopy可能。地域キーワード
生成は日本郵便の2026-07-31更新UTF-8全国CSVをsource archive digest付きで取り込み、47都道府県と
1,892市区町村・郡町村を実装した。公式CSVは約12万住所行だが、町域を候補へ混ぜず自治体単位にdedupeする。
駅は国交省の2025年度N02（2025-12-31時点、CC BY 4.0）から10,234 featureをgroup codeで
9,046駅へdedupeし、路線・運営会社とarchive digestを保持した。これで公式現行一覧の9操作を実装済みとした。

- 公式補助ツール一覧: <https://seo-tool-a.example/knowledge/tool/>
- 地域キーワード生成仕様: <https://seo-tool-a.example/techo/generate-local-keywords/>
- 日本郵便UTF-8全国CSV: <https://www.post.japanpost.jp/service/search/zipcode/download/utf-zip.html>
- 国土数値情報・鉄道2025年度版: <https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html>

### 10.12 横断クイック検索

同一site内の元KW台帳、施策group、質問・潜在需要、類語・連想語、GSC記事/queries、競合contentを
単一入力で検索し、各結果から既存filterまたはkeyword treeへ遷移する。launcher自体は新規取得をせず、
未取得provider datasetを結果に混ぜない。source別の全hit数と上位8 previewを分離して表示する。

### 10.13 取得費用とcredentialの保持境界

取得済みDPB taskのUSD原価をsite別に集約し、日付、provider、endpoint、task/run ID、raw snapshot
digestまで逆引きできる費用台帳をAPI/UIへ追加した。取得費用はtask metadataを正本とし、group合計から
再計算して二重計上しない。SeoToolA creditとの換算根拠はないため `null` のまま保持し、API keyやcredentialは
DB・投影・画面のいずれにも保存しない。SeoToolA account側のcredit履歴とkey lifecycleは未取得である。

### 10.14 ブックマークレット

閲覧ページの選択文字、未選択時はpage titleだけをsite-scoped `quick_q` として渡し、横断クイック検索を
別tabで開くbookmarkletを実装した。本文、DOM、閲覧履歴は送信・保存しない。launcherは取得を実行せず、
provider課金を発生させない。生成URLは現在のdashboard originを使い、既存query/hashを持ち越さない。

### 10.15 保有コーパス・サジェスト

全10,694元KWを前方一致、部分一致、全token一致で検索し、検索量、取得状態、source sheet/rowを
最大500件まで表示する。これはworkbook由来の候補であり、Google、YouTube、Amazon、楽天、Bing等の
autocomplete surface由来とは称さない。外部surface、増量取得、appearance historyは未取得のまま明示する。

### 10.16 根拠付き質問候補

同一groupの上位12需要を入力に、実測PAAは文言を変えない `observed_passthrough`、関連検索は
`evidence-bound-question.v1` の規則で疑問形へ変換する。両者をDB/API/UIで別区分とし、source topic、
SERP occurrence ID、generator version、input/evidence digest、review stateを保持する。外部LLMは実行せず、
model/prompt由来の候補が存在するようには表示しない。

### 10.17 出力と再現可能なfilter state

実測需要に加え、保有コーパス・サジェストと根拠付き質問候補も現在のsite/query/mode/typeで絞った
全件をCSV/JSON出力できる。表示上限500件はサジェスト表だけに適用し、exportでは一致全件を落とさない。
filterは `suggest_q` / `suggest_mode` / `question_q` / `question_kind` としてURLに保持し、再読み込み時に
対象viewを復元する。未取得surfaceや非表示データをexportへ混ぜない。

### 10.18 読み取り専用MCP

dashboard serverの `/mcp` にStreamable HTTPのJSON response modeを追加し、`initialize`、`ping`、
`tools/list`、`tools/call`を実装した。toolはsite-scopedの元KW検索、実測需要検索、質問候補、content brief、
取得状態/費用台帳に加え、title候補、競合heading、outline、競合domain、SERP field、保持rank履歴、市場データの
計12種に、特殊SERP featureのnested item検索、title×outline構成整合review、証拠境界draft読取を加えた計15種。追加10種はread-only API投影を再利用し、APIとMCPでsite filterやprovenanceが分岐しないようにした。
最大100行・read-only・外部取得なしとする。Originはlocalhost系またはheaderなしだけを許可し、bodyは1MiB、
protocol versionは2025-03-26/06-18/11-25に制限する。SeoToolA OAuthやcredit連携とは称さない。

- MCP Tools仕様: <https://modelcontextprotocol.io/specification/2025-06-18/server/tools>
- MCP Streamable HTTP仕様: <https://modelcontextprotocol.io/specification/2025-03-26/basic/transports>

### 10.19 サイト検索と横断比較

登録siteをlabel/domainで検索し、同一定義の元KW、SERP取得/未取得とcoverage、group解決、task、WP記事、
GSC query、競合page、質問候補、provider費用を横断表示する。投影とUIは2-site fixtureで分離を検証するが、
現在の本番母集団は1 siteだけである。未登録siteを0件として水増しせず、未知domain index、推定traffic、
10-100 URLのLabs一括取得、trendは未取得と明示する。標準fixtureのGSCは正規化後678 queryと元681行、
現在のruntimeは7日分を加えた元999行を別fieldで保持し、正規化統合を「破棄」と誤認しないようにする。

### 10.20 読み取り専用REST API

`/api/v1` に36 GET routeを実装し、OpenAPI 3.1を `/api/v1/openapi.json` で公開する。検索系はsite必須、
最大100行、cursor paginationとし、全responseに `retained_evidence_only`、外部取得なし、credential露出なしを
付ける。`operation-coverage` はSeoToolA公開OpenAPIの全24 operation IDを保持証跡projectionへ対応付け、登録系2件は
`plan_only_no_mutation` と明示する。suggest/related/demand/question、同時rank、page/domain/content/heading/
cooccurrence/SERP、market metadata/status/result、rank empty state、WP linkを提供する。SeoToolA wire contract、認証、
credit体系とは同一と称さず、provider mutationを実行しない。

### 10.21 provider依存データの課金前計画

63確定main KWを正本に、Google Trends Explore Standardは最大5語/batchで13 job、Google News Standardは
63 job、YouTube Organic Standardはsocial proxyとして63 jobを生成した。合計139 jobはすべて
`not_executed`、credential非保存、明示承認必須である。2026-08-26確認の公式公開単価はTrends Standard
$0.0027/task、News/YouTube Standard normal $0.0006/base requestで、実行対象Trends+Newsは$0.0729、
任意proxyは$0.0378、全planは$0.1107と見積もる。実行直前にaccount pricingを再確認し、明示live flag、
environment credential、見積以上の厳密な承認上限のいずれかがなければgateで拒否する。YouTube SERPを
hashtag取得済みとは扱わない。Q&A専用endpointは確認できず、Google operator queryは公式上5倍課金のため
jobを作らずprovider gapにした。

- DPB Google Trends pricing: <https://data-provider-b.example/pricing/keywords-data/google-trends>
- DPB Google News pricing: <https://data-provider-b.example/pricing/serp/google-news-serp-api>
- DPB YouTube pricing: <https://data-provider-b.example/pricing/serp/youtube-serp-api>
- DPB Google Trends Explore: <https://docs.data-provider-b.example/v3/keywords-data-google-trends-explore-task_post/>
- DPB Google News: <https://docs.data-provider-b.example/v3/serp-google-news-task_post/>
- DPB YouTube Organic: <https://docs.data-provider-b.example/v3/serp-youtube-organic-task_post/>

### 10.22 データ処遇台帳

取得状態画面にsite別の `data_disposition` を追加した。単なるnull件数ではなく、`retained`、
`not_acquired`、`acquired_unconnected`、`normalized_merge`、`acquisition_failed`、
`intentionally_not_retained` を分け、観測数、期待数、差分、理由、是正方法、SHA-256 evidence digestを保持する。
現在runtimeでは元KW10,694行はdrop 0、SERP未取得10,594行、分析未接続raw 10件、GSC raw 681行、
window内正規化統合6行、競合content取得失敗29 URL、PAA回答未取得221固有質問を明示する。
WordPress本文は全量非保持という方針と、構造派生値の取得状態を同じ「取得失敗」にせず表示する。DB v30では
link/image/section/paragraph digestまで救出済みで、rendered HTMLに含まれなかったblock comment/schemaは0件とする。

### 10.23 34機能の完成証拠監査

`seo-tool-a-capability-completion-audit.v1` は34機能それぞれについて、完成判定、残存gap、blocker class、
権威実装path、検証command、行単位evidence digestを固定する。現時点で完成を証明できるのはquick search、
補助ツール、bookmarkletの3機能だけで、31機能は残存gapが完成主張を反証する。blockerは重複を許して、
corpus/acquisition depth 17、generation runtime/quality oracle 6、external provider/account data 5、
contract/auth parity 2、export/state coverage 1に分類した。監査全体の `completion_claim` は `not_proven` とし、
テストは34 IDの全包含、証拠pathの実在、未完成機能のblocker非空、digestを検証する。画面では取得状態から
全文を検索できる。

### 10.24 全viewの再現可能JSON snapshot

dashboard上部の「現在ビューJSON」は16 viewすべてをsite-scopedで出力する。schema version、生成日時、
出力日時、site、view、URL query filter stateと、`retained_evidence_only`、外部取得なし、credential露出なしを
envelopeへ付ける。複合viewは単純な表示表だけでなく、構成候補と生成候補、AIO domain/reference/element、
取得処遇・完成監査・raw/task・provider plan等を名前付きdatasetへ分離する。既存の需要・サジェスト・質問の
filtered CSV/JSONは維持する。任意column sortと全filterを共通URL契約へ統一する作業は残存gapである。

### 10.25 view URL stateとブラウザ内検索履歴

tab切替時に16 viewのIDを `view` queryへ保存し、再読込で同じ画面を復元する。quick、suggest、需要、質問の
確定検索はsite・種別・時刻とともに最大50件をlocalStorageだけへ保持し、クリックで該当画面へ再実行できる。
同一site・種別・値は最新1件へdedupeし、全消去操作を設ける。サーバー、DB、providerへ履歴を送信しない。
主要tableの任意column sortと、カテゴリー等を含む全filterの共通URL contractは未実装のため、data output機能は
まだpartial判定を維持する。

### 10.26 WordPress本文の非保持構造化（DB v30）

公開WP RESTの59記事を再取得し、`content.rendered` 自体はmanifest・DBへ保存せずSHA-256だけを保持した。
実測からsection 1,499件、paragraph/list/table等8,050件のtext length/digest、link 2,539件、image 1,222件を
正規化した。linkのうち2,061件は同一origin、2,047件は59記事のURL正本へ解決でき、全59記事が少なくとも
1本のincoming/outgoing記事間linkを持つ。各linkはsource article、section、anchor、元href、解決URL、target
article、evidence digestへ逆引きできる。本文テキストはparagraph/section rowへ残さない。rendered HTMLには
Gutenberg block commentとJSON-LD scriptが含まれなかったため、この取得面のblock/schemaは0件であり、
「存在しない」とは一般化しない。内部リンク画面と全view JSON exportへ接続した。

### 10.27 SERP根拠付き内部リンク候補

WP記事が確定した13 groupについて、group間の同時ランク関係をtask pairから集約し、非汎用modifier tokenも
補助根拠にする。実測記事間linkが既にある方向は除外し、source/target WP記事、anchor候補、source section候補、
共通SERP URL数、reciprocal rank score、元relation ID、evidence digest付きの `proposed` 候補だけを返す。
現在は17方向が該当する。scoreは共通URL数、reciprocal rank、modifier、section一致から算出するが、公開記事へ
自動挿入せず編集判断を要求する。これにより単なるlink graphではなく、検索意図の近さと現行link欠損を同時に
満たす施策候補へ閉ループ化する。さらに63 content briefへoutgoing/incoming候補とplan digestを戻し、本文生成
packageとは別の未承認link planとして表示する。17候補はそれぞれ1つのsource briefへ一意に接続される。

### 10.28 WordPress公開SEO headの別観測（DB v31）

`content.rendered`だけではSEOプラグインが公開ページの`head`へ出すtitle、meta description、robots、canonical、
Open Graph、Twitter Card、JSON-LDを観測できない。robots.txtの許可範囲内で59公開記事を別取得し、HTML本体を
保存せず、派生値とhead digestだけを`wp_page_seo_metadata`へ保持する。今回の観測ではHTTP 200、canonical、
description、robotsは59/59件。JSON-LD型は0/59件だったため、「サイトに構造化データがない」ではなく
「今回取得した公開headにJSON-LD scriptが観測されなかった」と限定して扱う。

### 10.29 公開SEO headの証拠境界付き監査

59記事の公開head証拠へ`wp-public-seo-audit.v1`を適用し、HTTP失敗、noindex、canonical欠落・不一致、title・
description欠落/観測目安外、OG不一致、重複title/description/canonicalを記事単位で検査する。各結果は元の
evidence digest、finding、severity、audit digestへ逆引きできる。現在の実測はcritical 0、warning 0、
informational 59で、情報事項は全記事の`json_ld_not_observed`のみ。文字数範囲はランキング保証ではなく
観測上の編集目安として扱い、JSON-LD未観測もサイト全体の不在へ一般化しない。画面とread-only API
`/api/v1/wordpress/seo-audits`へ接続する。

### 10.30 sitemap母集団とposts分析scopeの分離（DB v32）

robots.txtに宣言されたsitemap indexと配下3 urlsetを取得し、XML本文とrobots本文は保存せずsource digest、
lastmod、sitemap provenance、正規URLだけを保持した。公開母集団は70 URLで、post 59、固定page 9、home 1、
HTML sitemap 1。post 59はWP REST/GSC/SEO head分析へ全件接続できた。一方、残る11 URLは現行のpost本文由来
内部リンク証拠でもincomingを観測できず`surface_only_unconnected`となる。ただし本文RESTはheader/footerを含まない
ため、これは公開サイト全体の孤立を意味せず「現在保持する分析証拠へ未接続」と限定する。画面とread-only API
`/api/v1/wordpress/surface`へ接続し、固定ページ等を記事欠落へ誤分類しない。

### 10.31 公開document全体のnavigation再観測（DB v33）

sitemap 70 URLを公開取得し、HTML本文を保存せずdocument digest、SEO head、全anchorのsource URL・region
（header/main/footer/document）・解決URL・anchor textだけを保持した。70/70がHTTP 200、全link 12,586件、
同一origin 11,707件。REST本文では未接続だったhomeは69 sourceから413 link、問い合わせpageは5 sourceから
5 main linkを観測し、実サイト上の接続を証明できた。残る9 URLは観測した70 documentから参照なし。ただし
外部サイト、JS生成、未収載URLからのlinkまでは証明しない。固定pageのうち5件はnoindex。カテゴリlanding 4件は
sitemap記載URLが別の最終canonical URLへredirectするため、sitemap正規URL更新候補として分離する。これにより
REST本文scopeの欠落を公開navigation証拠で補完し、単純な孤立判定を避ける。

### 10.32 title・heading生成品質oracle v3（DB v34）

747生成候補について、候補文字列だけの採点から、根拠IDの実在、SERP需要文言の包含率、同一group競合title/
headingとの文字trigram最大類似、90%以上のcopy risk、75%以上の類似review、group内・group横断重複、既存WP
title/heading衝突、主KW、文字数、見出し階層、反復語を組み合わせる`evidence-bound-review.v3`へ更新した。
無関係テーマとの誤検出を避けるため競合類似は同じKW groupの取得pageだけを比較する。各候補はoracle入力結果、
issue、collision、quality score、review state、review digestへ逆引きできる。これはLLM品質を主観的に保証する
ものではなく、証拠欠落・コピー・構造破綻を公開前にfail closedする決定的gateである。

### 10.33 重複抑制title生成と証拠付きfallback

需要titleはmain keywordと需要文をそのまま連結せず、需要文からmain keyword tokenと汎用語を除いたaxisだけを
抽出し、`main keyword + axis + わかりやすく解説`へ構成する。需要根拠tokenの60%以上を含むことをoracle gateとし、
完全文字列一致による表記揺れ誤判定を避ける。需要titleが作れない場合でも競合heading evidenceがあれば、その
最上位editorial termから`competitor_heading_fallback`を作り、根拠page IDを保持する。fallbackは32件、title候補は
179件となった。

### 10.34 source task由来需要の限定復帰

PAA・関連検索は保存されていても、ブランドの英字／日本語表記などの字面差により`same_group`へ分類されず、生成
工程で利用されない場合があった。`same_group`需要が0件かつ競合見出し根拠が3本未満の群に限り、同一取得task・
group由来の観測済み需要を`source_task_fallback`として復帰する。同一意図への再分類ではない低信頼fallbackであり、
coverage、variant key、元proposal IDへ明示して逆引き可能にする。適用はgroup 60/61の2群・16候補に限定され、
63/63 groupが`brief_ready`となった。本文は全件`not_generated`で、引用・事実確認・公開承認gateはfail closedを維持する。

### 10.35 未取得SERP・PAA回答のsource単位取得計画（provider plan v3）

`data_disposition`で可視化した欠損を実行計画へ接続した。SERP未取得10,594 source rowは重複語でもsource IDを潰さず、
DPB Standard Google Organic depth 10を最大100 taskずつ106 POST batchへ分割する。2026-08-26再確認の公開単価
$0.0006/taskによる最大見積は$6.3564。取得済み100 taskのPAA回答は`people_also_ask_click_depth: 1`で再観測し、
baseと追加clickを合わせ最大$0.0750とする。PAAが存在しない場合や実行clickが少ない場合は返金されるため、これは上限
見積であり取得件数保証ではない。既存のTrends/Newsを含む実行可能計画総額は最大$6.5043。全jobは`not_executed`、
明示live flag・環境credential・正確な承認上限・実行直前の価格再確認が揃うまで課金しない。

### 10.36 競合本文取得失敗のSERP snippet救出（DB v35）

競合本文を取得できなかった10ページ（robots拒否3、HTTP error 4、fetch error 3）を元のDPB organic resultへURL単位で
逆結合したところ、10/10ページ、11 task-page観測でtitle・description・breadcrumbが残っていた。これを
`competitor_serp_snippet_evidence`へtask ID、rank、highlight、観測時刻、raw snapshot digest、派生digest付きで保持する。
画面/APIのcontent検索では`SERP snippetのみ`として検索・表示できるが、取得失敗statusは維持し、H1-H6、本文共起語、
文字数、内部・外部link、競合copy oracleへは混入させない。これにより追加取得なしで検索結果上の訴求文脈を救出しつつ、
SERPによる要約と公開本文という異なる証拠scopeを分離する。

### 10.37 organic SERP message・rich resultの分析接続

926 organic結果で保持済みフィールドを再監査し、description 918、pre-snippet 492、breadcrumb 926、highlight 839、
sitelinkあり257、rating 2、price 6、video属性19を確認した。従来は一部がDB/API projection止まりだったため、競合
content検索へpre-snippet、breadcrumb、sitelink title、rating値・投票数、表示価格を独立targetとして接続した。
`/api/v1/serp-results`も同じtarget検索とvideo/sitelinks/rated/priced feature filterへ対応する。画面では本文由来の
TITLE/H1-H6と、検索エンジン表示由来のSERP DESC/PRE/PATH/SITELINK/COMMERCEを別labelで表示し、証拠scopeを混同しない。

### 10.38 SERP field用途分類監査 v3

従来のcoverage auditはbooleanの`false`も「非空」と数え、task ID・status・xpathなど再現性に必要なprovenanceを
「意思決定未接続」と一括表示していた。v3ではrawで観測したprojection済み99 fieldを、施策接続28、証拠専用71、
未分類0へ分類し、raw-onlyも0であることを検証する。booleanはfield存在とtrueを分離し、organic 926件中video true 19、
image/featured snippet/malicious/web story/AMP true 0として保持する。監査JSONを画面へ常設し、未分類またはraw-onlyが
増えた場合に、保存漏れ・利用漏れをfield単位で検出できるようにした。

### 10.39 全table sort・全filter URL state

dashboard内の静的・動的tableを共通初期化し、全headerで任意列の昇順/降順sortを提供する。通貨・桁区切り・割合・
順位・件数は数値比較し、それ以外は日本語numeric collationを使う。選択列と方向は`sort.<view.table>`、各viewのfilterは
`f.<control-id>`としてURLへ保存し、再読込時にdependent selectを含め復元する。ARIA sort、tab focus、Enter/Space操作、
MutationObserverによる動的table再適用を含む。既存のfiltered CSV/JSON、16 view JSON snapshot、browser内50件履歴、copyと
合わせ、公開観測できたdata output契約範囲を実装済みと判定する。

### 10.40 未取得・非保持・projection切り捨ての横断監査

取得元からDB、`/api/dashboard`、read-only API、画面までを再照合した。raw SERPで観測した99 fieldはraw-only 0のままだが、
競合共起語は現行DBにgroup別46,870件、task別69,460件ある一方、初期dashboard JSONでは表示性能のため各identity上位20件、
合計1,260件・2,000件へ切り詰めていた。これは取得欠損ではなくprojection欠損なので、初期previewは維持しつつ
`GET /api/v1/cooccurrence?site_id=...`でgroup別全量、`scope=task`でtask別全量をcursor paginationするよう修正した。
実DBテストでそれぞれ46,870件・69,460件への到達を検証する。

意図的非保持も欠損と分離した。WordPress 8,050段落は位置、要素種別、所属section、文字数、digestを保持するが、本文文字列と
公開HTMLは保持しない。GSC raw queryは正規化集約後もraw tableを残す。競合本文取得失敗29ページは失敗statusを消さずSERP
snippetだけを別証拠として保持する。未取得の主要母集団はSERP 10,594 source row、PAA回答、market/rank履歴で、課金取得は
既存provider planの明示承認gateを越えず自動実行しない。これらの処遇をdashboardのデータ処遇台帳へ常設する。

### 10.41 公開API 952 fieldの個別処遇監査

41 schemaのflatten済み952 field occurrenceをschema・field path・出現順で一意化した。後述のURL別共起語証拠接続後は、
保持意味対応95、provider dataset未取得162、request control非互換168、wire contract/container形状500、partial operation内の
1:1未対応27へ分類している。
同一array pathのflatten重複103件も削除せず明示し、unique schema/pathは849件。未分類は0件である。保持意味対応は
`searchVolume → keyword_market_metrics.search_volume`のようにHELIX target columnを示すが、値定義やSeoToolA wire contractの
同一性までは証明しない。画面へ全件監査とdigestを常設し、1:1未対応27件と未取得162件を具体的なbacklogとして残す。

### 10.42 URL別共起語証拠とsite count（DB v36）

競合本文manifestには成功ページごとのterm countが残っていたが、DB v35まではgroup/task集計だけを保存していた。
DB v36で`competitor_page_terms`を追加し、現行上位10 runでは207,871行の本文count、title count、heading count、title/heading出現flagを
元page IDへ保持する。`/api/v1/cooccurrence?...&details=true`はページング対象termだけをURL・domain・SERP best rankと
結合し、URL別詳細、出現site数、見出し出現site数を返す。取得失敗29ページにはtermを補完せず0行のままとする。
これにより共起語契約のsite count・URL別count系7 fieldと、同時ランクKWのword count/relevance、content top KWの
word countを含む計10 fieldを追加で意味対応へ移した。SeoToolA `getDetails` wire互換や上位20page取得完了は主張しない。

### 10.43 観測SERP母集団のdomain重複比較

`/api/v1/domains`へ`target_domain`を追加し、100 task・各上位10件の`serp_page_keyword_edges`からdomain別KW集合を比較する。
重複KW数、target基準重複率、Jaccard率、競合固有KW数、target固有KW数、重複KW一覧を返し、policyとscopeに
`full_rank_database:false`を明記する。画面でも比較基準domainを選択でき、両方の率を並記する。実測例では
`detail.chiebukuro.yahoo.co.jp`の61観測KWを基準に`unison-career.jp`と28KWが重複し、target基準45.9%、Jaccard35.9%、
競合固有17、target固有33となった。これをSeoToolAの重複率と同じ分母だとは主張せず、定義が再現可能な独自比較として扱う。

### 10.44 上位10pageへの競合content証拠拡張

既存の上位3 run 190 URLを再利用し、保持済みSERPから上位10候補564 URLへ拡張した。新規取得374 URLを加え、
成功535、robots拒否13、HTTP error 12、fetch error 4となった。失敗29 URLもstatusとSERP snippetを保持し、
全29 URLでsnippet fallbackを利用可能にした（task×page観測では36件）。本文が取れないページへtermを推測補完はしない。

- 2026-08-27再観測ではH1-H6 18,424行、URL別term 208,202行、group別term 47,028行、task別term 69,572行をDB v36へ保持する。動的ページの変化を許容し、manifestとDBの完全一致をgateにする。
- evidence-bound生成候補は750件。品質oracleは`brief_ready` 727、`needs_review` 18、`blocked` 5で、根拠解決不能は0件。
- `blocked`には競合文面コピーリスク3件、既存衝突1件、group間重複2件が含まれる（1候補に複数issueを許す）。
- fallback候補14件のうち10件はtask単位のSERP snippetを根拠とし、取得失敗を候補消失へ直結させない。

これで「保持済み上位10 SERPを競合本文分析へ使わず捨てていた」差分は解消した。一方、上位11〜20のSERP・本文、
PAA回答、4年月次指標、全rank database、traffic/value/historyは依然として未取得であり、取得済みとは数えない。

### 10.45 見出し構造・文字数統計API/UI

`GET /api/v1/headings`を単純な見出し行検索から、保持済み上位10pageの構造分析へ拡張した。`level=1..6`、`q`、
複数`exclude`、`task_id`、`group_id`、`view=pages`を受け、各見出しの文字数・URL・domain・page title・本文文字数・
観測最高順位を返す。summaryはH1〜H6別件数、平均見出し数、平均見出し文字数、平均/中央値本文文字数、除外件数、
取得深度10/目標深度20を明示する。別siteのtask/group IDは404にしてscope漏洩を防ぐ。

画面の競合分析へ見出し検索、H1〜H6 filter、除外語、ページ別本文文字数・階層内訳・構造一覧を追加した。
18,424見出しを使う専用テストでfilter、除外、page集約、平均値、task scope、外部取得非発火を検証する。
上位11〜20は未取得のため、headline機能の完成判定は引き続き`partial`とする。

### 10.46 タイトル候補の競合benchmark・選定policy

`GET /api/v1/titles`を追加し、site内のtitle候補を`state`、`evidence_type`、`issue`、`variant`、`group_id`、`q`で
絞り込めるようにした。各候補へ記事群、品質oracle、根拠、現行WP title、同じ記事群で観測した競合titleと順位、
競合title文字数の平均・中央値・最小・最大を接続する。別siteのgroup IDは404とする。

`evidence-title-selection.v1`はblockedを除外し、review state、quality score、根拠数、35字からの距離、競合類似度を
固定順序で比較し、各記事群に推奨候補を最大1件付ける。同点はcandidate IDで決定し、`auto_approval:false`を返す。
現行実測は179候補・63記事群・63推奨で、根拠解決179/179。画面では品質、文字数、根拠種別、競合文字数分布、
類似度、issueを同じ行で比較できる。これは候補選定の再現性を高めるが、LLM model/prompt/output metadataを生成した
ものではないため、AI title機能の完成判定は`partial`のままとする。

### 10.47 H2/H3階層選定とdraft package v2

従来の`content-draft-package.v1`はready見出しをH2→H3順に最大50件並べるだけで、H3の親H2を保持していなかった。
`evidence-outline-selection.v1`を追加し、review state、quality score、根拠数、競合page/task/occurrence強度、candidate IDの
固定順でH2を最大8件選ぶ。H3は共有evidence ID数、正規化文字trigram Jaccard、同一evidence type、文字列包含の順で
H2へ接続し、H2ごと最大4件とする。同点もcandidate IDで決定でき、blocked・根拠未解決、および共有証拠・trigram・
包含がすべて0の候補は選ばない。同一evidence typeだけでは親関係の根拠と認めない。

`GET /api/v1/outlines`と画面は記事群別の全候補数、選定数、H2/H3数、除外数、根拠ID数、親score、共有証拠数、
trigram Jaccardを返す。現行実測は63 outline、571候補から503選定、H2 244、H3 259である。blocked 5件に加え、
意味のある親関係を証明できないH3 63件を未選定として保持し、無理にH2へ接続しない。
`content-draft-package.v3`にも同じoutlineを入力し、各H3へ`parent_candidate_id`とparent relationを保存する。
自動承認はせず、本文生成・引用承認・claim検証は引き続き別gateである。LLM outline model/prompt/output metadataは
未生成なので、AI heading機能の完成判定は`partial`のままとする。

### 10.48 未取得・非保持データとキーワード境界監査

データ処遇台帳を再検査した。10,694 source rowのうちSERP取得は100、未取得は10,594である。競合564ページは
本文構造535件、取得失敗29件で、失敗ページは29件すべてSERP snippetだけをfallback証拠として保持する。PAA質問
221件には回答本文・参照URLがなく、latest/monthly volume、SEO difficulty、全rank DBもlive未取得である。一方、
WordPress本文文字列・公開HTML・sitemap XMLは意図的に非保持とし、digest、section、paragraph位置・文字数、link、
image、block、schema、SEO headを派生保持する。GSC raw 681行は保持し、NFKC等価な3行だけを678行へ集約する。
SeoToolA OpenAPI 952 field occurrenceの処遇は、意味保持95、provider dataset未取得162、response 1:1未対応27、request
非互換168、contract shape 500で、未分類は0である。

`keyword-decision-audit.v1`は取得済み証拠だけから398件を判定する。内訳はSERP pair 339、同一正規化GSC queryを
複数記事が獲得する候補54、既存記事候補のgroup競合5である。119件を人手レビュー対象とし、279件は現状境界を支持する。
上位10 URL重複60%以上を統合レビュー、30%以上60%未満を分離＋内部リンク、同一groupなのに60%未満を再確認とする。
これは全rank DB未取得のscopeを明示した監査であり、自動統合・自動分割・記事割当変更は行わない。

### 10.49 通常organic動画属性の施策接続

SERP field監査では`organic.is_video`をdecision connectedとしていたが、action signal生成SQLはprice/ratingしか渡さず、
別テーブルの動画属性19件を処理直前に落としていた。`serp_organic_results`と`serp_organic_attributes`をtask・rankでjoinし、
19件すべてを`organic_result_attribute`証拠として動画埋め込み・要約・文字起こし候補へ接続した。特殊video枠の証拠とは
区別し、提案文・formatは重複排除する。action signalは8件から25件へ増え、動画signalは20 task、通常organic動画証拠は
19件、本文生成packageへは11記事群で伝播する。動画の内容自体は未取得なので補完せず、すべて未承認提案のままとする。

### 10.50 SERP表示ブランド占有と媒体publisher分離

`organic.website_name`は926件すべて保持していたが、従来はSERP証拠表示だけで競合施策へ接続していなかった。
`serp-brand-occupancy.v1`でwebsite nameを260表示identity、226 domainへ集約し、出現数、被覆task、記事群、Top3回数、
最高順位、reciprocal rank score、domain集合をdigest付きで保持する。YouTube、note、X、Instagramは「媒体名 · publisher」を
サイトbrandの表記揺れと誤認しないよう`platform_publisher`へ分離した。媒体publisherは38 identityである。

同じ表示brandが複数domainに出る実測はワンキャリアとサポーターズの2件で、複数domain運用レビューとして明示する。
反対にnote.comの21表示名、YouTubeの9表示名などはpublisher多様性であり、domain名揺れissueにはしない。選択siteの
自domain出現も別集計し、現行実測は1件である。`GET /api/v1/brands`と競合画面からbrand/domain両viewを検索でき、
未知domain推定、traffic推定、brand同一性の自動統合は行わない。

### 10.51 AIO非同期placeholderと回答取得済み母数の分離

AIO containerは68 taskで観測したが、内訳は本文・items・referencesを持つresolved 17件と、
`asynchronous_ai_overview=true`かつ全回答payloadが空の51件に完全分離された。従来の「AIO 68件」という表示は
引用・論点分析可能な母数を過大に見せるため、`aio-response-state.v1`で`resolved`、`async_pending`、`empty`を付与し、
分析可能率25%、再取得対象task ID 51件をsite別に保持する。AIO画面は観測68、回答取得済み17、非同期未回収51を
同時表示し、取得状態台帳にも`aio_answer_payloads`として差分51を追加した。

`GET /api/v1/aio-overviews`はstate filterと同じsummaryを返し、再取得mutationは行わない。field監査でも
`ai_overview.asynchronous_ai_overview`と、前節で施策化した`organic.website_name`をdecision connectedへ移し、
分類は30 decision connected、69 evidence-only、0 unclassifiedとなった。resolved 17件の96引用・69回答要素だけを
引用／論点分析へ使用し、51 placeholderから回答や引用を補完しない。

### 10.52 保存済みraw snapshotの再利用監査と履歴差分

raw取得台帳110件を「現行分析100」「同一KW履歴2」「隣接intent候補2」「別scope 6」へ全件分類した。従来の
`analysis_status=unconnected` 10件は一律に未接続と表示していたため、同じsite・同じKW・同じlocation/language/domainで
約3.5時間前に取得した2 snapshotを分析から落としていた。これを後続の現行snapshotへ接続し、organic観測1,016行を
snapshot単位で保持する。canonical URLの共有・新規・消失、順位差、title変更、SERP feature追加・消失を
`same-keyword-snapshot-diff.v1`で比較し、digest付きでDB・API・画面へ投影した。

実測では2履歴ともorganic 9 URLが全件共通で、新規・消失は0。`it 就活 サイト`は9 URLに順位またはtitle変化があり
`people_also_search`が追加、`it 就活サイト`は2 URLに変化があった。検索契約は両方一致する。隣接intentの
`it 就活サイト おすすめ`と`it 就活サイト 比較`はworkbook source identityがないため自動混入せずreview候補にし、
SEO・ライター系6件は別corpusとして隔離する。保存済み証拠の再利用であり、新規provider取得や自動group変更は行わない。
`GET /api/v1/snapshot-history`は履歴比較を、`view=reuse`は全処遇行を返す。

同APIの`view=targets`は`target`と`match_mode=domain|url_prefix|exact_url`を受け、保持履歴内の任意targetについて
前回順位、現在順位、差分、新規ランクイン、消失、title変更を返す。画面でも同じtargetを切り替えられる。実測の
`qiita.com`は2 KW両方で追跡できる。観測depth外を「圏外順位」と推測せずnullで保持し、新規外部取得も行わない。
これで検索順位監査の`single snapshot only`は解消したが、2時点・2 KWだけであり、120日継続履歴、target登録job、
top30/100取得、volume・difficulty・推定trafficは未実装なので検索順位チェック機能は引き続き`partial`とする。

既存のSeoToolA対応route `/api/v1/rank/status` と `/api/v1/rank/results` は、履歴実装後もそれぞれ
`not_acquired/history_count:0`と空配列を返していた。これは`/snapshot-history`だけを追加して既存contract projectionを
更新し忘れた矛盾である。両routeを同じ保持証拠へ接続し、statusは履歴2・追跡KW 2・最古/最新観測時刻を、resultsは
比較2件または`target`指定時のtarget trackを返す。継続schedule・provider history・mutationはfalseのまま明示する。

このAPI実装中、共通page関数が`limit`未指定の`null`を数値0へ変換し、下限1へclampしていたため、全page APIの
初期responseが意図した25件ではなく1件だけになる欠落も検出した。`null`・空文字は25、明示整数は1〜100、cursor未指定は0へ
分岐して修正し、meta totalだけでなくresponse data件数まで回帰テストする。DBからの削除ではないが、保持データをAPI利用者へ
渡さず捨てていたのと同等のprojection欠落として扱う。

### 10.53 SQLite read-path到達性と段落構造8,050行

SQLite全70テーブルのうちpopulate済み61テーブルを`projectDashboard`以降とAPIの実SELECT pathへ機械突合したところ、60テーブルは到達可能だったが、
`wp_content_paragraphs` 8,050行だけがINSERT後に一度も読まれていなかった。本文文字列は設計どおり非保持だが、59記事の
段落位置、`p` 6,204、`li` 1,798、`table` 48、所属section、文字数合計395,969、段落digestは保持済みである。

記事別summaryをdashboard projectionと内部リンク画面へ接続し、`GET /api/v1/wordpress/paragraphs`でarticle、element、
section検索とpaginationを提供する。APIは本文文字列を返さず、`text_retained:false`を明示する。これによりSQLiteの
populate済みテーブルは61/61でread pathを持つ。本文全文検索を後付けしたわけではなく、非保持境界は維持する。

### 10.54 page/domain集約APIのsite境界

`GET /api/v1/pages`は`site_id`を必須にしながら、globalな`serp_page_coverage`全565行をそのまま返しており、複数site
fixtureで別site URLが混入した。`GET /api/v1/domains`はdomain自体をsite taskで絞っていたが、keyword/group/page数と
rank scoreはglobal集約値をspreadしていたため、共有domainでは別site分の指標が混ざる設計だった。

両routeを選択siteの`serp_page_keyword_edges`からrequest時に再集約し、URL/domain、task、group、best rank、reciprocal
rank score、top KWを同じsite境界で計算する。各rowへ`scope.site_id`と`full_rank_database:false`を付ける。2-site fixtureで
siteごとの期待URL/domain集合・件数・scopeを照合し、別siteのURLだけでなく共有domainの集計値も越境させない。
market enrichment tableは現時点で空だがsite identity列を持たないため、live取得前のschema課題として残す。

初回修正ではedge列を`url`と誤記し、全URLが`undefined` keyへ集約されて565件が1件になる不具合をruntimeで検出した。
テスト側も同じ誤列名を使って期待値1を作っていたため、誤実装と誤oracleが同時に通っていた。実schemaの
`canonical_url`へ統一し、単なる自己整合ではなく主siteの既知母数565件も固定assertする。runtimeでもpages total 565、
`detail.chiebukuro.yahoo.co.jp`は44 page・61 KWと確認した。

### 10.55 DPB市場enrichmentのsite identity

live取得前監査で、検索量・月次推移・難易度・獲得KW・取得runの6テーブルに`site_id`がなく、`/market/status`、
`/market/results`、画面、JSON export、費用台帳がglobal値を参照していることを確認した。現行DBは追加市場データ0件のため
漏洩はまだ発生していないが、最初の取得後に別siteへ同じ結果と費用を表示するschema欠陥だった。

取得planを`data-provider-b-enrichment-plan.v2`へ上げて`site_id`を必須化し、normalized evidenceの全row、SQLite v37の主キー、
投影status、API、画面、export、data disposition、費用台帳まで同じidentityを伝播する。未登録siteのevidenceはDB buildを
fail closedする。2-site fixtureでは`site-a.example`だけに市場証拠を投入し、同siteのmarket APIは1件／acquired、
`site-b.example`は0件／not_acquiredになることを独立assertした。新規provider取得やAPI公開は行っていない。

### 10.56 特殊SERP featureのnested item正規化

SERP field監査はraw-only 0件としていたが、`knowledge_graph`、`people_also_search`、`images`、`video`の
`items[]`内部をfield単位で走査せず、親payload JSONを保持しているだけで「投影済み」と判定していた。実rawには
Knowledge Graph説明1件と出典link 2件、関連商品・サービス検索語6件、画像9件、動画4件の計20 itemが存在した。

SQLite v38で`serp_feature_items`と`serp_feature_item_links`へ分解し、文字列、text/title/alt/source、page URL、
image URL、公開時刻、出典domainをitem順序・feature/task/group identity・digest付きで保持する。元payloadも併存させ、
正規化時にfieldを落とさない。`GET /api/v1/serp-feature-items`、MCP `search_serp_feature_items`、取得監査画面の
検索・previewへ接続した。field監査もnested走査へ直した結果、従来見えていなかった22 field pathが加わり、
正規化直後は30 decision-connected、91 evidence-onlyだった。itemの値を形式・title・heading guidanceへ接続し、
`content-draft-package.v3`へ推奨形式、guidance、item/link evidenceを丸ごと渡すことで、42 decision-connected、
79 evidence-only、0 unclassified、0 raw-onlyへ更新した。観測候補は自動採用せず、検索意図・一次情報との照合を
package instructionに追加する。新規provider取得は行っていない。

### 10.57 特殊SERP観測からタイトル・見出し候補への逆引き

特殊SERPの20 itemはaction guidanceとdraft inputまでは到達していたが、実際の`content_generation_candidates`へは
接続されていなかった。SQLite v39で根拠型`serp_feature_item`を追加し、`people_also_search` 6件から比較・選び方の
TITLE 6件とH2 6件、images 9件・video 4件・knowledge graph 1件から形式別H2を各1件、計15候補生成する。
generatorは後続のaxis自然化を含む`evidence-bound-generation.v4`で、全候補が元item IDを保持し、20/20 itemを逆参照できる。

品質oracleは元itemの存在をDBで解決し、観測値を事実や採用案と混同しないよう全15件へ
`serp_feature_observation_review`を付ける。実測は全候補765件（TITLE 185 / 見出し580）、根拠解決765/765、
ready 727 / needs_review 33 / blocked 5。特殊SERP由来15件はすべて`proposed`かつ`needs_review`で、自動承認0件。
outlineは580見出し候補から510件を選び、H2 251 / H3 259となり、特殊SERP H2は7件が選定されたが
`auto_approval:false`を維持する。画面では特殊SERP候補を独立表示し、タイトル分析でも根拠種別filterを提供する。
新規provider取得、外部公開、remote pushは行っていない。

### 10.58 タイトルとoutlineの構成整合性oracle

候補単体の品質とH2/H3親子関係は検証済みだったが、推奨titleと選定outlineが同じ検索意図を説明するかは未判定だった。
SQLite v41の`content_plan_compositions`で63記事群ごとにbaseline/選定title ID、選定heading ID、共有根拠、title根拠再利用率、
title語彙のoutline被覆率、平均見出し品質、要確認見出し数を固定保存する。`content-plan-coherence.v2`は候補品質、
根拠共有、語彙整合を合成し、根拠再利用50%未満、語彙被覆50%未満、要確認見出し混入をissue化する。

v1で検出した語彙gap 21構成に対し、v2はbaselineと同じreview tier、title品質低下最大5点、根拠再利用率・語彙整合率の
非劣化を必須にして候補を共同採点する。さらに形態素監査で`わかる / やすい / 解説 / 検索 / ニーズ / 整理 / ?`を
生成テンプレート語と確認し、検索意図tokenから明示除外した。閾値を緩める修正ではない。残った1件から、上位2需要の
全形態素を連結するcompound title規則も特定した。v4は疑問代名詞・活用語・助詞を除外し、`早大 + 卒`のような連続語を
`早大卒`へ復元、重複なし最大3 axisへ制限する。4 axis以上はquality oracleがblockedにする。全185 titleでaxis超過0件、
不自然な7 titleを自然化した。実測では22/63構成のtitle選定がbaselineから変わり、実際のtitle品質差は全件0、根拠再利用率と
語彙整合率の悪化も0件だった。語彙整合率平均は52.66%から99.21%へ上がり、実質語彙gapは21から0構成へ減少、
ready 33→48、needs_review 30→15となった。
要確認見出し由来の15構成は選定titleだけで解消した扱いにしない。
選定見出し510件、要確認見出し19件を維持する。全構成は`proposed`、`auto_approval:false`で、参照title/heading IDは
765候補内に全件存在する。`GET /api/v1/compositions`、MCP `review_content_compositions`、コンテンツ施策画面、view exportへ同じ値を接続した。
要確認見出しを含む15構成は引き続き編集対象として残す。LLM実行、新規provider取得、外部公開は行っていない。

### 10.59 証拠境界draft・claim台帳・text/HTML出力（DB v42-v43）

`content-evidence-draft.v1`は63のbrief-ready packageを、title、H2/H3、段落、claimの固定構造へ決定論的に変換する。
検索結果で観測した論点であることだけを文章化し、数値・制度・固有事実を補完しない。全573 claimにkind、内部evidence ID、
一次情報検証状態を持たせ、draft revisionはsource package digestと独立したSHA-256を持つ。SQLiteの
`content_draft_revisions`へrevision単位で保存し、`GET /api/v1/drafts`、MCP `read_content_drafts`、コンテンツ施策画面、現在view JSON、個別text/HTML
downloadへ同じ値を接続した。

現時点は63/63 draftが生成済みだが、verified claim 0、publication blocked 63、auto approval 0である。AIO citation候補も
承認済みへ昇格しない。これは本文生成pipelineと版管理/export面を実装したもので、事実本文の完成を偽装しない。
LLM model/prompt/output、一次情報によるclaim検証、citation承認、複数revision比較、list/table生成は未実装である。

DB v43では、claimの根拠IDを文字列のまま放置せず、選定見出し510件の2,018参照を正本へ逆引きした。SERP需要proposal
316/316、競合page 1,684/1,684、特殊SERP item 18/18が解決し、未解決0件である。各参照にtype、label、URL/domain、
task/occurrence、snapshot/evidence digestの利用可能な値を保存し、draft別oracleと未解決queueを持つ。API/MCPの
`evidence_state` filterと画面で同じ台帳を確認できる。ただしこれは参照整合性の証明であり、記述内容の一次情報検証ではない。
verified claim 0、fact verification pending、publication blocked、自動承認なしを維持する。

### 10.60 claim別citation推薦queue（DB v44）

AIO参照96出現は従来記事group単位の候補で、どのclaimを支えるか未判定だった。`content-claim-citation-recommendation.v1`は
同一group内でURLをcanonical化・重複排除し、見出しと参照title/textの文字bigram Dice、見出しと取得元queryの一致、
organic URL/domain順位を別成分で採点する。語彙一致とquery一致がともに0なら、organic順位だけでは候補化しない。
claimごと最大3件、同点は順位とURLで決定する。

実測はAIO参照のある12/12記事群、107 claimに311候補、40固有URL。score 0.0800〜0.5263、平均0.2951である。
SQLiteへscore成分、元citation ID、取得元query、出現数、URL/domain/title/sourceを保存し、API/MCPの
`citation_state` filterと画面review queueへ接続した。311件はすべて`proposed / needs_review / unreviewed`、approved 0、
auto approval 0であり、citation候補をclaimの事実根拠として自動採用しない。

### 10.61 複合SERP intent fingerprintと統合・分割レビュー（DB v45）

従来のgroupingは形態素境界と上位URL交差を正本とし、判定監査もURL重複・GSCカニバ・記事割当競合が中心だった。
`serp-intent-fingerprint.v1`では各取得KWについて、順位逆数で重み付けしたdomain分布とページ型分布、観測SERP機能集合、
PAA/関連検索の種別分布、需要文の文字bigram集合を独立成分として保存する。task単位の入力と派生結果はSHA-256で固定し、
pair scoreはdomain 35%、ページ型25%、SERP機能15%、需要種別15%、需要topic 10%の決定論的加重値とする。

実測100 fingerprintの同一site全4,950 pairを評価し、現group内pair、要レビューpair、上位250の関連pairを合わせて356 pairを保持した。
別groupでもscore 0.62以上、domain類似0.30以上、需要topic類似0.25以上をすべて満たす21件を`merge_review`とした。
現group内でscore 0.38未満の`split_review`は0件だった。候補には総合scoreだけでなく5成分、現group境界、policy、digestを残す。
SQLite v45、`GET /api/v1/intent-fingerprints`、MCP `review_serp_intent_pairs`、キーワード監査画面へ同じ値を接続した。
groupの自動統合・分割は0件で、全候補を人手レビューに限定する。最大5,000件のLabs rank母集団は引き続き未取得である。

### 10.62 URL交差×複合意図の境界consensus oracle（DB v46）

複合intentの`merge_review` 21件を上位10のexact URL交差へ再結合すると、両方の統合閾値を満たしたのは
「it 就活 スケジュール」と「it 就活 流れ」の1件だけだった。意味・ページ型・domainが近くても、同じURLが上位を
占めなければ同一記事化の証明にはならない。この差を隠さず、既存URL監査が投影時に落としていたsource/target task IDも復元した。

`keyword-boundary-consensus.v1`はURL監査または複合intentでactionableな68 pairを対象に、統合合意1、分割合意0、
signal矛盾16、意味的隣接8、現group境界30、内部リンク境界13へ分類する。各行はURL overlap、共有URL数、intent scoreと
5成分、推奨action、reason code、両入力のevidence digest、task/group IDを保持する。意味的隣接は統合候補から
`keep_separate_related_topic`へ明示的に降格する。SQLite v46、`GET /api/v1/keyword-boundaries`、MCP
`review_keyword_boundaries`、キーワード監査画面へ接続し、全68件をreview-only、`auto_mutation:false`とした。

### 10.63 top3・top5・top10 SERP境界感度（DB v47）

seo-tool-aの同時ランク機能は参照上位数を変えられるため、top10の単一判定だけではgroup境界の安定性を証明できない。
保持済みorganic edgeから68境界pairをtop3・top5・top10で再計算し、各深度の左右URL数、共有URL数、共有URL本体、
overlap率、`merge / related / separate`分類を保存した。

実測では51/68 pairが深度によって閾値を跨ぎ、stable related 14、stable separate 2、stable merge 1だった。
唯一の統合合意「it 就活 スケジュール」対「it 就活 流れ」は共有率100%→60%→60%、共有URL数3→3→6で、
全深度mergeかつ境界oracleも合意した唯一の`robust_merge`である。閾値反転51件は単一depthのscoreで自動処理せず、
人手確認対象として残す。SQLite v47、`GET /api/v1/depth-stability`、MCP `review_serp_depth_stability`、
監査画面の深度比較表へ同じ証拠を接続し、`auto_mutation:false`を維持する。

### 10.64 SERP境界からtitle・outlineへの記事トポロジー逆引き（DB v48）

深度安定性68 task pairをgroup pairで重複排除すると24件となる。`content-topology-oracle.v1`はgroup境界を
統合レビュー1、深度反転による変更保留21、別記事＋内部リンクレビュー1、安定分離維持1へ分類した。
各groupについてmain KW、WP記事ID、施策状態、共同最適化済みtitle candidate IDと本文、選定heading ID、
composition review state/digestを逆引きする。

唯一の統合レビューは`it-shukatu-serp-012`と`it-shukatu-serp-042`で、どちらも新規記事候補であり、選定title 2件と
heading 10件を比較対象として保持する。統合時にどちらを存続groupにするかは`unresolved_not_auto_selected`とし、
元title・outlineを破棄せず編集判断へ渡す。SQLite v48、`GET /api/v1/content-topology`、MCP
`review_content_topology`、監査画面の記事トポロジー表へ接続した。全変更はreview-onlyで`auto_mutation:false`である。

### 10.65 title・heading統合差分と編集判断blueprint（DB v53）

`consolidation_review`だけを対象に、両groupの選定titleとheadingを編集可能な統合差分へ落とした。
見出しは正規化した文字bigram類似度60%と根拠ID Jaccard 40%を合成し、score 0.4以上を一対一の
重複候補として抽出する。残りは出典group・候補ID・heading level・根拠IDを失わず固有見出しとして保持する。

実測1 blueprintではtitle 2案、元heading 10本から重複候補3組・固有4本を得て、統合後の編集対象を7本へ投影した。
さらに存続groupを構成品質35%、title品質25%、根拠被覆30%、固有見出し保持10%で順位化し、各重複pairは
根拠数65%と候補品質35%で代表候補を比較する。実測では`it-shukatu-serp-012`を存続候補、重複3組すべてで
同group側の見出しを代表候補として推薦した。各component、weight、score、marginを保存するため結論を逆監査できる。

推薦された代表3本と固有4本は、各source outlineのpositionとH3親関係を使って統合後outlineへ再構成する。
代替されたH2を親に持つH3は代表H2へ親IDを解決し直し、候補欠落、親不明、予測件数不一致を構造gateで停止する。
最初のpreviewは見出し構造こそH2 4本・H3 3本で整合したが、代表見出し側の根拠だけを保持したため、
source union 21件に対しpreview unionは18件となり、相手側だけのSERP根拠3件を暗黙に落としていた。
v4では各重複見出しへ左右候補の根拠unionを継承し、元候補ID、代表14件、相手側9件、共有6件、
新規継承3件、統合後17件をlineageとして保存する。3組すべてに適用した結果、previewは21/21件、
保存率100%、欠落ID 0となった。`source_evidence_not_preserved` gateにより再発時はblockedになる。

最終previewはH2 4本・H3 3本の計7本で、候補欠落0、orphan 0、根拠欠落0、
`ready_for_editor_review`となった。

title側も同じ損失監査を行った。存続候補titleは需要根拠2件、もう一方は競合根拠9件で共有0のため、
存続候補本文だけでは9/11件を落とし、固有軸「流れ」も消える。両group共通語`it 就活`、固有軸
`時期 / 流れ`、coverage軸`sier / スケジュール / 業界`を分離し、5軸すべてを含む
`it 就活の時期と流れ｜sier・スケジュール・業界をわかりやすく解説`を決定論previewとして生成した。
元2候補ID、推奨元2件、継承9件、union 11件をlineage化し、軸coverage 5/5、根拠11/11、
文字数20〜50を別gateで検証する。

ただし推薦と確定を分離し、titleの`title_selection_state`とheadingの`resolution_state`は引き続き
`unresolved_not_auto_selected`、previewは`review_only_not_applied`である。SQLite v53、
`GET /api/v1/consolidation-blueprints`、MCP `review_content_consolidation`、監査画面の統合編集判断・
統合タイトルbrief・統合後アウトライン・統合根拠lineageへ同じ証拠を接続し、`auto_mutation:false`を維持する。

### 10.66 統合draftのclaim・根拠・citation lineage（DB v54）

統合前2記事のdraft revisionも、見出し統合後に捨てない。実データでは元12 claimを、intro 1件と
統合outline 7見出しに対応する計8 claimへまとめた。各統合claimは元claim ID、元group ID、元heading
candidate IDを保持するため、圧縮後も12/12件を逆引きできる。元draftの根拠ID union 21件は21/21件、
citation ID 14件は14件を保持し、citation推薦21件はすべて統合先claim IDへ再マップした。

このpreviewは検索観測から安全に言える検討論点だけを生成し、未検証の事実本文は補わない。
`primary_source_verification_pending`と`citation_approval_pending`を常にgate理由として保持し、
`publication_state: blocked`、`review_only_not_applied`、`auto_approval:false`とする。SQLite v54、
`GET /api/v1/consolidation-blueprints`（OpenAPI 2.2.0）、MCP `review_content_consolidation`、監査画面の
統合draft packageへ同一のlineageとdigestを接続した。

DB v55では同じ統合claimからtextとHTMLを決定論的にrenderする。各節はheading、検討論点、evidence ID、
source claim IDを含み、HTMLの`article`には`data-review-state="blocked"`を埋め込む。監査画面から両形式を
downloadできるが、出力可能と公開可能を混同せず、一次情報確認・citation承認gateは解除しない。
rendererは`content-consolidation-draft.v2`、blueprint policyはv7、OpenAPIは2.3.0である。

### 10.67 統合citation review queue（DB v56）

統合draft内のcitation推薦をJSONだけに閉じ込めず、21件すべてを
`content_consolidation_citation_recommendations`へ一行ずつ正規化した。元group・revision・claim、
統合先claim、URL/domain、rank、match scoreとcomponent、citation ID、source keyword、承認状態、
元推薦digestを保持する。実測はdigest 21/21一意、元claim 7、統合claim 7、URL 4、欠損0である。

`GET /api/v1/consolidation-citations`はsite必須で、全文、approval state、domain、統合先claimをfilterできる。
MCP `review_consolidation_citations`と監査画面の統合citation queueも同じ正規化行を使う。
全21件は`unreviewed`、`auto_approval:false`で、queue公開は引用承認を意味しない。OpenAPIは2.4.0、
MCPはread-only 21 toolとなった。

### 10.68 元claim単位のcitation coverage oracle（DB v57）

推薦21件がすべて移送済みでも、統合元の全claimに引用候補があるとは限らないため、統合claimごとに
source claim coverageを再監査した。実測7統合claimはいずれも候補3件・URL 3件・domain 3件で、表面的な
候補数とdomain多様性は十分だった。しかし重複見出し3件では、左側claimにだけ候補があり右側claimにはない。
適用対象source claim 10件中covered 7件、missing 3件、coverage 70%である。

`content_consolidation_citation_claim_audits`へ7行を正規化し、complete 4、partial 3、candidate zero 0、
diverse domain 7を保存する。元claim ID不足、候補数、URL/domain数、best/worst/average score、停止理由、
digestを逆監査できる。merged draft v3は`source_claim_citation_coverage_incomplete`を追加し、21推薦の移送完了と
10 source claimのcoverage不足を混同しない。API 2.5.0、MCP、画面へclaim auditとsummaryを接続し、
全7 claimをpublication blocked・unreviewed・auto approvalなしのまま保持する。

### 10.69 cross-group retained citation backfill（DB v58）

不足3 claimの原因は、group 042にAIO citation referenceが0件で、既存推薦器がsame-group corpusだけを
対象にしていたことだった。外部取得は行わず、保持済み96 referenceを全group横断で再スコアした。
minimum score 0.25、claimごと上位3件の厳格なreview-only候補として、3 claimすべてに計9件、unique URL 4件を得た。

各候補はtarget source group/claim、統合先claim、引用元group群、score component、閾値、既存統合URLとの重複、
`cross_group_retained_corpus`由来を保存する。現在のcitation coverageは7/10（70%）のままで、候補9件を
レビューして採用した場合だけ10/10（100%）見込みとなる。`proposed_unreviewed`、`review_only_not_applied`、
`auto_approval:false`であり、自動補完や公開gate解除はしない。DB v58、API 2.6.0、既存MCP citation tool、
監査画面へ補完前後を接続した。

### 10.70 cross-group citation boundary eligibility（DB v59）

語彙scoreだけでは別検索意図の記事から誤引用するため、補完候補9件のcitation出自groupと不足claimのgroup間を、
保持済みSERP intent pair、URL overlap境界、top3/5/10深度安定性で再監査した。出自group 004はURL overlap 0.30で
`internal_link_boundary_review`かつ深度により`threshold_flip`、005はintent similarity 0.586で`related_intent`、
035は対応する境界証跡がない。堅牢なcross-group merge consensusは0件だった。

`content_consolidation_citation_backfill_eligibility`へ候補ごとに出自group別の観測値、評価済み数、未評価group、
robust数、threshold flip数、reason code、適用状態、digestを保存する。実測9件はすべて
`adjacent_evidence_review`、threshold flipあり、うち8件は未評価group 035を含む。全9件を
`blocked_pending_editor_and_primary_source`・`unreviewed`・`auto_approval:false`とし、レビュー後coverage 100%は
候補充足見込みのままで引用適格性や公開可否を意味しない。API 2.7.0、既存MCP citation tool、監査画面で
適格性と停止理由を逆監査できる。

### 10.71 citation observation lineage（DB v60）

候補へcitation IDを配列で残すだけでは、URL単位の集約後に「どの取得で観測した引用か」を直接監査できない。
そこで`content_consolidation_citation_observation_lineage`を追加し、候補種別・候補digest・統合claim・citation IDから、
元AIO referenceのDPB task、source group、source keyword、reference order、観測時刻、raw snapshot digest、datasetへ
一行ずつ接続した。raw snapshotのローカルパスはAPIへ露出しない。

実測は既存統合推薦42関連、cross-group補完41関連の計83関連で、83/83 resolved、unresolved 0、壊れたdigest 0。
補完側はunique citation 16・task 6、既存推薦側はunique citation 8・task 2である。同じ引用が複数claim候補へ
寄与した事実を集約で捨てず、API 2.8.0、MCP、監査画面から観測時刻とsnapshot digestまで逆引きできる。
これはprovenance強化であり、citationの一次情報適格性・承認・公開gateを自動解除しない。

### 10.72 citation source authority oracle（DB v61）

AIO引用・検索上位・一次情報は同義ではない。統合推薦と補完候補のunique 8 URLを、保持済みURL/title、SERP
website name、page coverage、観測lineageからページ種別・source class・検索露出へ分類した。実測は記事型の
編集／商用publisher 5、企業一覧型aggregator 1、noteのUGC platform 1、ruleで断定できないweb source 1である。
8 URLはいずれも公式主体とclaim対象の関係を証明する保持証跡がなく、一次情報 provenは0だった。

`content_consolidation_citation_authority_audits`へURL単位でpage type/signals、source label、観測website name、
候補数、観測関連数、unique task、KW/group露出、best rank、一次情報状態、利用範囲、reason code、digestを保存する。
検索rankやAIO採用は発見性の証拠として保持するがauthorityへ昇格させない。全8 URLを
`not_proven_from_retained_evidence`、`contextual_support_only_pending_primary_source`、`unreviewed`、
`auto_approval:false`としてAPI 2.9.0、MCP、画面へ接続した。

### 10.73 claim別 primary-source requirement queue（DB v62）

一次情報未証明を一律の停止理由で終わらせず、統合draftの非intro 7 claimから論点を抽出し、必要な公式source
種別と探索queryを決定論的に逆算した。要求は企業公式の採用・選考日程3、官公庁／公的機関による業界定義・
統計3、SIer定義と企業公式日程の複合要求1である。全7 claimには現在の二次候補が3〜6 URLあるが、一次情報
proven URLは0で、7/7を`primary_source_required`とした。

`content_consolidation_primary_source_requirements`はclaim本文・論点、要求種別、必要source type、探索query、
現在候補URL、一次証明URL、gap、取得状態、承認状態、digestを保存する。queryは次回取得の要求仕様であり、
このsliceでは検索もprovider取得も実行しない。全7件は`planned_not_executed`、`external_acquisition_triggered:false`、
`unreviewed`、`auto_approval:false`で、API 2.10.0、MCP、画面からclaim coverageと並べて監査できる。

### 10.74 保持SERP内の公式・公的source再探索（DB v63）

一次情報要求を作るだけで終わらせず、すでに保存済みのorganic SERP全件を再走査し、`.go.jp`／IPA系の
公的機関と、URL pathが採用・careerを示す公式候補をclaim別に評価する。URL形状は一次情報の証明ではないため、
topic・取得元keyword・要求source typeに加え、日程claimの日程facetと企業entity scopeを独立して判定する。
企業名を特定していない一般claimへ企業採用ページを流用すること、日程情報が観測できないページを日程根拠へ
昇格することはfail-closeで禁止した。

`content_consolidation_retained_primary_source_discovery`はrequirement、DPB task、source keyword、順位、URL、
source class、類似度、source-type整合、entity/fact facet、棄却理由、digestを保存する。候補は
`retained_review_candidate`または`rejected_not_claim_sufficient`に分離するが、いずれも本文確認前であり
一次情報provenにはしない。全行が`retained_corpus_only`、`external_acquisition_triggered:false`、
`unreviewed`、`auto_approval:false`で、API 2.11.0、MCP、画面から要求claimへ逆引きできる。
実測では保持公式候補21 URL（企業採用候補19、公的機関2）×7 claimの147評価を欠落なく保存した。
企業scope未解決133、日程facet不足140で、review候補0、`rejected_not_claim_sufficient` 147となった。

### 10.75 snippet全量lineageと公式path誤分類修正（DB v64）

v63の候補抽出を再監査すると、`careers?`が単数`/career/...`にも一致し、就活メディア、求人サイト、大学の
career記事を企業公式採用候補へ含めていた。またURL重複時は最高順位1観測だけを選び、保持済みの別task、
description、pre-snippet、breadcrumb、website name、highlightをclaim判定へ投入していなかった。

v64では企業候補をsite直下の`/recruit/`、`/recruiting/`、`/careers/`、`/saiyo/`に限定する。
canonical URLごとに全organic観測を集約し、titleを含む6 text field、全task ID、source keyword、順位を
`content_consolidation_retained_primary_source_evidence`へ保存する。claim類似度は各保持断片との最大値、
日程facetは該当field名まで記録し、`observed_text_digest`で利用入力を固定した。

再計測では公式候補6 URL（企業候補4、公的機関2）、元organic観測7件となり、7 claimとの42評価と
42 evidence行を保存した。日程facet一致7、日程不足35だが、企業entity scopeまたはclaim適合gateにより
review候補0、棄却42である。API 2.12.0、MCP、画面は保持snippet fieldとdigestを返し、外部取得・自動承認は0のままである。

### 10.76 raw DPB primitive field lineage（SERP audit v4 / API 2.13）

従来のSERP coverage auditは既知fieldを手動列挙しており、`organic.links`の保存は確認できても、内部の
`links[].description`まで個別に棚卸ししていなかった。v4ではtask、result、全item typeを再帰走査し、配列indexを
`[]`へ正規化した非空primitive pathを自動抽出する。各leafはstructured/normalized、ancestor JSON、特殊SERPの
raw feature payload JSON、raw snapshot onlyのいずれかへ分類し、施策接続か証拠専用かも分離する。

100 raw DPB snapshotの実測は179 leaf field、投影179、raw-only 0、施策接続52、証拠専用127となった。
例えば`organic.links[].description` 5観測は`organic.links` ancestor JSONへ、Knowledge Graphの深いlink URLは
feature payload JSONへ逆引きできる。`GET /api/v1/serp-field-lineage`はfield、projection state、decision stateを
検索・filterでき、MCP `audit_serp_field_lineage`と画面にも接続した。MCPはread-only 22 toolとなった。

### 10.77 source-verified SERP field consumer（SERP audit v5 / API 2.14）

v4の施策接続判定はfield名の静的分類であり、実装内に実consumerが存在する証拠を直接持っていなかった。
v5ではfield patternごとにconsumer source、参照token、利用目的を宣言し、監査生成時にsource fileを読み取って
tokenの存在を検証する。検証できたfieldだけを`decision_connected`とし、宣言先に参照がなければ
`consumer_missing_fields`へfail-closeする。

100 raw snapshotの再計測は179 leaf field、投影179、raw-only 0、source検証済consumer 59、証拠専用120、
consumer欠損0となった。旧分類で施策接続としていた`organic.timestamp`、`organic.checks[]`、
`ai_overview.references[].type`は実consumerを証明できないため証拠専用へ戻した。一方、深い特殊SERP payloadは
正規化consumerまでsource参照を確認している。API、MCP、画面はconsumer file、用途、検証状態を返し、
「保存している」と「判断に使っている」を区別する。

### 10.78 rank observation-state oracle（snapshot diff v3 / API 2.15）

従来の順位履歴は、一方のsnapshotにだけ存在するURLを`gained`／`lost`と呼び、画面のnull順位を「圏外」と表示していた。
しかし保持snapshotはdepth制限された観測集合であり、不在から真の圏外順位は証明できない。v3ではsnapshotごとの
最大`rank_absolute`を実観測depthとして保存し、各URLの前回／今回を`observed`または
`not_observed_within_depth`へ分類する。状態は`entered_observed_depth`、`exited_observed_depth`、`retained`とし、
不在行は`outside_observed_set_unknown_rank`、`confirmed_unranked:false`でfail-closeする。

API 2.15と画面はnullを「観測なし（depth N）」と表示し、観測集合への出現・退出を新規／消失／圏外と断定しない。
target track v2のdigestにも両時点のobservation stateを含めた。保持履歴2比較は同一検索契約のまま再計算済みだが、
真の圏外確認、120日継続取得、target登録job、市場指標は未実装なので機能全体はpartialのままである。

### 10.79 SERP freshness distribution oracle（SERP audit v5 / API 2.16）

外部製品の画面再現ではなく、保持済みSERPの`organic.timestamp`をHELIXの編集判断へ接続した。
100 snapshot全体には日時511件があるが、施策判定は各taskの実観測上位10件だけに限定し、462件を使用する。
公開日時から観測日時までの日数を計算し、90日以内をfresh、730日以上をstale、日時coverage 30%未満を
`insufficient_timestamp_coverage`としてfail-closeする。未来日時は不正値として数え、鮮度判定には利用しない。

実測100 taskはfresh優勢16、stale優勢6、混在59、日時coverage不足19、未来日時不正0となった。
日時欠損からevergreen intentを推測せず、stale優勢でも更新不要とは断定しない。すべて編集レビュー用で、
自動更新・公開・外部取得は行わない。`GET /api/v1/freshness-signals`、MCP `review_serp_freshness`、
取得状態画面へ同じdigest付き投影を接続した。MCPはread-only 23 tool、field consumer監査は60接続・119証拠専用・欠損0となった。

### 10.80 SERP presentation integrity oracle（SERP audit v5 / API 2.17）

保持organic 926件の`type`、`page`、`position`、`xpath`、表示flag、`amp_version`、`checks`を、
施策入力前の表示証拠・取得contract品質ゲートへ接続した。施策対象は各taskの上位10件828結果で、動画flag trueは19件、
画像・featured snippet・malicious・web storyのtrueは0件、XPathは全保持集合で75種類だった。

重要な契約として、flagのtrueだけを観測表示形式の証拠とし、falseを「その形式の需要がない」という根拠にはしない。
`type=organic`、page 1、position left、XPath存在、`checks`とflagの一致を検証し、100 taskは異常0だった。
異常時は`review_required`へ止め、自動施策変更は行わない。`GET /api/v1/presentation-integrity`、
MCP `audit_serp_presentation`、取得状態画面へ接続し、MCPはread-only 24 tool、field consumer監査は
70接続・109証拠専用・欠損0となった。

### 10.81 exact search-contract oracle（SERP audit v5 / API 2.18）

task/result metadataを取得状態の表示だけで終わらせず、SERP比較の適格性判定へ接続した。API/function/engine/type、
location、language、device、OS、requested depth、endpointをSHA-256 fingerprint化し、request keyword・地域・言語・typeと
response echo、check URLのquery・言語、status/result countを照合する。不一致taskは`review_required`かつ比較不可とし、
同一keywordでもfingerprintが違えば履歴比較へ混ぜない。

実測100 taskはすべてverified、response/check URL不一致0、exact contract cohort 1、比較適格100だった。
`GET /api/v1/search-contracts`、MCP `audit_serp_search_contracts`、取得状態画面へ同じdigestで接続した。
MCPはread-only 25 tool、source検証済みfield consumerは98、証拠専用81、consumer欠損0となった。

### 10.82 PAA answer-state evidence（SERP audit v5 / API 2.19）

PAA 396質問の`expanded_element`を再監査すると、全質問に要素はあるが、384件は
`asynchronous_ai_overview:true`のplaceholderで、回答snippet・出典が解決済みなのは12件だけだった。
HELIXはplaceholderを回答本文として扱わず`async_pending`へ分離し、resolved 12件だけについて質問、取得元KW、
featured title、description、URL、domain、source titleを保存する。1件のtable回答はheader 3列・row 4行の構造を保持し、
文字列へ潰さない。resolved出典は12 domainだった。

`GET /api/v1/paa-answers`、MCP `search_paa_answers`、質問・潜在需要画面へ接続し、再取得mutationは提供しない。
MCPはread-only 26 tool、source検証済みfield consumerは109、証拠専用70、consumer欠損0となった。

### 10.83 AIO element source lineage（SERP audit v5 / API 2.20）

AIO回答要素69件の本文だけでなく、要素内reference 168、link 9、image 8を要素単位で正規化した。
引用付き要素は51、引用なし要素は18で、引用なしを根拠済みclaimとして扱わない。各referenceをAIO container全体の
reference一覧とcanonical URLで照合した結果、166 occurrenceは一致し、2 occurrenceは要素内にだけ存在した。

この2件はURL正規化誤差ではなく、同一追加URLが2 taskの「主なテストの種類」要素内に存在する一方、全体一覧から
省略されたelement-only引用だった。データを捨てずに保持し、引用完全性レビュー対象とする。
`GET /api/v1/aio-element-lineage`、MCP `audit_aio_element_sources`、AIO画面へ接続した。
MCPはread-only 27 tool、source検証済みfield consumerは128、証拠専用51、consumer欠損0となった。

### 10.84 SERP feature placement oracle（SERP audit v5 / API 2.21）

比較対象の画面を再現するのではなく、HELIXが保持するSERP表示枠の順位・ページ・position・XPathを施策前の
観測証拠へ接続した。270 occurrenceの内訳はPAA 99、関連検索99、AIO 68、people also search・video・images・
knowledge graphが各1件で、上位3位86件、4位以下184件、XPath 46種類、配置異常0件だった。

順位と配置は表示時点の事実に限定し、クリック率・検索需要・施策効果を推測しない。異常があれば
`review_required`として止め、自動変更や外部取得は行わない。`GET /api/v1/feature-placements`、MCP
`audit_serp_feature_placements`、取得状態画面へ同じdigestで接続し、APIは2.21、MCPはread-only 28 toolとなった。

この接続により、現在の保持snapshotで実際に非空だったraw primitive leaf 179 fieldは179 fieldすべてに
source検証済みconsumerがあり、証拠専用・consumer欠損は0になった。ただしこれは現在観測済みfieldの処遇完了を
示すだけであり、未取得provider dataset、PAA展開回答、pixel rectangle、競合本文、継続履歴などの取得完了を意味しない。

### 10.85 title SERP pattern oracle（API 2.22）

タイトル生成を固定templateだけで評価せず、63記事群ごとに上位タイトルの文字数IQR、主KWの先頭・含有・欠落、
疑問形、数字、括弧、区切り記号を実測した。185候補を照合すると、観測pattern内は8件、要確認177件で、
177件すべてが記事群別の文字数IQR外、6件は当該記事群の上位タイトルで未観測の疑問形だった。

これは「上位と同じ型なら順位が上がる」という因果判定ではない。観測分布から外れる候補を編集者へ示す品質oracleであり、
競合文言のコピー、自動承認、自動反映は行わない。`GET /api/v1/titles`の各候補、MCP `analyze_titles`、
タイトル比較画面へpattern reviewとdigestを接続し、APIを2.22へ更新した。LLM実行・model/prompt/output metadataは未実装のため、
記事タイトル生成機能全体は引き続きpartialである。

### 10.86 heading SERP pattern oracle（API 2.23）

63記事群の取得済み上位ページから、H2/H3別の文字数IQR、疑問形、数字、括弧、主KW含有と、ページ当たりの
H2/H3構成を実測した。生成済み580候補を階層別に照合した結果、観測pattern内400件、要確認180件、
文字数IQR外175件、当該階層で未観測の形態8件、階層証拠欠損0件だった。

このoracleは上位ページの形態をコピーするものでも、同じ構造が順位上昇を起こすと推測するものでもない。
候補の形態逸脱を編集レビューへ渡す品質gateで、自動承認・反映は行わない。`GET /api/v1/heading-patterns`、
MCP `review_heading_patterns`、コンテンツ設計画面へdigest付きで接続し、APIは2.23、MCPはread-only 29 toolとなった。
LLM outline variants、model/prompt/output metadataは未実装のため、記事見出し生成機能全体はpartialのままである。

### 10.87 keyword source lineage ledger（API 2.24）

15 sheet・10,694元行を正規化後の表示値だけで扱わず、source keyword ID・sheet・rowから階層、SERP取得、施策group、
関連KW候補まで行単位で逆引きした。source identityは10,694/10,694、階層接続も10,694/10,694で、取得済み100行は
100/100が単一groupへ接続し、複数group競合・lineage孤児は0件だった。

未取得10,594行のうち733行は関連KW候補へ接続済み、9,861行は階層台帳のみである。正規化重複cohortに属する149行も
統合で削除せず、各source rowを保持した。`GET /api/v1/keyword-lineage`、MCP `audit_keyword_lineage`、取得状態画面へ
digest付きで接続し、APIは2.24、MCPはread-only 30 toolとなった。これはDBのlossless lineageを証明するが、
未取得10,594行のSERP・市場指標取得完了を意味しないため、一括キーワード調査機能全体はpartialのままである。

### 10.88 related keyword boundary oracle（API 2.25）

関連KW 792 proposalを表示件数だけで評価せず、source row 733行ごとに候補groupを再集約した。677行は単一group、
56行は複数group候補だった。複数候補はproposal scoreの最高・次点差で、完全同点18行、10点未満の僅差5行、
10点以上の明確な先頭33行へ分離した。同点・僅差の23行はreview requiredとし、自動group割当を禁止する。

各候補にはtoken overlap、association、volume由来score、group、source ID、evidence digestを保持する。
`GET /api/v1/related-keyword-boundaries`、MCP `review_related_keyword_boundaries`、取得状態画面へ接続し、
APIは2.25、MCPはread-only 31 toolとなった。外部大規模index、match type、appearance historyは未取得なので、
関連キーワード機能全体はpartialのままである。

### 10.89 association evidence oracle（API 2.26）

- 保持済み7,087 keyword documentから得た1,636共起edge（585基準語）について、`pair_support / sqrt(term_document_count * associated_document_count)` を再計算し、source row・rank・自己参照・最低supportを検証する。
- 強336件・中395件・弱905件、相互top-K 1,002件・片方向top-K 634件。片方向は各語top-12打ち切りによる非対称であり、異常とは扱わない。
- evidence sampleは完全1,589件、20件上限47件。整合異常は0件。
- これは観測された行の共起証拠であり、類義語・意味的同値性・検索順位への因果を推論しない。外部association corpus未取得のため、比較対象との完全性は引き続き未証明。

### 10.90 variant evidence oracle（API 2.27）

- 10,694元keyword行から作成した921表記clusterについて、2,075元表記・1,492表記pairのsource identity、sheet/row座標、重複、件数を再検証する。
- 最大clusterは7表記、921 clusterすべて検証済み、整合異常0。
- 同一normalized token集合に由来する空白・語順・表記差であり、意味的同義性や文中での交換可能性は推論しない。外部辞書未取得のため意味的同義語機能の完全性は未証明。

### 10.91 semantic candidate review（API 2.28）

- 強い相互共起pairを重複除去し、保持済みSERP organic title・description・pre-snippetで各語が観測されたURL集合を比較する。
- 168関係候補を、複合語・固定句の可能性2件、文脈重複23件、文脈分離41件、SERP文脈不足102件へ分離。shared URL occurrenceは330件。
- `ガク` / `チカ`のように同一URL文脈が強すぎるpairは同義語候補へ昇格せず、複合語・固定句レビューへ隔離する。
- 編集判断済みは0件。意味的同値性や交換可能性を自動推論せず、外部辞書も未取得のため意味的同義語機能の完全性は未証明。

### 10.92 suggest evidence oracle（API 2.29）

- 保持workbook 10,694元行を10,619正規化候補へlossless集約し、source sheet/row、取得状態、volume観測を逆引き可能にする。
- 正規化重複候補74件・該当元行149件・volume競合20件、SERP取得済み100行・未取得10,594行、15 source sheetを監査する。
- dashboard projectionに欠けていた`normalized_keyword`・`source_order_index`・`source_location`を復元し、実際のサジェスト入力時に発生していたfrontend例外を修正する。
- 保持workbook検索であり外部autocomplete観測とは扱わない。Google、YouTube、Amazon、楽天、Bing、Google動画・画像・ショッピングのcoverageはすべてfalseのまま明示する。

### 10.93 question lineage oracle（API 2.30）

- 472質問候補をsource topic、demand occurrence、SERP task・source keyword、PAA回答状態、記事coverageへ接続する。
- 実測PAA 135件と関連検索からの決定的派生337件を混同せず保持。回答解決候補8件・async待ち128件、記事反映4件・記事欠落112件・未割当356件、lineage異常0件。
- 実測質問はPAA occurrenceの同一normalized textを必須とし、派生質問はgenerator versionとinput digestを保持する。いずれも自動承認しない。
- 100 seed外の大規模質問index、質問単位の相対検索量、未回収回答は引き続き未取得。

### 10.94 demand occurrence integrity（API 2.31）

- PAA 221件・関連検索493件、合計714固有需要を1,188 occurrenceへlosslessに再構成し、task/group/source keyword/snapshot digest/観測窓を検証する。
- group横断反復86件、group内反復105件、単一task観測523件。集約整合異常0件、orphan occurrence 0件。
- 全714件が単日snapshotだけで、複数日appearance historyは0件。first/last時刻が異なっても継続観測履歴とは主張しない。
- importance scoreは保持corpus内の相対scoreであり、絶対検索量を推論しない。再帰深度2と継続appearance historyは引き続き未取得。

### 10.95 simultaneous rank integrity（API 2.32）

- 339同時ランクrelationについてshared URL count、top10 overlap ratio、各共有URLのsource/target rankからreciprocal rank scoreを再計算する。整合異常は0件。
- 同一group 85件、group横断254件、top10完全一致2件。boundary review接続68件、intent review接続96件、URL evidenceのみ175件。
- 判断層未接続のURL evidenceも消さずに保持するが、共有URLだけからmergeを推論しない。すべてread-only・auto mutationなし。
- 最大5,000件の全rank keyword母集団は未取得のため、比較対象機能の完全性は未証明。

### 10.96 全記事群semantic resolution台帳（API 2.102 / SQLite v71）

- 主キーワードを持つ63記事群すべてについて、保持済みtyped semantic pathとtitle/H2候補をDB構築時に照合し、63 review・144概念別resolution taskをSQLiteへ永続化する。
- 各taskはpriority score/band、review effort、対象title/H2候補、候補group、元keyword ID、sheet/row付きsupport sample、意味path digest、解消要件、task digestを保持する。title/H2に重複するpreviewは概念単位へ集約する。
- SQLiteをclose/reopenした前後でreview digest、task digest、priorityが完全一致することを自動検査する。API/MCP/UIはリクエスト時の再計算ではなく同じ永続台帳を読む。
- 全記事群処理用に意味グラフ・10,694行inventory・group接続を共有し、同一実DBで意味解析区間を約68秒から約12秒へ短縮した。
- typed pathは曖昧性を含む編集判断用証拠であり、需要・同義性・順位因果・自動group割当・自動選定・自動本文変更は推論しない。外部取得費用は0 USD。

### 10.97 semantic resolution編集判断台帳（API 2.103 / SQLite v72）

- 63記事群・144 taskをsource task/review digestへ固定したdecision packetへ変換し、sense適合、直接group証拠、需要証拠、編集判断を別fieldで記録する。
- `approved_for_consideration`はsense=`relevant`、group=`supported`、demand=`observed`の全条件が揃わない限りvalidationで拒否する。古いtask digest、未知task、重複decision、schema不一致もfail closedにする。
- importerは既定dry-runで、`--commit`指定時だけSQLiteへdecision setとdecisionを保存する。同一reviewerの同一packet再投入は禁止する。
- API/MCP/UIへ未判断・考慮承認・却下・保留・reviewer不一致を投影するが、group割当、title/H2選定、本文変更への自動反映は常に0である。
- 実packetは144件すべて未判断のまま保持し、人手判断を実施したとは主張しない。外部取得費用は0 USD。

### 10.98 semantic resolution画面入力・export

- 概念別task画面にsense適合、直接group証拠、需要証拠、編集判断の4軸入力を追加した。1項目でも入力したtaskは4項目すべてが揃わない限りexportを拒否する。
- レビュアー識別文字列はブラウザ内でSHA-256化し、平文をdecision JSONへ含めない。packet digestとtask digestを含む`content-semantic-resolution-decisions.v1`を出力する。
- browser exportと同じhelperの出力を、既存importerのdry-run、明示`--commit`、SQLite close/reopen後のprogress投影までE2E検証した。
- browserはDBへ直接書き込まず、export後も自動group割当・候補選定・content変更は0。実判断は引き続き0件である。

### 10.99 semantic task証拠準備度・lineage drilldown

- 144 taskを、直接group証拠観測6件、候補group境界review 35件、source lineageのみ103件へ決定論分類した。3分類は排他的で合計144件となる。
- 各taskへ準備度reason、直接group証拠flag、候補group ID、境界review sample数、source sheet、元keyword ID/sample、意味path digestをpacket v2で保持する。
- API/MCPは準備度filterを提供し、画面は元keywordのsheet/row、文字列、候補group、境界state、keyword/path evidence digestを展開表示する。
- 準備度は編集作業のroutingであり、sense適合・需要観測・編集承認を代替しない。自動group割当・候補選定・content変更は0のままである。

### 10.100 盲検編集consensus・裁定queue（API 2.104）

- 永続化済みの盲検title/heading A/B判断をreviewer単位で重複排除し、78 pairを2名待ち・合意候補・不一致・意味保持違反・両案却下・同点裁定へ排他的に分類する。
- 2名未満は合意にせず、headingで一方でも意味保持がfalseなら、選好が一致しても必ず人手裁定へ戻す。両案却下・同点も自動勝者に変換しない。
- API/MCP/UIは候補originと解決表を隠したまま状態、reviewer数、選好集合、意味保持違反数、digestを表示する。自動選定・content変更は常に0である。
- 実DBは判断0件のため78/78 pairが2名待ちである。合意・品質・順位効果を捏造せず、実reviewer判断の投入後にのみ状態が進む。

### 10.101 機能完成証拠integrity gate

- 35機能の完成監査が引用する全artifactを存在確認し、内容SHA-256を監査recordと全体digestへ固定する。引用先の欠落・変更はdigest差分として検出できる。
- 全検証commandをNode scriptまたはpackage scriptとして解決し、存在しないscript・未定義commandを機能別に数える。証拠欠落またはcommand未解決が1件でもあれば、`implemented`表記だけでは完成証明へ昇格させない。
- 現行監査は35/35機能でartifact/command integrity成功、欠落0、未解決0。ただしcommandの解決性と実行済み証跡は分離し、実行attestationは0として明示する。
- 画面は完成6/35と同時に証拠整合35、証拠異常0、実行証跡0を表示する。これは残存gapや外部品質を完成扱いするものではない。

### 10.102 機能完成proof execution attestation

- 完成候補6機能が引用する検証commandを重複除去し、16 commandを実行した。各commandの終了code、signal、timeout、所要時間、stdout/stderr SHA-256と末尾をreceiptへ保持する。
- Node commandは対象test file SHA-256、npm commandはpackage script定義SHA-256をcommand-set digestへ含める。artifact集合・command実体・inventoryのいずれかが変わると旧receiptは一致せず、実際に再構築時に完成0/35へfail closedとなることを確認した。
- SHA追加後に16/16 commandを再実行し、類語・連想語・quick search・補助tool・data output・bookmarkletの6/6機能を再attestした。dashboard完全回帰は約19分49秒で成功した。
- receiptは外部取得・model実行・有料実行をすべてfalseで固定する。29機能の残存gap、人手品質、順位効果、外部contract parityはattestation対象外であり、完成監査は6/35のままである。

## 11. 未検証事項

- 公開API 24 operation / 41 schema / 952 fieldは全件処遇分類済み。保持意味対応95 fieldの値定義同等性と、1:1未対応27 fieldの実装は未完了
- Web UI 34 capabilityのinput/output/主要limit/credit/history/export棚卸しは完了。動的料金表の全セルと8補助ツール個別契約は未完了
- SEO難易度の公開説明とDPB Labs指標の数式・分布比較
- 同一seedでのseo-tool-a出力とDPB出力の合法的なside-by-side実測
- AI title/headingの生成モデル比較、編集履歴、承認workflow（決定論候補の入力選択・重複抑制・文字数・coverage oracleは実装済み）
- 利用規約・データ保持・派生データ再配布条件

これらを埋めるまでは「全機能調査完了」「DataProviderB利用確定」「競合超過完了」を主張しない。
