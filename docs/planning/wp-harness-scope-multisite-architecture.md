---
artifact_id: WP-PLAN-SCOPE-MULTISITE-ARCH-20260825
lifecycle_status: candidate
source_issue: 8
authority: planning-input
---

# WP HARNESS 全体スコープ・マルチサイト・論理境界

## 1. 位置づけ

本書は `HELIX-WP-HARNESS` の上位スコープと論理配置境界を固定する planning input である。
L2 freeze / L3 design を宣言せず、既存要求・PoC・実装の意味を縮退させないためのガードレールとする。
本書の対象は論理ディレクトリ構成と責務境界であり、後続の物理移設・実装・E2E 完了を本書の受入条件には含めない。

WP HARNESS は SEO 専用ハーネスではない。複数の WordPress サイトを対象に、集客、コンテンツ、
販売導線、分析、改善・再生、WordPress 運用保守を継続実行するマルチサイト運用基盤である。
SEO は現在の最初の実証スライスであり、全体スコープの上限ではない。

```text
HELIX-MARKETING-HARNESS
└─ media/wp = HELIX-WP-HARNESS
   ├─ portfolio / site context
   ├─ WordPress assets
   ├─ acquisition surfaces
   ├─ intelligence / growth / lifecycle
   ├─ operations
   └─ providers / platform / interfaces

HELIX-WP-THEME
└─ render / dry-run / apply / rollback 等の実行基盤
```

## 2. 対象能力

最低限、次を同一の WP 運用基盤から扱える境界を維持する。

- Organic Search / SEO
- AIO / LLMO / AI Search
- Google News / Discover
- SEO content / original column / news
- homepage / service page / fixed page / landing page
- internal link / conversion / affiliate / experiment
- observe / optimize / refresh / regenerate / consolidate / retire
- WordPress core / plugin / theme / compatibility / security / performance
- backup / restore / monitoring / incident response
- existing-site handover / new-site provisioning

YouTube 等の別媒体は本リポへ内包しない。必要時は `HELIX-MARKETING-HARNESS` の媒体別リポとして追加する。

## 3. マルチサイト境界

### 3.1 必須識別子

```text
site_id
installation_id
environment_id
wp_blog_id          # WordPress Multisite 使用時のみ
asset_id
provider_account_id
credential_ref      # credential値ではなく安全な参照
```

### 3.2 不変条件

1. 全 entity / event / evidence / job は `site_id` に束縛する。
2. 外部 write は `site_id + environment_id` が確定しなければ fail-close する。
3. WP post ID は installation 内の識別子であり global ID として使用しない。
4. provider cache、DataProviderB budget、GSC/GA4 dataset、WP credential reference は site/account 境界を持つ。
5. 通常の site view で他サイトの KW、記事、GSC、内部リンク、操作を混在させない。
6. cross-site 集計は portfolio projection でのみ明示的に行う。
7. `standalone_installation` と `wp_multisite_network` の両方を表現可能にする。
8. 後続実装では、2サイト以上の実データE2Eで site isolation を検証するまでマルチサイト完成を宣言しない。

## 4. 論理ディレクトリ境界

```text
src/
├─ portfolio/
│  ├─ sites/
│  ├─ installations/
│  ├─ environments/
│  ├─ strategy-profiles/
│  ├─ connection-profiles/
│  └─ site-context/
│
├─ assets/
│  ├─ posts/
│  │  ├─ seo-content/
│  │  ├─ original-column/
│  │  └─ news/
│  ├─ pages/
│  │  ├─ homepage/
│  │  ├─ service/
│  │  ├─ fixed/
│  │  └─ landing-page/
│  ├─ media/
│  ├─ taxonomy/
│  ├─ navigation/
│  └─ forms/
│
├─ acquisition/
│  ├─ organic-search/
│  │  ├─ keyword-research/
│  │  ├─ search-intent/
│  │  ├─ serp-grouping/
│  │  ├─ opportunity/
│  │  ├─ on-page/
│  │  └─ performance/
│  ├─ ai-search/
│  │  ├─ ai-overview/
│  │  ├─ llm-visibility/
│  │  ├─ crawler-observation/
│  │  └─ machine-readability/
│  └─ news-discover/
│     ├─ eligibility/
│     ├─ freshness/
│     ├─ distribution/
│     └─ performance/
│
├─ intelligence/
│  ├─ observations/
│  ├─ deterministic-analysis/
│  ├─ ai-hypotheses/
│  ├─ opportunities/
│  └─ decisions/
│
├─ growth/
│  ├─ internal-links/
│  ├─ conversion/
│  ├─ affiliate/
│  ├─ offers/
│  └─ experiments/
│
├─ lifecycle/
│  ├─ plan/
│  ├─ create/
│  ├─ publish/
│  ├─ observe/
│  ├─ optimize/
│  ├─ refresh/
│  ├─ regenerate/
│  ├─ consolidate/
│  └─ retire/
│
├─ operations/
│  ├─ inventory/
│  ├─ wordpress-core/
│  ├─ plugins/
│  ├─ themes/
│  ├─ compatibility/
│  ├─ security/
│  ├─ performance/
│  ├─ backup-restore/
│  ├─ monitoring/
│  └─ incidents/
│
├─ providers/
│  ├─ data-provider-b/
│  ├─ search-console/
│  ├─ analytics/
│  ├─ wordpress/
│  │  ├─ rest/
│  │  ├─ cli/
│  │  └─ theme-contract/
│  ├─ xserver/
│  │  ├─ api/
│  │  ├─ cli/
│  │  └─ ssh/
│  ├─ browser/
│  ├─ http-fetch/
│  ├─ a8/
│  ├─ gtm/
│  └─ ai-models/
│
├─ platform/
│  ├─ evidence/
│  ├─ approvals/
│  ├─ gates/
│  ├─ policies/
│  ├─ jobs/
│  ├─ scheduler/
│  ├─ cost/
│  ├─ observability/
│  └─ config/
│
└─ interfaces/
   ├─ api/
   ├─ cli/
   ├─ events/
   └─ ui-bff/

ui/
├─ portfolio/
│  ├─ sites/
│  ├─ approvals/
│  ├─ health/
│  └─ cross-site-performance/
└─ site/
   ├─ overview/
   ├─ content/
   ├─ acquisition/
   ├─ growth/
   ├─ lifecycle/
   └─ operations/

contracts/{site,asset,provider,evidence,event,theme}/
db/{schema,migrations,repositories,projections,queries}/
artifacts/poc/
docs/{planning,requirements,design,test-design,adr,poc,operations}/
tests/{unit,contract,integration,e2e,regression,multisite,fixtures}/
tools/{migration,evidence,diagnostics,maintenance}/
```

これは論理責務の正本候補であり、本PRで空ディレクトリを大量生成しない。物理移設は保存則付きの後続原子PRで行う。

## 5. 意味境界

### 5.1 SEO content と Organic Search

`assets/posts/seo-content` はコンテンツ資産種別、`acquisition/organic-search` は検索獲得・解析能力である。
Organic Search の分析はSEO記事だけでなく、HP、LP、ニュース、コラムにも適用可能でなければならない。

### 5.2 News と News/Discover

`assets/posts/news` はニュース記事の企画・速報・更新・訂正を扱う。
`acquisition/news-discover` は Google News / Discover の適格性、配信、実績を扱う。
記事種別と獲得面を同一責務にしない。

### 5.3 Content lifecycle

`refresh / regenerate / consolidate / retire` は SEO 専用にしない。

```text
observation
→ deterministic analysis
→ AI hypothesis
→ decision
→ lifecycle action
→ new asset version candidate
→ gate
→ approval
→ publish
→ observation
```

AI は仮説・生成・提案へ使用できるが、決定論的に計算可能な集計・状態・保存則の正本にはしない。

## 6. DataProviderB provider境界

現行PoCは Google Organic SERP について次を実証済みである。

```text
POST /v3/serp/google/organic/live/advanced
POST /v3/serp/google/organic/task_post
GET  /v3/serp/google/organic/task_get/advanced/{task_id}
GET  /v3/serp/google/organic/tasks_ready
```

100KW実証では JP / ja / desktop / windows / depth 10 を使用し、task ID、raw response、digest、cost、
Organic、PAA、Related Searches、spell、SERP featureを証跡化している。

現行 `scripts/poc-keyword-serp.mjs` は provider I/O と consumer解析を同居させているため、後続移設では次へ分離する。

```text
providers/data-provider-b/
├─ client/
│  ├─ auth
│  ├─ request
│  └─ errors
├─ serp/google-organic/
│  ├─ live-advanced/
│  ├─ standard-queue/
│  ├─ task-recovery/
│  └─ replay/
├─ normalizers/
│  ├─ organic/
│  ├─ paa/
│  ├─ related-searches/
│  ├─ ai-overview/
│  ├─ spell/
│  └─ serp-features/
├─ evidence/
│  ├─ manifest/
│  ├─ raw-snapshot/
│  └─ digest/
├─ cache/
├─ budget/
└─ contracts/
```

SERP grouping、search intent、article grouping は provider へ置かず、`acquisition/organic-search` がsnapshotをconsumeする。
取得modeは `live_advanced | standard_queue | resumed_live | recovered_ready` を証跡へ正確に保持する。

## 7. 既存PoC・実装の対応先

| 現行資産 | 論理配置 |
|---|---|
| REST block roundtrip | `assets/posts` + `lifecycle/publish` |
| 本番記事reverse / roundtrip | `assets/content-model` + `lifecycle/regenerate` |
| DataProviderB SERP / PAA / AIO / suggestion | `providers/data-provider-b` |
| 固定page roundtrip | `assets/pages/fixed` |
| SWELL / Neo deterministic render | `providers/wordpress/theme-contract` |
| GSC取得 | `providers/search-console` |
| GSC分析 | `acquisition/organic-search/performance` |
| article matching | `intelligence/deterministic-analysis` |
| internal-link candidate | `growth/internal-links` |
| regeneration判断 | `lifecycle/regenerate` |
| XServer provisioning | `providers/xserver` + `operations` |
| backup→update→cache purge→smoke→rollback | `operations` |
| SQLite projections | `db/projections` |
| dashboard API | `interfaces/api` |
| dashboard UI | `ui/site/*` |

`artifacts/poc` は証跡として保持し、物理再配置のためにrawを複製しない。

## 8. Issue #7 / PR #6との関係

Issue #7 は数値根拠、PoC分解、SEO先行sliceの参考として有効だが、WP HARNESS全体の上位スコープ・
ディレクトリ正本としては本Issue #8 / 本書により supersede する。

PR #6 の search-intent / required-topics PoC自体は否定しない。ただし本境界がmainへ入るまでHOLDし、
再開時に `acquisition/organic-search`、`intelligence`、共有`lifecycle`境界へrebase / 再配置する。

## 9. 無挙動移設の保存則

後続の構造移設PRでは機能追加、閾値変更、分母変更を混在させない。
最低限、現在確定している次の値を維持する。

```text
100 KW
64 article groups
63 main confirmed
1 unresolved
13 WP article IDs
681 raw GSC queries
678 normalized queries
52 observed articles
7 unobserved articles
```

差分が生じた場合は「移設による変化」として許容せず、別の意味変更PRとして証跡と承認を要求する。

## 10. 後続順序

1. 本planning boundaryをmainへ入れる。
2. `portfolio/site-context` の契約を原子PRで導入する。
3. DataProviderB provider I/Oをconsumer解析から分離する。
4. 既存SEO PoCを `acquisition/organic-search` へ保存則付きで移設する。
5. GSC / WP / XServer providerを同様に分離する。
6. assets / lifecycle / operationsを接続する。
7. 2サイト実データE2Eでsite isolationを検証する。
8. AIO/LLMO、News/Discover、HP/LP、保守の各縦sliceを同じ境界上で実証する。

## 11. 本planning変更の受入条件

- WP HARNESSをSEO専用と定義していない。
- SEO-first と SEO-only を区別している。
- AIO/LLMO、News/Discover、HP/LP、WordPress保守を全体スコープから落としていない。
- portfolio/site-context が全ドメインより上位にある。
- provider と consumer解析を分離している。
- lifecycle/regenerate をSEO配下に閉じていない。
- YouTube等の別媒体をWPリポへ混在させていない。
- 現行PoCの挙動・分母・閾値を変更していない。
- L2 freeze / L3 design を本書だけで宣言していない。
