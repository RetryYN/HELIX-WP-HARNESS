# WP Operations Dashboard prototype (WP-PROT-UI-02-r3)

L2要求洗い出し用の静的HTML prototype。production codeではなく、画面構成とPO判断flowへのreactionを
得るための成果物である。表示dataは全てfixtureで、WordPressや外部serviceへ接続・writeしない。
`fetch` / `XHR` / `WebSocket` / 外部CDN参照を一切含まない。

```bash
python3 -m http.server 4173 --directory docs/prototypes/wp-ops-dashboard
# file:// で直接開いても同じように動作する
```

## 対象surface

| surface | route | L1 | 収録範囲 |
| --- | --- | --- | --- |
| WP-UI-01 | `/` | WP-SCR-01 | 承認queue、判断詳細、公開可能条件dialog、運転状態、成果summary |
| WP-UI-02 | `/articles` | WP-SCR-02 | KW母集団1,000件の帰属会計、記事一覧、除外理由内訳 |
| WP-UI-03 | `/audit/clusters` | WP-SCR-03 | cluster判定根拠、導出規則version、PO override |
| WP-UI-07 | `/outcomes` | WP-SCR-07 | L1成功基準、測定sourceつき指標、売上・コスト内訳 |
| WP-UI-04/05/06/08 | 各route | 各L1 | P1のためplaceholder（次revisionで確認する旨を明示） |

## 判断ホームのsub-tab（r2への変更要求「タブ分割したほうがいい」への反映）

判断ホーム（WP-UI-01）は、POの問い「今、判断が必要か。運転は正常か」を3区分へ分割した。
主要画面ナビ（ホーム／記事・KW／処理の監査／成果）とは階層が違うため、暗色の左レールに対し
sub-tabは明色のsegmented controlとし、上部に「ホーム内の区分」と明示する。

| tab | 何を決める / 確かめるか | 収録 | badge |
| --- | --- | --- | --- |
| 判断待ち | 承認・差し戻しを1件決める | 承認queue、判断詳細、公開可能条件dialog | 判断待ち件数（判断不可の内訳をaria-labelへ） |
| 運転と注意 | 運転は正常か | 運転strip（site/判断待ち/処理中/失敗/次の自動処理）、承認対象でない要確認 | 要確認件数 |
| 成果サマリ | L1成功基準の現在値 | 売上÷コスト、月次推移、測定sourceつき指標4件 | 現在値 `1.64×` |

- 各tabの末尾・冒頭に「ここに無いものはどのtabにあるか」の受け渡し導線を置く。
- `empty` / `failure` / `timeout照合` は判断pipelineの状態なので **判断待ち** tabが所有する。
  所有しないtabでは最新表示を保ったまま、状態の所在を示すscope noteとbadgeを出す。
- `loading` は取得全体に掛かるため全tabがskeletonを出す。skeletonはtabごとに本表示と同じ骨格。

## 表示状態の切替

画面上部の **PROTOTYPE 操作** バーで、同じ画面の6状態を切り替えて確認できる。

`normal` / `stale` / `loading` / `empty` / `failure` / `timeout照合`

- `stale` — 何がいつから古く、期待間隔は何か、**その判断への影響はあるか**を明示する
- `empty` — 証跡がない理由、次回取得予定、必要なPO actionを表示する
- `failure` — failure step、外部writeの有無、evidence ID、retry / 再入場ownerを表示する
- `timeout照合` — 要求内容とWP側実測を並べて比較し、自動再送を禁止する
  （`reconciliation_required`）

## deep link

`index.html#/<surface>?state=<state>&t=<home-tab>&d=<decision>&c=<cluster>&f=<filter>` で、
対象・sub-tab・filterを保持したまま再入場できる（L2 screen-flow.md の navigation 要件の確認用）。
`t` は判断ホームのsub-tab（`decide` / `runtime` / `outcome`）で、reloadでも選択中tabを保持する。

```
index.html#/home?state=reconcile             # 判断待ちタブで照合パネル
index.html#/home?state=normal&d=D-1839       # 公開条件がredの対象を選択した状態
index.html#/home?state=normal&t=runtime      # 運転と注意タブ
index.html#/home?state=empty&t=outcome       # 状態を所有しないタブでのscope note
index.html#/articles?state=stale&f=red
```

## 承認flowの確認手順

1. ホームの **判断待ち** タブで承認queueの対象を選ぶ（`D-1842` は7/7 green、`D-1839` は1件red）
2. 「条件7件を確認する」→ 公開可能条件dialog（`docs/requirements/s1-draft-post-requirements.md`
   の公開可能条件1〜7と番号が1:1で対応）
3. STEP 2 で承認理由を入力 → 「承認して公開する」
4. operation ID、承認record、公開write、公開後GET検証、証跡記録がchainとして表示される
5. 「prototypeを初期状態へ戻す」で再確認できる

`D-1839` では条件3がredのため承認buttonがdisabledになり、公開writeが0件であること（AC-S1-008）を
画面上で確認できる。

## keyboard / focus

- `Tab` 先頭で「本文へ移動」skip linkが出る
- 左nav（tablist）、ホーム内sub-tab（tablist）、状態切替（radiogroup）は
  矢印key・Home・Endで移動する（roving tabindex。選択は移動と同時）
- sub-tab切替後は再描画されたtab buttonへfocusを戻し、`aria-live`で件数まで読み上げる
- dialogは`<dialog>`のmodal focus trapを使い、閉じると起動元buttonへfocusが戻る
- `Escape`は取消として扱い、「外部writeもoperation追記も行っていません」を通知する
- 状態badgeは色だけに依存せずlabelとiconを併記する
- 画面遷移・承認・取消は`aria-live`で読み上げる

## 確認対象（reaction checklist）

0. sub-tabの区分と命名（判断待ち / 運転と注意 / 成果サマリ）が、判断の順序と合っているか
1. 開いた直後に必要な判断・理由・riskが分かるか
2. post ID、content digest、公開可能条件、rollbackを確認して公開承認できるか
3. 判断前に理由、risk、外部影響、rollbackが足りるか
4. キュー0件時（`empty`）に正常と次回予定を誤解なく判断できるか
5. smartphoneで承認に必要な情報が欠落しないか
6. failure（`failure`）とtimeout後のrecovery（`timeout照合`）が区別できるか

PO reactionは`docs/requirements/discovery/events.jsonl`へ追記し、accepted revisionを固定する。

## Render evidence

- `prototype-home.png` — 1440×1100 Chrome headless
- `prototype-mobile.png` — 390×1100 Chrome headless

```bash
google-chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=5000 --window-size=1440,1100 \
  --screenshot=prototype-home.png "file://$PWD/index.html"
```
