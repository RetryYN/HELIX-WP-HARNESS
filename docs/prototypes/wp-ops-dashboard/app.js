/* ==========================================================================
   WP Operations — L2 画面prototype (WP-PROT-UI-02-r3)

   fixture-only。fetch / XHR / WebSocket を一切使わず、外部通信も本番writeも
   行わない。全ての「実行」はprototype上の表示遷移である。
   ========================================================================== */
"use strict";

/* --------------------------------------------------------------------------
   0. 小さなユーティリティ
   ------------------------------------------------------------------------ */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

let toastTimer = null;
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node.classList.remove("show"), 4200);
}

function announce(message) {
  const live = $("#live-region");
  live.textContent = "";
  window.setTimeout(() => { live.textContent = message; }, 40);
}

/* --------------------------------------------------------------------------
   1. surface 定義（L1 screen.md / L2 screen-list.md のIDを保持）
   ------------------------------------------------------------------------ */

const SURFACES = [
  { id: "home",      surface: "WP-UI-01", screen: "WP-SCR-01", route: "/",               nav: "ホーム",           title: "判断ホーム",     glyph: "⌂", question: "今、判断が必要か。運転は正常か",           count: 2 },
  { id: "articles",  surface: "WP-UI-02", screen: "WP-SCR-02", route: "/articles",       nav: "記事・KW",         title: "記事・KW",       glyph: "▤", question: "全KWがどの記事・除外理由へ帰属したか" },
  { id: "audit",     surface: "WP-UI-03", screen: "WP-SCR-03", route: "/audit/clusters", nav: "処理の監査",       title: "処理の監査",     glyph: "◈", question: "なぜこのcluster・gate判定になったか" },
  { id: "outcomes",  surface: "WP-UI-07", screen: "WP-SCR-07", route: "/outcomes",       nav: "成果",             title: "成果",           glyph: "↗", question: "収益と費用、L1成功基準の現在値は何か" },
  { id: "aio",       surface: "WP-UI-04", screen: "WP-SCR-04", route: "/aio",            nav: "AIO / LLMO",       title: "AIO / LLMO",     glyph: "◌", question: "AIに読まれ、露出しているか",             soon: true },
  { id: "links",     surface: "WP-UI-05", screen: "WP-SCR-05", route: "/links",          nav: "内部link・売り場", title: "内部link・売り場", glyph: "⌘", question: "孤立、提携切れ、差替対象は何か",       soon: true },
  { id: "rewrites",  surface: "WP-UI-06", screen: "WP-SCR-06", route: "/rewrites",       nav: "rewrite",          title: "rewrite",        glyph: "↻", question: "どの記事をなぜ直し、結果がどう変化したか", soon: true },
  { id: "calendar",  surface: "WP-UI-08", screen: "WP-SCR-08", route: "/calendar",       nav: "calendar",         title: "calendar",       glyph: "▦", question: "何が起き、次に何が起きるか",             soon: true }
];

/* 表示状態。L1 screen.md「全画面はempty/loading/error/stale/normalを定義」に対応し、
   L2 screen-flow.md の timeout/recovery を reconcile として追加する。 */
const STATES = [
  { id: "normal",    label: "normal" },
  { id: "stale",     label: "stale" },
  { id: "loading",   label: "loading" },
  { id: "empty",     label: "empty" },
  { id: "error",     label: "failure" },
  { id: "reconcile", label: "timeout照合" }
];

/* 判断ホーム(WP-UI-01)内のsub-tab。主要画面ナビ（SURFACES）とは階層も語彙も分ける。
   POの問い「今、判断が必要か。運転は正常か」を、判断＝行動 / 運転＝監視 / 成果＝結果 の
   3つの読み方へ分割し、1画面あたりのscroll量を判断1件分に抑える。 */
const HOME_TABS = [
  { id: "decide",  label: "判断待ち",   sub: "承認・差し戻し",   glyph: "⚑" },
  { id: "runtime", label: "運転と注意", sub: "稼働状況・要確認", glyph: "◎" },
  { id: "outcome", label: "成果サマリ", sub: "今月の確定値",     glyph: "↗" }
];

/* empty / failure / timeout照合 はいずれも「判断」pipelineの状態なので判断待ちtabが所有する。
   所有しないtabでは最新表示を維持したまま、状態の所在をscope-noteで示す。
   loadingは取得全体に掛かるため所有tabを持たない（全tabがskeleton）。 */
const HOME_STATE_SCOPE = { empty: "decide", error: "decide", reconcile: "decide" };

const HOME_LOADING_NOTE = {
  decide:  "承認queueとWP状態を取得しています…",
  runtime: "運転状況と注意事項を取得しています…",
  outcome: "確定成果とコストを突合しています…"
};

/* --------------------------------------------------------------------------
   2. fixture
   ------------------------------------------------------------------------ */

/* 公開可能条件は docs/requirements/s1-draft-post-requirements.md「公開可能条件」1〜7と
   1:1で対応させる。番号を変えない。 */
function publishConditions(post, redIndex) {
  const items = [
    {
      no: 1,
      title: "対象site・post ID・期待modified・content digestがWP再取得結果と一致",
      okDetail: "GET /wp-json/wp/v2/posts/" + post.id + " · modified " + post.modified + " · digest " + post.digest + " 一致",
      ngDetail: "再取得したmodifiedが期待値と不一致（外部編集の疑い）",
      ref: "WP-EV-0421"
    },
    {
      no: 2,
      title: "中間JSON schema・未知type・Gutenberg editor validityがgreen",
      okDetail: "unknown type 0 · block検証 42/42 · warning 0",
      ngDetail: "未知block type 2件。editor整合が取れない",
      ref: "WP-EV-0417"
    },
    {
      no: 3,
      title: "KW/PAA/共通見出し・writing regulation・事実provenanceがgreen",
      okDetail: "KW 18/18 · PAA 4/4 · writing rule 違反0 · 検証可能な事実 12 / source 12",
      ngDetail: "事実 9件に対しsource 6件。未検証の主張が3件残っている",
      ref: "WP-EV-0418"
    },
    {
      no: 4,
      title: "credential/secret検査・permission・外部link・公開URL競合のpreflightがgreen",
      okDetail: "secret検出 0 · scope publish_posts のみ · 外部link 6件 到達確認済 · slug競合なし",
      ngDetail: "同一slugの既存投稿を検出。公開URLが競合する",
      ref: "WP-EV-0420"
    },
    {
      no: 5,
      title: "PO承認が同一post ID・content digest・公開actionへ束縛され有効期限内",
      okDetail: "束縛先 post #" + post.id + " / digest " + post.digest + " / action=publish · 有効期限 " + post.approvalExpiry,
      ngDetail: "承認未取得。この画面での承認が束縛の起点になる",
      ref: "WP-AP-0088"
    },
    {
      no: 6,
      title: "公開失敗時に同じpost IDをdraftへ戻すrollbackが準備されている",
      okDetail: post.rollbackId + " · 同一post IDをstatus=draftへ復帰 · 想定所要 8秒",
      ngDetail: "rollback planが未生成",
      ref: "WP-EV-0422"
    },
    {
      no: 7,
      title: "公開後のGET検証と証跡記録が同一operation chainで実行可能",
      okDetail: "chain " + post.operationId + " · 公開後GET検証stepを予約済み",
      ngDetail: "operation chainが分断されており公開後検証を同一chainで実行できない",
      ref: "WP-EV-0423"
    }
  ];
  return items.map((item) => {
    const ok = item.no !== redIndex;
    return { no: item.no, title: item.title, ok: ok, detail: ok ? item.okDetail : item.ngDetail, ref: item.ref };
  });
}

const DECISIONS = [
  {
    id: "D-1842",
    kind: "公開承認",
    title: "「ひとり起業の始め方」を公開する",
    why: "KW cluster <b>C-204</b> の全gateがgreen。WordPress下書き <b>#1842</b> を再取得した結果が、承認対象のcontent digestと一致している。",
    risk: { level: "low", label: "risk 低", tone: "ok", reason: "新規投稿1件のみ。既存投稿の上書き・削除はなく、公開URL競合もない。" },
    due: { label: "承認期限 4時間", at: "2026-08-23 14:42 まで", note: "期限を過ぎると承認束縛が失効し、digest再確認からやり直す" },
    post: {
      id: 1842, status: "draft", modified: "2026-08-23 10:42:11",
      digest: "sha256:5ea1…93bd", approvalExpiry: "14:42",
      rollbackId: "RB-1842-02", operationId: "WP-OP-2026-0823-014",
      url: "https://solobiz-lab.com/?p=1842", slug: "hitori-kigyo-hajimekata"
    },
    redIndex: 0,
    evidence: [
      { id: "WP-EV-0421", label: "WP再取得 GET /posts/1842（post ID・modified・digest照合）", at: "10:42:14" },
      { id: "WP-EV-0418", label: "記事品質gate評価 · 導出規則 rules v3.2", at: "10:41:58" },
      { id: "WP-EV-0420", label: "公開前preflight（secret / permission / link / slug）", at: "10:42:02" },
      { id: "WP-EV-0422", label: "rollback plan RB-1842-02 生成", at: "10:42:05" }
    ]
  },
  {
    id: "D-1839",
    kind: "公開承認",
    title: "「小さな事業のSEO設計」を公開する",
    why: "cluster <b>C-198</b> の構成gateは通過したが、事実provenanceのgateが<b>red</b>のため公開writeを実行できない。",
    risk: { level: "high", label: "risk 高", tone: "danger", reason: "未検証の主張を含んだまま公開すると、事後の記事差し替えが必要になる。" },
    due: { label: "判断不可", at: "gate green化まで保留", note: "redが1件でも残る限り公開writeは0件（AC-S1-008）" },
    post: {
      id: 1839, status: "draft", modified: "2026-08-22 19:07:40",
      digest: "sha256:0c74…41af", approvalExpiry: "承認取得時に確定（取得後4時間）",
      rollbackId: "RB-1839-01", operationId: "WP-OP-2026-0822-031",
      url: "https://solobiz-lab.com/?p=1839", slug: "chiisana-jigyo-seo"
    },
    redIndex: 3,
    evidence: [
      { id: "WP-EV-0404", label: "WP再取得 GET /posts/1839", at: "昨日 19:08" },
      { id: "WP-EV-0405", label: "事実provenance評価 · 未検証の主張 3件", at: "昨日 19:09" }
    ]
  }
];

const CLUSTERS = [
  {
    id: "C-204", name: "「ひとり起業」cluster", kw: 18, article: "ひとり起業の始め方",
    verdict: { label: "機械判定: 統合", tone: "ok" }, overlap: 72,
    post: "draft · #1842",
    snapshot: "2026-08-22 04:10 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0011",
    reasoning: [
      { ok: true, text: "上位10件のうち記事型が8件で、同一の検索意図に収束している", ref: "WP-EV-0410" },
      { ok: true, text: "共通テーマ「準備」「費用」「手続き」が3 KW群すべてに出現", ref: "WP-EV-0411" },
      { ok: true, text: "PAA 4問を記事構成の H2 へ割当済み（欠落0）", ref: "WP-EV-0412" }
    ]
  },
  {
    id: "C-198", name: "「小さな事業 SEO」cluster", kw: 9, article: "小さな事業のSEO設計",
    verdict: { label: "機械判定: 統合（要確認）", tone: "warn" }, overlap: 54,
    post: "draft · #1839",
    snapshot: "2026-08-22 04:10 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0011",
    reasoning: [
      { ok: true,  text: "SERP重複率が統合しきい値50%をわずかに上回る", ref: "WP-EV-0406" },
      { ok: false, text: "検索意図が「設計手順」と「外注費用」に二分している疑い", ref: "WP-EV-0407" },
      { ok: true,  text: "PAA 3問のうち2問のみ構成へ割当（1問欠落）", ref: "WP-EV-0408" }
    ]
  },
  {
    id: "C-211", name: "「個人事業 固定費」cluster", kw: 12, article: "個人事業の固定費を減らす",
    verdict: { label: "機械判定: 解析中", tone: "neutral" }, overlap: 38,
    post: "—",
    snapshot: "2026-08-23 03:00 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0012",
    reasoning: [
      { ok: true,  text: "SERP取得は完了。重複率はしきい値未満で分割候補", ref: "WP-EV-0430" },
      { ok: false, text: "PAA割当が未実行のため記事構成へ接続できていない", ref: "WP-EV-0431" }
    ]
  }
];

const ARTICLES = [
  { title: "ひとり起業の始め方",       mainKw: "ひとり起業",       kw: 18, gate: { label: "7/7 green", tone: "ok" },      wp: "draft · #1842", updated: "10:42", cluster: "C-204", flag: "decide" },
  { title: "小さな事業のSEO設計",     mainKw: "ひとり SEO",       kw: 9,  gate: { label: "1 red", tone: "danger" },      wp: "draft · #1839", updated: "昨日 19:07", cluster: "C-198", flag: "red" },
  { title: "個人事業の固定費を減らす", mainKw: "個人事業 固定費",   kw: 12, gate: { label: "解析中", tone: "neutral" },     wp: "—",             updated: "10:31", cluster: "C-211", flag: "running" },
  { title: "屋号と開業届の出し方",     mainKw: "開業届 書き方",     kw: 14, gate: { label: "7/7 green", tone: "ok" },      wp: "publish · #1821", updated: "8月21日", cluster: "C-186", flag: "done" },
  { title: "ひとり法人の社会保険",     mainKw: "ひとり法人 保険",   kw: 11, gate: { label: "7/7 green", tone: "ok" },      wp: "publish · #1804", updated: "8月18日", cluster: "C-177", flag: "done" }
];

const EXCLUSIONS = [
  { reason: "検索意図が事業テーマと不一致", count: 22, rule: "kw-filter v2.1" },
  { reason: "検索volumeが下限（30/月）未満", count: 18, rule: "kw-filter v2.1" },
  { reason: "競合強度が上限を超過",          count: 12, rule: "kw-filter v2.1" },
  { reason: "規制・YMYL領域として除外",      count: 6,  rule: "policy v1.4" }
];

const OUTCOMES = {
  ratio: "1.64×", target: "2.00×", progress: 82,
  months: [
    { m: "6月", v: "1.21×", hit: false },
    { m: "7月", v: "1.48×", hit: false },
    { m: "8月", v: "1.64×", hit: false }
  ],
  metrics: [
    { label: "表示回数",   value: "128,420", delta: "+12.4%", tone: "up",      source: "GSC · 8月1–22日 · 取得 2日前" },
    { label: "AI露出KW",   value: "18",      delta: "+3",     tone: "up",      source: "AIO測定 · 8月22日 · 週次" },
    { label: "確定CV",     value: "42",      delta: "+8.1%",  tone: "up",      source: "A8確定成果 · 8月8日 · 推計を含まない" },
    { label: "売上÷コスト", value: "1.64×",  delta: "目標 2.00×", tone: "neutral", source: "確定売上 ÷ 実費 · 帰属不能分は除外" }
  ],
  revenue: [
    { label: "確定成果（A8）", value: "¥98,200" },
    { label: "確定成果（その他ASP）", value: "¥25,200" },
    { label: "合計売上", value: "¥123,400", total: true }
  ],
  cost: [
    { label: "LLM利用", value: "¥41,200" },
    { label: "外部API・SERP取得", value: "¥12,400" },
    { label: "人手確認（PO時間換算）", value: "¥21,600" },
    { label: "合計コスト", value: "¥75,200", total: true }
  ]
};

/* 各surface × 各stateの表示文言。normal/stale以外は共通componentで描画する。 */
const STATE_COPY = {
  home: {
    freshness: {
      normal:    { tone: "ok",    icon: "✓", head: "WordPress 再取得 10:42:14",  sub: "期間窓 直近24時間 · 期待間隔 5分 · 遅延なし" },
      stale:     { tone: "stale", icon: "!", head: "A8成果データ 15日前",         sub: "期間窓 8月1–8日 · 期待間隔 7日 · 理由: ASP側の集計遅延" },
      loading:   { tone: "ok",    icon: "⟳", head: "取得中",                      sub: "期間窓 直近24時間 · 期待間隔 5分" },
      empty:     { tone: "ok",    icon: "✓", head: "WordPress 再取得 10:42:14",  sub: "期間窓 直近24時間 · 判断対象 0件" },
      error:     { tone: "error", icon: "×", head: "承認記録の書込みに失敗",       sub: "最終成功 10:42:14 · 外部writeは0件" },
      reconcile: { tone: "stale", icon: "?", head: "公開writeの結果が不明",        sub: "最終応答 timeout 11:03:07 · 自動再送しない" }
    },
    empty: {
      icon: "◇", title: "いま判断が必要な項目はありません",
      lead: "承認待ちのoperationが0件です。運転は継続しており、次の取得後に新しい判断が出る場合があります。",
      facts: [
        ["証跡がない理由", "8月23日 10:42時点で承認待ちqueueが空。直近24時間の判断は全て完了済み"],
        ["次回取得予定", "8月24日 03:00 GSC週次取得（読み取りのみ）"],
        ["必要なPO action", "なし。次回判断の通知まで待機"],
        ["直近の完了", "WP-OP-2026-0822-031 · 8月22日 19:12 公開検証まで完了"]
      ],
      actions: [["記事・KWを見る", "goto", "articles"], ["成果を見る", "goto", "outcomes"]]
    },
    error: {
      icon: "×", title: "承認記録の書込みに失敗しました",
      lead: "失敗したstepは「承認記録」です。外部（WordPress）へのwriteは実行していません。WordPress側のpost状態は変わっていません。",
      facts: [
        ["失敗step", "approval_record_write（承認記録の永続化）"],
        ["外部writeの有無", "0件。post #1842 は draft のまま"],
        ["evidence ID", "WP-EV-0429 · 2026-08-23 10:44:02 · code=DB_WRITE_TIMEOUT"],
        ["retry / 再入場 owner", "harness自動retry 2回で未回復。以後はPOの再入場が必要"],
        ["再入場条件", "承認は未成立。digest再確認からやり直す（同一post ID・同一digestである限り再承認可能）"]
      ],
      actions: [["再取得して判断へ戻る", "retry", ""], ["証跡を見る", "evidence", "D-1842"]]
    },
    reconcile: {
      title: "公開writeの結果が確認できていません",
      lead: "timeoutにより応答が不明です。screen-flowの規定どおり、同一要求の自動再送を行わず、idempotency keyとWP側の実測結果を照合します。"
    }
  },
  articles: {
    freshness: {
      normal:    { tone: "ok",    icon: "✓", head: "KW帰属の再計算 10:35",   sub: "期間窓 全母集団 1,000 KW · 期待間隔 24時間" },
      stale:     { tone: "stale", icon: "!", head: "SERP snapshot 8日前",     sub: "期間窓 8月15日 · 期待間隔 7日 · 理由: SERP取得cronが2回連続失敗" },
      loading:   { tone: "ok",    icon: "⟳", head: "取得中",                  sub: "期間窓 全母集団 1,000 KW" },
      empty:     { tone: "ok",    icon: "✓", head: "KW取込 未実施",           sub: "母集団 0件" },
      error:     { tone: "error", icon: "×", head: "KW帰属の導出に失敗",      sub: "最終成功 8月22日 10:35" },
      reconcile: { tone: "stale", icon: "?", head: "取込結果が二重の可能性",  sub: "同一batchの応答が不明" }
    },
    empty: {
      icon: "◇", title: "KW母集団がまだ取り込まれていません",
      lead: "帰属を表示するためのKW証跡がありません。取込が終わるまで、記事とKWの対応は導出できません。",
      facts: [
        ["証跡がない理由", "初回KW取込が未実行（source: GSC + 手動seed list）"],
        ["次回取得予定", "8月24日 03:00 GSC週次取得"],
        ["必要なPO action", "対象サイトとseed KW listの指定"],
        ["この画面が空である影響", "処理監査・公開判断はKW帰属に依存するため同様に0件"]
      ],
      actions: [["ホームへ戻る", "goto", "home"]]
    },
    error: {
      icon: "×", title: "KW帰属の導出に失敗しました",
      lead: "取得は成功しましたが、cluster帰属の導出stepで失敗しました。表示中の帰属は前回成功分であり、最新ではありません。",
      facts: [
        ["失敗step", "kw_attribution_derive（cluster帰属の導出）"],
        ["外部writeの有無", "0件。読み取りのみのsurface"],
        ["evidence ID", "WP-EV-0433 · 2026-08-23 10:36:11 · code=RULE_VERSION_MISMATCH"],
        ["retry / 再入場 owner", "harness（導出規則versionの整合後に自動再実行）"],
        ["再入場条件", "cluster-rules v3.2 とKW snapshotのversionが一致すること"]
      ],
      actions: [["再取得する", "retry", ""]]
    },
    reconcile: {
      title: "KW取込batchの結果が確認できていません",
      lead: "取込batchがtimeoutしました。重複取込を避けるため自動再送はせず、batch keyで既存結果を照合します。"
    },
    loadingNote: "1,000 KWの帰属を導出しています…"
  },
  audit: {
    freshness: {
      normal:    { tone: "ok",    icon: "✓", head: "SERP snapshot 8月22日 04:10", sub: "期間窓 上位10件 / JP / mobile · 期待間隔 7日" },
      stale:     { tone: "stale", icon: "!", head: "SERP snapshot 8日前",          sub: "期間窓 8月15日 · 期待間隔 7日 · 理由: 取得cron失敗" },
      loading:   { tone: "ok",    icon: "⟳", head: "取得中",                       sub: "期間窓 上位10件 / JP / mobile" },
      empty:     { tone: "ok",    icon: "✓", head: "cluster 0件",                  sub: "解析対象なし" },
      error:     { tone: "error", icon: "×", head: "cluster判定の再現に失敗",       sub: "最終成功 8月22日 04:10" },
      reconcile: { tone: "stale", icon: "?", head: "override記録の結果が不明",      sub: "自動再送しない" }
    },
    empty: {
      icon: "◇", title: "監査対象のclusterがありません",
      lead: "SERP snapshotとKW帰属がそろって初めてcluster判定を再現できます。現在はどちらも0件です。",
      facts: [
        ["証跡がない理由", "SERP snapshotが未取得のためcluster判定を実行していない"],
        ["次回取得予定", "8月24日 04:10 SERP週次snapshot"],
        ["必要なPO action", "なし（取得後に自動でcluster判定が走る）"],
        ["導出規則", "cluster-rules v3.2（手入力による判定作成は不可）"]
      ],
      actions: [["記事・KWを見る", "goto", "articles"]]
    },
    error: {
      icon: "×", title: "cluster判定を再現できませんでした",
      lead: "判定に使ったsnapshotの一部が参照できず、根拠の再現に失敗しました。判定結果は表示せず、推測もしません。",
      facts: [
        ["失敗step", "cluster_verdict_replay（判定根拠の再現）"],
        ["外部writeの有無", "0件。読み取りのみのsurface"],
        ["evidence ID", "WP-EV-0436 · 2026-08-23 04:12:40 · code=SNAPSHOT_PARTIAL"],
        ["retry / 再入場 owner", "harness（次回snapshot取得後に自動再実行）"],
        ["再入場条件", "snapshot 2026-08-22 の欠損3件が補完されること"]
      ],
      actions: [["再取得する", "retry", ""]]
    },
    reconcile: {
      title: "PO overrideの記録結果が確認できていません",
      lead: "override記録要求がtimeoutしました。overrideの二重適用を避けるため自動再送せず、override keyで既存記録を照合します。"
    },
    loadingNote: "cluster判定の根拠を再現しています…"
  },
  outcomes: {
    freshness: {
      normal:    { tone: "ok",    icon: "✓", head: "確定成果 8月8日取得",  sub: "期間窓 8月1–22日 · 期待間隔 7日 · 推計値は含まない" },
      stale:     { tone: "stale", icon: "!", head: "A8成果データ 15日前",   sub: "期間窓 8月1–8日 · 期待間隔 7日 · 理由: ASP側の確定処理待ち" },
      loading:   { tone: "ok",    icon: "⟳", head: "集計中",                sub: "期間窓 8月1–22日" },
      empty:     { tone: "ok",    icon: "✓", head: "確定成果 0件",          sub: "測定期間内に確定データなし" },
      error:     { tone: "error", icon: "×", head: "成果集計に失敗",        sub: "最終成功 8月8日" },
      reconcile: { tone: "stale", icon: "?", head: "成果取得の結果が不明",  sub: "自動再送しない" }
    },
    empty: {
      icon: "◇", title: "確定した成果がまだありません",
      lead: "この画面は確定値のみを表示します。推計値と帰属不能な成果は含めないため、確定前は0件として扱います。",
      facts: [
        ["証跡がない理由", "測定期間内にASP確定データが1件もない（未確定分は表示しない）"],
        ["次回取得予定", "9月8日 ASP確定成果の月次確定"],
        ["必要なPO action", "なし。確定まで待機"],
        ["L1成功基準への影響", "売上÷コストは算出不能。目標2.00×の判定は保留"]
      ],
      actions: [["ホームへ戻る", "goto", "home"]]
    },
    error: {
      icon: "×", title: "成果集計に失敗しました",
      lead: "ASPからの取得は成功しましたが、コスト側の突合で失敗しました。数値を推測して埋めることはしません。",
      facts: [
        ["失敗step", "outcome_reconcile（売上とコストの突合）"],
        ["外部writeの有無", "0件。読み取り専用surface"],
        ["evidence ID", "WP-EV-0440 · 2026-08-23 05:20:18 · code=COST_LEDGER_GAP"],
        ["retry / 再入場 owner", "harness（cost ledgerの欠損補完後）"],
        ["再入場条件", "8月17–19日のcost ledger 3日分が補完されること"]
      ],
      actions: [["再取得する", "retry", ""]]
    },
    reconcile: {
      title: "成果取得の結果が確認できていません",
      lead: "ASP取得要求がtimeoutしました。二重計上を避けるため自動再送せず、取得keyで既存結果を照合します。"
    },
    loadingNote: "確定成果とコストを突合しています…"
  }
};

/* ReconciliationPanel の比較fixture（surface別） */
const RECONCILE = {
  home: {
    key: "idempotency key: IK-1842-publish-7f31",
    expected: [["post ID", "#1842"], ["要求action", "status=publish"], ["期待digest", "sha256:5ea1…93bd"], ["要求時刻", "11:03:02"]],
    observed: [["post ID", "#1842"], ["実測status", "確認できず", true], ["実測digest", "確認できず", true], ["最終応答", "timeout 11:03:07", true]],
    duplicates: "同一idempotency keyのoperationは1件のみ。重複投稿の候補は検出されていません。",
    actions: [["WP側の結果を照会する", "recon", ""], ["PO判断queueへ送る", "recon-queue", ""]]
  },
  articles: {
    key: "batch key: BK-2026-0823-kw-import",
    expected: [["取込予定", "1,000 KW"], ["batch開始", "10:30:11"], ["導出規則", "kw-filter v2.1"]],
    observed: [["取込済み", "確認できず", true], ["batch終了", "timeout 10:35:40", true], ["重複候補", "0件"]],
    duplicates: "batch keyが一致するため、再送すると同一KWを二重取込する可能性があります。",
    actions: [["取込結果を照会する", "recon", ""], ["PO判断queueへ送る", "recon-queue", ""]]
  },
  audit: {
    key: "override key: OV-C198-split-01",
    expected: [["対象cluster", "C-198"], ["要求override", "分割"], ["理由", "検索意図が二分している"]],
    observed: [["適用状態", "確認できず", true], ["最終応答", "timeout 04:15:22", true], ["重複override", "0件"]],
    duplicates: "同一override keyの記録は最大1件。重複適用の候補はありません。",
    actions: [["override記録を照会する", "recon", ""], ["PO判断queueへ送る", "recon-queue", ""]]
  },
  outcomes: {
    key: "fetch key: FK-2026-0823-a8-daily",
    expected: [["対象期間", "8月1–22日"], ["要求時刻", "05:18:40"], ["対象ASP", "A8"]],
    observed: [["取得件数", "確認できず", true], ["最終応答", "timeout 05:20:18", true], ["重複計上候補", "0件"]],
    duplicates: "同一fetch keyの結果が未確定です。再送すると成果を二重計上する可能性があります。",
    actions: [["取得結果を照会する", "recon", ""], ["PO判断queueへ送る", "recon-queue", ""]]
  }
};

/* --------------------------------------------------------------------------
   3. 実行時state
   ------------------------------------------------------------------------ */

const ui = {
  view: "home",
  tab: HOME_TABS[0].id,   // 判断ホーム内のsub-tab。deep link `t=` で保持する
  state: "normal",
  decisionId: DECISIONS[0].id,
  clusterId: CLUSTERS[0].id,
  filter: "all",
  completed: {},      // decisionId -> 実行結果
  lastFocus: null,
  pendingReason: null
};

const surfaceOf = (id) => SURFACES.find((s) => s.id === id);
const decisionOf = (id) => DECISIONS.find((d) => d.id === id);
const clusterOf = (id) => CLUSTERS.find((c) => c.id === id);

/* --------------------------------------------------------------------------
   4. 共通component
   ------------------------------------------------------------------------ */

function badge(text, tone, icon) {
  return '<span class="badge badge-' + tone + '"><span class="bi" aria-hidden="true">' + (icon || "•") + "</span>" + esc(text) + "</span>";
}

function sectionHead(eyebrow, title, sub, right) {
  return '<div class="section"><div><p class="eyebrow">' + esc(eyebrow) + "</p><h2>" + esc(title) + "</h2>" +
    (sub ? '<p class="sub">' + sub + "</p>" : "") + "</div>" + (right || "") + "</div>";
}

function stateFacts(rows) {
  return '<dl class="state-facts">' + rows.map((r) =>
    "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"
  ).join("") + "</dl>";
}

function stateActions(actions) {
  return '<div class="state-actions">' + actions.map((a, i) =>
    '<button type="button" class="btn ' + (i === 0 ? "btn-primary" : "btn-secondary") +
    '" data-act="' + a[1] + '" data-arg="' + esc(a[2]) + '">' + esc(a[0]) + "</button>"
  ).join("") + "</div>";
}

/* EmptyState: 証跡がない理由・次回取得予定・必要action */
function renderEmpty(viewId) {
  const c = STATE_COPY[viewId].empty;
  return '<section class="state-panel"><div class="state-icon" aria-hidden="true">' + c.icon + "</div>" +
    "<h2>" + esc(c.title) + "</h2><p>" + esc(c.lead) + "</p>" +
    stateFacts(c.facts) + stateActions(c.actions) + "</section>";
}

/* ErrorState: failure step・evidence・retry/再入場owner */
function renderError(viewId) {
  const c = STATE_COPY[viewId].error;
  return '<section class="state-panel is-error"><div class="state-icon" aria-hidden="true">' + c.icon + "</div>" +
    "<h2>" + esc(c.title) + "</h2><p>" + esc(c.lead) + "</p>" +
    stateFacts(c.facts) + stateActions(c.actions) + "</section>";
}

/* ReconciliationPanel: timeout・不明応答・重複候補の比較。自動再送を禁止する */
function renderReconcile(viewId) {
  const c = STATE_COPY[viewId].reconcile;
  const r = RECONCILE[viewId];
  const col = (title, rows) => '<div class="recon-col"><h3>' + esc(title) + "</h3><dl>" +
    rows.map((row) => "<div><dt>" + esc(row[0]) + "</dt><dd" + (row[2] ? ' class="mismatch"' : "") + ">" + esc(row[1]) + "</dd></div>").join("") +
    "</dl></div>";

  return '<section class="state-panel is-reconcile"><div class="state-icon" aria-hidden="true">?</div>' +
    "<h2>" + esc(c.title) + "</h2><p>" + esc(c.lead) + "</p>" +
    '<p class="sub" style="margin-top:10px;font-size:12.5px;color:var(--muted)"><code>' + esc(r.key) + "</code></p>" +
    '<div class="recon-compare">' + col("要求した内容", r.expected) + col("WP / 外部側の実測", r.observed) + "</div>" +
    '<div class="no-retry"><span aria-hidden="true">⛔</span><span><b>自動再送は行いません。</b>' + esc(r.duplicates) +
    " 結果が一意に確認できない場合はPO判断queueへ送ります。</span></div>" +
    '<p style="margin:14px 0 12px;font-size:12.5px;color:var(--muted)">状態: <strong>reconciliation_required</strong> · 再試行は同一operation chainへ追記されます。</p>' +
    stateActions(r.actions) + "</section>";
}

/* 読込中も本表示と同じ骨格を出し、完了時のlayout shiftを起こさない */
function skCard(lines, blockHeight) {
  return '<div class="sk-card">' +
    lines.map((w) => '<div class="sk sk-line ' + w + '"></div>').join("") +
    (blockHeight ? '<div class="sk" style="height:' + blockHeight + 'px"></div>' : "") + "</div>";
}

function renderLoading(viewId, sub) {
  const metricsSk = '<div class="metrics">' + [0, 0, 0, 0].map(() => skCard(["w60", "w40"])).join("") + "</div>";

  /* homeはsub-tabごとに骨格が違うため、切替後のlayout shiftも起こさないよう形を分ける */
  const homeShapes = {
    decide:
      '<div class="sk-2col"><div class="sk-stack">' +
        skCard(["w40", "w80", "w60"]) + skCard(["w40", "w80", "w60"]) + "</div>" +
        skCard(["w40", "w80"], 260) + "</div>",
    runtime:
      '<div class="runtime-strip">' + [0, 0, 0, 0, 0].map(() =>
        '<div class="runtime-cell">' + skCard(["w60", "w80"]) + "</div>").join("") + "</div>" +
      '<div class="alerts" style="margin-top:22px">' + skCard(["w60", "w80", "w40"]) + skCard(["w60", "w80", "w40"]) + "</div>",
    outcome:
      skCard(["w40"], 120) + '<div style="margin-top:14px">' + metricsSk + "</div>"
  };

  const homeTab = homeShapes[sub] ? sub : HOME_TABS[0].id;
  const note = viewId === "home" ? HOME_LOADING_NOTE[homeTab] : STATE_COPY[viewId].loadingNote;

  const shapes = {
    home: homeShapes[homeTab],
    articles:
      skCard(["w40", "w80"], 60) +
      '<div style="margin-top:14px">' + skCard(["w80", "w80", "w80", "w80", "w60"]) + "</div>",
    audit:
      '<div class="audit-layout"><div class="queue-col">' + skCard(["w60", "w80"]) + skCard(["w60", "w80"]) + "</div>" +
      skCard(["w40", "w80"], 300) + "</div>",
    outcomes:
      skCard(["w40"], 120) + '<div style="margin-top:14px">' + metricsSk + "</div>"
  };

  return '<div class="loading-note"><span class="spinner" aria-hidden="true"></span><span>' + esc(note) + "</span></div>" +
    '<div class="skeleton-grid" aria-hidden="true">' + shapes[viewId] + "</div>";
}

function staleBanner(text, impact) {
  return '<div class="stale-banner"><span class="alert-icon" aria-hidden="true">!</span><div>' +
    "<strong>stale: " + esc(text) + "</strong><p>" + esc(impact) + "</p></div></div>";
}

/* --------------------------------------------------------------------------
   5. ホーム (WP-UI-01)
   ------------------------------------------------------------------------ */

const pendingCount = () => DECISIONS.length - Object.keys(ui.completed).length;

function runtimeStrip(state) {
  const cells = [
    { dt: "対象site", dd: "solobiz-lab.com", sub: "検証サイト · REST API" },
    { dt: "判断待ち", dd: String(pendingCount()), sub: "うち判断不可 1件", tone: "is-attention", to: "decide" },
    { dt: "処理中", dd: "3", sub: "cluster解析 2 · 記事生成 1" },
    { dt: "失敗", dd: "0", sub: "直近24時間" },
    { dt: "次の自動処理", dd: "8月24日 03:00", sub: "GSC週次取得 · 読み取りのみ" }
  ];

  /* 状態は「判断待ち」tabが所有するが、運転の数字にも必ず現れるようにする */
  if (state === "stale")     { cells[4].sub = "GSC週次取得 · 前回は15日前"; }
  if (state === "empty")     { cells[1].dd = "0"; cells[1].sub = "直近24時間の判断は完了済み"; cells[1].tone = ""; }
  if (state === "error")     { cells[3].dd = "1"; cells[3].sub = "承認記録step · 外部write 0件"; cells[3].tone = "is-bad"; }
  if (state === "reconcile") { cells[1].sub = "うち照合待ち 1件（自動再送なし）"; }

  return '<dl class="runtime-strip">' + cells.map((c) =>
    '<div class="runtime-cell ' + (c.tone || "") + '"><dt>' + esc(c.dt) + "</dt><dd>" + esc(c.dd) +
    "<small>" + esc(c.sub) + "</small>" +
    (c.to ? '<button type="button" class="linkbtn cell-link" data-act="home-tab" data-arg="' + c.to + '">判断待ちを開く →</button>' : "") +
    "</dd></div>").join("") + "</dl>";
}

function queueItem(d) {
  const done = Boolean(ui.completed[d.id]);
  const blocked = d.redIndex > 0;
  const green = d.redIndex > 0 ? 6 : 7;
  return '<button type="button" class="queue-item' + (blocked ? " is-blocked" : "") + '" data-act="select-decision" data-arg="' + d.id +
    '" aria-pressed="' + (ui.decisionId === d.id) + '">' +
    '<span class="queue-item-top">' +
      badge(done ? "公開済み" : d.kind, done ? "ok" : (blocked ? "danger" : "warn"), done ? "✓" : (blocked ? "×" : "!")) +
      badge(d.risk.label, d.risk.tone, d.risk.tone === "ok" ? "▽" : "▲") +
    "</span>" +
    "<h3>" + esc(d.title) + "</h3>" +
    '<span class="qmeta"><span>gate <b>' + green + "/7</b></span><span>post <b>#" + d.post.id +
    "</b></span><span>" + esc(d.due.label) + "</span></span></button>";
}

function decisionResult(d) {
  const r = ui.completed[d.id];
  return '<section class="card result-panel">' +
    "<h3>✓ 公開まで完了しました — operation ID <code>" + esc(r.operationId) + "</code></h3>" +
    '<p style="font-size:12.5px;color:var(--ink-2);margin-top:6px">この結果はprototype上の表示遷移です。実際のWordPressへは書き込んでいません。</p>' +
    '<div class="result-steps">' + r.steps.map((s) =>
      '<div class="result-step"><span class="rs-mark" aria-hidden="true">✓</span><span class="rs-body"><strong>' + esc(s[0]) +
      "</strong><br><span style=\"color:var(--muted)\">" + s[1] + "</span></span></div>").join("") + "</div>" +
    '<div class="decision-actions"><span class="hint">rollback ' + esc(d.post.rollbackId) +
    ' は公開後24時間有効です。</span><button type="button" class="btn btn-secondary" data-act="evidence" data-arg="' + d.id +
    '">証跡を見る</button><button type="button" class="btn btn-secondary" data-act="reset-decision" data-arg="' + d.id +
    '">prototypeを初期状態へ戻す</button></div></section>';
}

function decisionCard(d, stale) {
  if (ui.completed[d.id]) { return decisionResult(d); }

  const blocked = d.redIndex > 0;
  const green = blocked ? 6 : 7;

  const identity = [
    ["POST ID", "#" + d.post.id],
    ["WP STATUS", d.post.status],
    ["MODIFIED", d.post.modified],
    ["CONTENT DIGEST", d.post.digest]
  ];

  return '<article class="card decision">' +
    '<div class="decision-head"><div style="min-width:0">' +
      '<div class="decision-badges">' +
        badge(d.kind, blocked ? "danger" : "warn", blocked ? "×" : "!") +
        badge(d.due.label, "neutral", "⏱") +
        badge(d.risk.label, d.risk.tone, d.risk.tone === "ok" ? "▽" : "▲") +
      "</div><h2>" + esc(d.title) + "</h2></div></div>" +

    '<p class="why"><b>なぜ判断が必要か:</b> ' + d.why + "</p>" +

    '<dl class="identity">' + identity.map((x) =>
      "<div><dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd></div>").join("") + "</dl>" +

    '<div class="gatebar' + (blocked ? " is-blocked" : "") + '">' +
      '<div class="gate-ring" aria-hidden="true">' + green + "/7</div>" +
      '<div class="gate-text"><strong>' + (blocked ? "公開可能条件に red が1件あります" : "公開可能条件は7件すべてgreen") + "</strong>" +
      "<small>" + (blocked
        ? "red が残る限り公開writeは0件（AC-S1-008）。条件の中身を確認してください。"
        : "対象site / post ID / modified / digest がWP再取得結果と一致しています。") + "</small></div>" +
      '<button type="button" class="btn btn-secondary btn-sm" data-act="open-publish" data-arg="' + d.id + '">条件7件を確認する</button>' +
    "</div>" +

    '<dl class="kv" style="margin-top:12px">' +
      "<div><dt>riskの中身</dt><dd style=\"font-size:12.5px;font-weight:600\">" + esc(d.risk.reason) + "</dd></div>" +
      "<div><dt>期限と失効時の扱い</dt><dd style=\"font-size:12.5px;font-weight:600\">" + esc(d.due.at) + " · " + esc(d.due.note) + "</dd></div>" +
    "</dl>" +

    '<div class="evidence-list">' + d.evidence.slice(0, 2).map((e) =>
      '<div class="evidence-row"><code>' + esc(e.id) + '</code><span class="ev-label">' + esc(e.label) +
      "</span><time>" + esc(e.at) + "</time></div>").join("") +
      '<button type="button" class="linkbtn" style="justify-self:start" data-act="evidence" data-arg="' + d.id +
      '">証跡 ' + d.evidence.length + " 件をすべて見る →</button></div>" +

    '<div class="decision-actions">' +
      '<span class="hint">' + (blocked
        ? "この対象は承認できません。差し戻して事実sourceの補完を依頼します。"
        : (stale
          ? "成果データはstaleですが、公開条件はWP再取得結果に依存するため判断は可能です。"
          : "承認は post #" + d.post.id + " と digest " + d.post.digest + " へ束縛されます。")) + "</span>" +
      '<button type="button" class="btn btn-secondary" data-act="open-return" data-arg="' + d.id + '">差し戻す</button>' +
      '<button type="button" class="btn btn-primary" data-act="open-publish" data-arg="' + d.id + '"' + (blocked ? " disabled" : "") + ">" +
      (blocked ? "承認不可（red 1件）" : "内容を確認して承認") + "</button>" +
    "</div></article>";
}

/* 注意領域は承認対象ではない。tone !== "ok" の件数が「運転と注意」tabのbadgeになる。
   `to` は "tab:<id>"（ホーム内sub-tab）か surface ID。 */
function homeAlerts(state) {
  if (state === "error") {
    return [
      { tone: "danger", icon: "×", title: "承認記録の書込みに失敗しています",
        body: "失敗stepは approval_record_write。WordPressへのwriteは0件で、post #1842 は draft のままです。",
        impact: "必要なaction: 判断待ちタブで evidence WP-EV-0429 を確認し、digest再確認から再入場する。",
        act: "判断待ちへ", to: "tab:decide" }
    ];
  }
  if (state === "reconcile") {
    return [
      { tone: "warn", icon: "?", title: "公開writeの結果が照合待ちです",
        body: "idempotency key IK-1842-publish-7f31 の応答が timeout。同一要求の自動再送は行いません。",
        impact: "必要なaction: 判断待ちタブでWP側実測と照合する（reconciliation_required）。",
        act: "判断待ちへ", to: "tab:decide" }
    ];
  }
  if (state === "empty") {
    return [
      { tone: "ok", icon: "✓", title: "判断待ちは0件です",
        body: "直近24時間の判断は全て完了しています（最後: WP-OP-2026-0822-031 · 8月22日 19:12）。",
        impact: "次回取得予定: 8月24日 03:00 GSC週次取得（読み取りのみ）。",
        act: "判断待ちへ", to: "tab:decide" }
    ];
  }
  if (state === "stale") {
    return [
      { tone: "warn", icon: "!", title: "A8成果データがstaleです",
        body: "最終取得から15日経過（期待間隔7日）。理由: ASP側の確定処理待ち。",
        impact: "公開判断への影響: なし。公開可能条件はWP再取得結果に依存します。",
        act: "成果サマリへ", to: "tab:outcome" },
      { tone: "warn", icon: "!", title: "成果画面の数値は8月8日時点です",
        body: "L1成功基準（売上÷コスト）の現在値は確定まで暫定扱いです。",
        impact: "次回取得予定: 9月8日 ASP月次確定。",
        act: "成果へ", to: "outcomes" }
    ];
  }
  return [
    { tone: "warn", icon: "!", title: "cluster C-198 の判定が要確認です",
      body: "SERP重複率54%はしきい値をわずかに上回るのみ。検索意図が二分している疑いがあります。",
      impact: "必要なaction: 処理監査でoverride判断（分割 / 統合維持）。",
      act: "監査へ", to: "audit" },
    { tone: "ok", icon: "✓", title: "提携切れリンクはありません",
      body: "126リンクを8月22日に照合済み。終了プログラム0件。",
      impact: "次回照合: 8月29日。", act: "詳細", to: "" }
  ];
}

const attentionCount = (state) => homeAlerts(state).filter((a) => a.tone !== "ok").length;

function alertCards(state) {
  return '<div class="alerts">' + homeAlerts(state).map((a) => {
    const tab = a.to.indexOf("tab:") === 0;
    const act = a.to ? (tab ? "home-tab" : "goto") : "noop";
    const arg = tab ? a.to.slice(4) : a.to;
    return '<article class="alert alert-' + a.tone + '"><span class="alert-icon" aria-hidden="true">' + a.icon + "</span>" +
      '<div class="alert-body"><strong>' + esc(a.title) + "</strong><p>" + esc(a.body) + "</p>" +
      '<span class="impact">' + esc(a.impact) + "</span>" +
      '<button type="button" class="linkbtn" data-act="' + act + '" data-arg="' + esc(arg) + '">' +
      esc(a.act) + " →</button></div></article>";
  }).join("") + "</div>";
}

function homeMetrics() {
  return '<div class="metrics">' + OUTCOMES.metrics.map((m) =>
    '<article class="metric"><span class="m-label">' + esc(m.label) + '</span><strong class="m-value">' + esc(m.value) +
    '</strong><span class="m-delta ' + (m.tone === "neutral" ? "neutral" : "") + '">' + esc(m.delta) +
    '</span><span class="m-source">' + esc(m.source) + "</span></article>").join("") + "</div>";
}

/* sub-tabのbadge。件数だけでなく、その状態でtabが持つ意味（0件 / 失敗 / 照合待ち）も返す。
   色に依存しないよう icon と aria-label 用のテキストを必ず併せて返す（StateBadge契約）。 */
function homeTabStatus(tabId, state) {
  if (state === "loading") { return { text: "…", tone: "neutral", icon: "⟳", sr: "取得中" }; }

  if (tabId === "decide") {
    if (state === "error")     { return { text: "失敗", tone: "danger", icon: "×", sr: "承認記録の書込みに失敗・外部write 0件" }; }
    if (state === "reconcile") { return { text: "照合", tone: "warn",   icon: "?", sr: "照合待ち 1件・自動再送なし" }; }
    const pending = state === "empty" ? 0 : pendingCount();
    if (pending === 0) { return { text: "0", tone: "ok", icon: "✓", sr: "判断待ち 0件" }; }
    const blocked = DECISIONS.filter((d) => d.redIndex > 0 && !ui.completed[d.id]).length;
    return {
      text: String(pending), tone: "warn", icon: "!",
      sr: "判断待ち " + pending + "件" + (blocked ? "、うち判断不可 " + blocked + "件" : "")
    };
  }

  if (tabId === "runtime") {
    const n = attentionCount(state);
    if (n === 0) { return { text: "0", tone: "ok", icon: "✓", sr: "要確認 0件" }; }
    const bad = homeAlerts(state).some((a) => a.tone === "danger");
    return { text: String(n), tone: bad ? "danger" : "warn", icon: bad ? "×" : "!", sr: "要確認 " + n + "件" };
  }

  if (state === "stale") {
    return { text: OUTCOMES.ratio, tone: "warn", icon: "!", sr: "売上÷コスト " + OUTCOMES.ratio + "、確定データは8月8日時点でstale" };
  }
  return { text: OUTCOMES.ratio, tone: "neutral", icon: "↗", sr: "売上÷コスト " + OUTCOMES.ratio + "、目標 " + OUTCOMES.target };
}

function renderHomeTabs(state) {
  return '<div class="subtabs-wrap">' +
    '<div class="subtabs-head"><p class="eyebrow">ホーム内の区分 / SECTIONS</p>' +
    '<p class="subtabs-note">主要画面ナビ（ホーム／記事・KW／処理の監査／成果）とは別の、判断ホーム内の切り替えです。</p></div>' +
    '<div class="subtabs" role="tablist" aria-label="判断ホーム内の区分">' +
    HOME_TABS.map((t) => {
      const on = t.id === ui.tab;
      const st = homeTabStatus(t.id, state);
      return '<button type="button" role="tab" class="subtab" id="home-tab-' + t.id + '" data-tab="' + t.id +
        '" aria-selected="' + on + '" aria-controls="home-panel" tabindex="' + (on ? "0" : "-1") +
        '" aria-label="' + esc(t.label + "、" + t.sub + "、" + st.sr) + '">' +
        '<span class="st-glyph" aria-hidden="true">' + t.glyph + "</span>" +
        '<span class="st-text"><span class="st-label">' + esc(t.label) + "</span>" +
        '<span class="st-sub">' + esc(t.sub) + "</span></span>" +
        '<span class="badge badge-' + st.tone + ' st-badge" aria-hidden="true">' +
        '<span class="bi">' + st.icon + "</span>" + esc(st.text) + "</span>" +
        "</button>";
    }).join("") + "</div></div>";
}

/* 状態を所有しないtabで、状態の所在と「この表示は最新である」ことを明示する */
function scopeNote(state) {
  const owner = HOME_TABS.find((t) => t.id === HOME_STATE_SCOPE[state]);
  const copy = {
    empty:     ["neutral", "◇", "判断待ちが0件です。運転は継続しています。"],
    error:     ["danger",  "×", "承認記録の書込みに失敗しています（WordPressへのwriteは0件）。"],
    reconcile: ["warn",    "?", "公開writeの結果が照合待ちです（自動再送は行いません）。"]
  }[state];

  return '<div class="scope-note">' +
    badge("状態: " + STATES.find((s) => s.id === state).label, copy[0], copy[1]) +
    "<span>" + esc(copy[2]) + "この状態は「" + esc(owner.label) + "」が対象です。このタブの表示は最新のまま確認できます。</span>" +
    '<button type="button" class="btn btn-secondary btn-sm" data-act="home-tab" data-arg="' + owner.id + '">' +
    esc(owner.label) + "を開く</button></div>";
}

/* tab 1: 判断待ち — 承認・差し戻しの1件を決めるために必要なものだけを置く */
function renderHomeDecide(state) {
  const stale = state === "stale";
  const attn = attentionCount(state);

  return (stale ? staleBanner(
      "A8成果データが15日前（期待間隔7日）",
      "判断への影響: なし。公開可能条件はWordPress再取得結果（10:42:14）に依存し、成果データは公開判断の入力ではありません。") : "") +

    sectionHead("要承認 / APPROVAL QUEUE", "いま判断が必要なもの",
      "対象・なぜ・gate・risk・期限・根拠を1枚で確認してから判断します。",
      '<button type="button" class="linkbtn" data-act="goto" data-arg="articles">記事・KWの一覧へ →</button>') +

    '<div class="queue-layout is-2col">' +
      '<div class="queue-list-box"><div class="queue-list">' + DECISIONS.map(queueItem).join("") + "</div>" +
        '<p class="col-note">承認・差し戻しは選択中の1件に対してのみ実行されます。</p></div>' +
      '<div class="detail-box">' + decisionCard(decisionOf(ui.decisionId), stale) + "</div>" +
    "</div>" +

    '<div class="tab-handoff"><span><strong>このタブは承認対象だけを表示します。</strong>' +
    "承認対象ではない要確認 " + attn + " 件と運転状況は「運転と注意」にあります。</span>" +
    '<button type="button" class="btn btn-secondary btn-sm" data-act="home-tab" data-arg="runtime">運転と注意を開く</button></div>';
}

/* tab 2: 運転と注意 — 「運転は正常か」に必要な数字と、承認対象でない要確認 */
function renderHomeRuntime(state) {
  const stale = state === "stale";

  return (stale ? staleBanner(
      "A8成果データが15日前（期待間隔7日）",
      "理由: ASP側の確定処理待ち。古いのは成果データのみで、WP状態と公開可能条件は10:42:14時点で最新です。") : "") +

    sectionHead("運転状況 / RUNTIME", "運転は正常か",
      "対象site・判断待ち・処理中・失敗・次の自動処理を1行で確認します。") +
    runtimeStrip(state) +

    sectionHead("注意 / ATTENTION", "確認しておくこと",
      "ここに出るものは承認対象ではありません。承認・差し戻しは「判断待ち」で行います。") +
    alertCards(state);
}

/* tab 3: 成果サマリ — L1成功基準の現在値まで。内訳は WP-UI-07 が正本 */
function renderHomeOutcome(state) {
  const stale = state === "stale";

  const goal = '<div class="card card-pad"><div class="goal"><div>' +
    badge("L1成功基準", "neutral", "◎") +
    '<div class="goal-figure" style="margin-top:8px"><strong>' + esc(OUTCOMES.ratio) + "</strong>" +
    "<span>/ 目標 " + esc(OUTCOMES.target) + " を3か月連続</span></div>" +
    '<div class="meter" style="margin:14px 0 8px"><i style="width:' + OUTCOMES.progress + '%"></i></div>' +
    '<p style="font-size:12.5px;color:var(--muted)">確定売上 ¥123,400 ÷ 実費 ¥75,200。推計値と帰属不能な成果は含みません。</p></div>' +
    '<div class="months">' + OUTCOMES.months.map((m) =>
      '<div class="month' + (m.hit ? " is-hit" : "") + '"><small>' + esc(m.m) + "</small><strong>" + esc(m.v) + "</strong></div>").join("") +
    "</div></div></div>";

  return (stale ? staleBanner(
      "A8成果データが15日前（期待間隔7日）",
      "表示中の確定CVと売上は8月8日時点です。8月9日以降の成果は未反映のため、L1成功基準の現在値は暫定です。") : "") +

    sectionHead("成果 / OUTCOMES", "今月の成果", "確定値のみ。推計値と帰属不能な成果は含みません。",
      '<button type="button" class="linkbtn" data-act="goto" data-arg="outcomes">成果を詳しく見る →</button>') +
    goal +
    '<div style="margin-top:14px">' + homeMetrics() + "</div>";
}

const HOME_PANELS = { decide: renderHomeDecide, runtime: renderHomeRuntime, outcome: renderHomeOutcome };

function renderHome() {
  const state = ui.state;
  const tab = ui.tab;
  const owner = HOME_STATE_SCOPE[state];

  let panel;
  if (state === "loading") {
    panel = renderLoading("home", tab);
  } else if (owner === tab) {
    /* 状態を所有するtabでは、そのtabの見出しの下に EmptyState / ErrorState /
       ReconciliationPanel をそのまま出す（要求の状態定義を欠かさない） */
    const owned = { empty: renderEmpty, error: renderError, reconcile: renderReconcile };
    panel = owned[state]("home");
  } else {
    panel = (owner ? scopeNote(state) : "") + HOME_PANELS[tab](state);
  }

  return renderHomeTabs(state) +
    '<div class="home-panel" id="home-panel" role="tabpanel" aria-labelledby="home-tab-' + tab + '">' + panel + "</div>";
}

/* --------------------------------------------------------------------------
   6. 記事・KW (WP-UI-02)
   ------------------------------------------------------------------------ */

const FILTERS = [
  { id: "all",     label: "すべての記事", test: () => true },
  { id: "decide",  label: "判断待ち",     test: (a) => a.flag === "decide" },
  { id: "red",     label: "gate red",     test: (a) => a.flag === "red" },
  { id: "running", label: "解析中",       test: (a) => a.flag === "running" },
  { id: "done",    label: "公開済み",     test: (a) => a.flag === "done" }
];

function articleAccounting() {
  const total = 1000;
  const excluded = EXCLUSIONS.reduce((sum, e) => sum + e.count, 0);
  const assigned = 930;
  const pending = total - assigned - excluded;
  return '<div class="card card-pad account">' +
    '<div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap">' +
      "<div><strong>KW母集団 1,000 件の帰属</strong>" +
      '<p style="color:var(--muted);font-size:12.5px">すべてのKWは「記事への帰属」か「除外理由」のどちらかに必ず接続します。</p></div>' +
      "<div>" + badge("orphan 0件", "ok", "✓") + "</div></div>" +
    '<div class="account-bar" role="img" aria-label="記事帰属 ' + assigned + '件、除外 ' + excluded + '件、未処理 ' + pending + '件">' +
      '<span class="seg-a" style="width:' + (assigned / 10) + '%"></span>' +
      '<span class="seg-b" style="width:' + (excluded / 10) + '%"></span>' +
      '<span class="seg-c" style="width:' + (pending / 10) + '%"></span></div>' +
    '<div class="account-legend">' +
      '<span><i style="background:#2f8f66"></i>記事へ帰属 ' + assigned + "件</span>" +
      '<span><i style="background:#d2a13f"></i>除外 ' + excluded + "件</span>" +
      '<span><i style="background:#9aa8a2"></i>未処理 ' + pending + "件（次回取得で解決予定）</span></div>" +
    '<p class="account-check">✓ 合計 ' + (assigned + excluded + pending) + " 件が母集団 " + total + " 件と一致（孤児KW 0件）</p></div>";
}

function articleRows(rows) {
  return rows.map((a) =>
    "<tr><td><span class=\"t-main\">" + esc(a.title) + '</span><span class="t-sub">メインKW: ' + esc(a.mainKw) + " · cluster " + esc(a.cluster) + "</span></td>" +
    '<td class="num">' + a.kw + "</td>" +
    "<td>" + badge(a.gate.label, a.gate.tone, a.gate.tone === "ok" ? "✓" : (a.gate.tone === "danger" ? "×" : "…")) + "</td>" +
    "<td>" + esc(a.wp) + "</td>" +
    "<td>" + esc(a.updated) + "</td>" +
    '<td><button type="button" class="linkbtn" data-act="goto-cluster" data-arg="' + a.cluster + '">根拠を見る →</button></td></tr>').join("");
}

function articleCards(rows) {
  return rows.map((a) =>
    '<div class="m-card"><div class="m-card-head"><div><strong>' + esc(a.title) + "</strong><small>メインKW: " + esc(a.mainKw) + "</small></div>" +
    badge(a.gate.label, a.gate.tone, a.gate.tone === "ok" ? "✓" : (a.gate.tone === "danger" ? "×" : "…")) + "</div>" +
    "<dl><div><dt>KW数</dt><dd>" + a.kw + "</dd></div><div><dt>WP状態</dt><dd>" + esc(a.wp) + "</dd></div>" +
    "<div><dt>cluster</dt><dd>" + esc(a.cluster) + "</dd></div><div><dt>更新</dt><dd>" + esc(a.updated) + "</dd></div></dl>" +
    '<button type="button" class="btn btn-secondary btn-sm btn-block" data-act="goto-cluster" data-arg="' + a.cluster + '">根拠を見る</button></div>').join("");
}

function renderArticles() {
  if (ui.state === "loading")   { return renderLoading("articles"); }
  if (ui.state === "empty")     { return renderEmpty("articles"); }
  if (ui.state === "error")     { return renderError("articles"); }
  if (ui.state === "reconcile") { return renderReconcile("articles"); }

  const stale = ui.state === "stale";
  const active = FILTERS.find((f) => f.id === ui.filter) || FILTERS[0];
  const rows = ARTICLES.filter(active.test);

  const chips = '<div class="chips">' + FILTERS.map((f) => {
    const n = ARTICLES.filter(f.test).length;
    return '<button type="button" class="chip" data-act="filter" data-arg="' + f.id + '" aria-pressed="' + (f.id === ui.filter) + '">' +
      esc(f.label) + '<span class="c-count">' + n + "</span></button>";
  }).join("") + "</div>";

  const table = rows.length === 0
    ? '<div class="card card-pad" style="text-align:center;color:var(--muted)">この条件に一致する記事はありません。<button type="button" class="linkbtn" data-act="filter" data-arg="all">すべての記事に戻す</button></div>'
    : '<div class="table-card no-mobile"><div class="table-scroll"><table>' +
      "<caption class=\"sr-only\">記事とKWの帰属一覧</caption>" +
      "<thead><tr><th>記事 / メインKW</th><th>KW数</th><th>gate</th><th>WP状態</th><th>更新</th><th>根拠</th></tr></thead>" +
      "<tbody>" + articleRows(rows) + "</tbody></table></div></div>" +
      '<div class="only-mobile">' + articleCards(rows) + "</div>";

  return (stale ? staleBanner(
      "SERP snapshotが8日前（期待間隔7日）",
      "理由: SERP取得cronが2回連続失敗。gate判定は前回snapshot基準のため、公開承認前に再取得が必要です。") : "") +
    sectionHead("記事・KW / WP-UI-02", "記事を主役にKWを管理する",
      "KWは必ず「どの記事に帰属したか」または「なぜ除外したか」へ接続します。", chips) +
    articleAccounting() +
    '<div style="margin-top:14px">' + table + "</div>" +
    sectionHead("除外 / EXCLUSION", "除外KW " + EXCLUSIONS.reduce((s, e) => s + e.count, 0) + " 件の理由内訳",
      "除外は導出規則の結果であり、手入力では作成できません。") +
    '<div class="card table-card"><div class="table-scroll"><table>' +
      "<thead><tr><th>除外理由</th><th>件数</th><th>導出規則</th></tr></thead><tbody>" +
      EXCLUSIONS.map((e) => "<tr><td>" + esc(e.reason) + '</td><td class="num">' + e.count + "</td><td><code>" + esc(e.rule) + "</code></td></tr>").join("") +
      "</tbody></table></div></div>";
}

/* --------------------------------------------------------------------------
   7. 処理の監査 (WP-UI-03)
   ------------------------------------------------------------------------ */

function renderAudit() {
  if (ui.state === "loading")   { return renderLoading("audit"); }
  if (ui.state === "empty")     { return renderEmpty("audit"); }
  if (ui.state === "error")     { return renderError("audit"); }
  if (ui.state === "reconcile") { return renderReconcile("audit"); }

  const stale = ui.state === "stale";
  const c = clusterOf(ui.clusterId);

  const list = CLUSTERS.map((x) =>
    '<button type="button" class="queue-item" data-act="select-cluster" data-arg="' + x.id + '" aria-pressed="' + (x.id === ui.clusterId) + '">' +
    '<span class="queue-item-top">' + badge(x.id, "info", "◈") + badge(x.verdict.label, x.verdict.tone, x.verdict.tone === "ok" ? "✓" : "…") + "</span>" +
    "<h3>" + esc(x.name) + "</h3>" +
    '<span class="qmeta"><span>KW <b>' + x.kw + "</b></span><span>SERP重複 <b>" + x.overlap + "%</b></span><span>" + esc(x.post) + "</span></span></button>").join("");

  const detail = '<article class="card card-pad">' +
    '<div class="section" style="margin:0 0 12px"><div><p class="eyebrow">' + esc(c.id) + '</p><h2>' + esc(c.name) + "</h2>" +
    '<p class="sub">' + c.kw + " KW → 記事「" + esc(c.article) + "」 · snapshot " + esc(c.snapshot) + "</p></div>" +
    "<div>" + badge(c.verdict.label, c.verdict.tone, c.verdict.tone === "ok" ? "✓" : "…") + "</div></div>" +

    '<div class="derived"><span aria-hidden="true">ⓘ</span><div><strong>DerivedStatus:</strong> この判定は source event <code>' + esc(c.event) +
    "</code> と導出規則 <code>" + esc(c.rule) + "</code> から導出された値です。手入力では作成・編集できません。" +
    "PO overrideは判定を上書きするのではなく、理由付きの別recordとして追記されます。</div></div>" +

    '<div style="margin:16px 0"><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700">' +
    "<span>SERP重複率</span><span>" + c.overlap + "% <span style=\"color:var(--muted);font-weight:500\">/ 統合しきい値 50%</span></span></div>" +
    '<div class="meter' + (c.overlap < 60 ? " warn" : "") + '" style="margin-top:9px" role="img" aria-label="SERP重複率 ' + c.overlap +
    'パーセント、統合しきい値50パーセント"><i style="width:' + c.overlap + '%"></i>' +
    '<span class="meter-mark" style="left:50%"></span></div>' +
    '<p style="font-size:11.5px;color:var(--muted);margin-top:7px">縦線が統合しきい値（50%）。しきい値との距離が小さいほどoverrideの検討余地が大きくなります。</p></div>' +

    '<dl class="kv"><div><dt>snapshot条件</dt><dd style="font-size:12.5px">' + esc(c.snapshot) + "</dd></div>" +
    "<div><dt>導出規則version</dt><dd>" + esc(c.rule) + "</dd></div>" +
    "<div><dt>source event</dt><dd>" + esc(c.event) + "</dd></div>" +
    "<div><dt>WP状態</dt><dd>" + esc(c.post) + "</dd></div></dl>" +

    '<h3 style="font-size:14px;margin:18px 0 9px">判定根拠</h3>' +
    '<ul class="reasoning">' + c.reasoning.map((r) =>
      '<li><span class="r-mark" style="' + (r.ok ? "" : "background:var(--warn-bg);color:var(--warn)") + '" aria-hidden="true">' +
      (r.ok ? "✓" : "!") + '</span><span class="r-body">' + esc(r.text) +
      "<small>" + (r.ok ? "根拠" : "反証候補") + " <code>" + esc(r.ref) + "</code></small></span></li>").join("") + "</ul>";

  const override = '<aside class="card card-pad">' +
    "<h3 style=\"font-size:14px\">PO override — " + esc(c.id) + "</h3>" +
    '<p style="color:var(--muted);font-size:12.5px;margin-top:4px">機械判定と結論が違う場合のみ、理由を残して上書きします。overrideは選択中のclusterに対してのみ適用され、再解析後も維持されます。</p>' +
    '<div class="override-actions">' +
      '<button type="button" class="btn btn-secondary btn-block" data-act="override" data-arg="split">clusterを分割する</button>' +
      '<button type="button" class="btn btn-secondary btn-block" data-act="override" data-arg="merge">clusterを統合する</button>' +
      '<button type="button" class="btn btn-danger btn-block" data-act="override" data-arg="exclude">KWを除外する</button>' +
    "</div>" +
    '<p style="color:var(--muted);font-size:11.5px;margin-top:12px">いずれも理由入力と確認stepを経てから記録されます。確認stepで取消した場合、記録も外部writeも行いません。</p>' +
    '<hr style="border:0;border-top:1px solid var(--line);margin:16px 0">' +
    "<h3 style=\"font-size:14px\">この判断の行き先</h3>" +
    '<p style="color:var(--muted);font-size:12.5px;margin-top:4px">clusterの結論は記事構成へ反映され、記事の公開可能条件3（KW/PAA/見出し）の入力になります。</p>' +
    '<button type="button" class="linkbtn" data-act="home-tab" data-arg="decide">承認queueへ戻る →</button></aside>';

  return (stale ? staleBanner(
      "SERP snapshotが8日前（期待間隔7日）",
      "理由: 取得cron失敗。この判定は8月15日のsnapshotに基づくため、公開承認の根拠としては再取得後に再評価が必要です。") : "") +
    sectionHead("処理の監査 / WP-UI-03", "なぜこのcluster・gate判定になったか",
      "判定は導出値です。snapshot条件、規則version、source eventまで遡って確認できます。") +
    '<div class="audit-layout">' +
      '<div class="queue-list-box"><div class="queue-list">' + list + "</div></div>" +
      '<div class="detail-box">' + detail + "</div>" +
      '<div class="attention-box">' + override + "</div>" +
    "</div>";
}

/* --------------------------------------------------------------------------
   8. 成果 (WP-UI-07)
   ------------------------------------------------------------------------ */

function renderOutcomes() {
  if (ui.state === "loading")   { return renderLoading("outcomes"); }
  if (ui.state === "empty")     { return renderEmpty("outcomes"); }
  if (ui.state === "error")     { return renderError("outcomes"); }
  if (ui.state === "reconcile") { return renderReconcile("outcomes"); }

  const stale = ui.state === "stale";

  const goal = '<div class="card card-pad"><div class="goal">' +
    "<div>" + badge("read-only surface", "neutral", "🔒") +
    '<p style="font-size:12px;color:var(--muted);margin-top:8px">L1成功基準: 売上 ÷ 運用コスト</p>' +
    '<div class="goal-figure"><strong>' + esc(OUTCOMES.ratio) + "</strong><span>/ 目標 " + esc(OUTCOMES.target) + " を3か月連続</span></div>" +
    '<div class="meter" style="margin:14px 0 8px"><i style="width:' + OUTCOMES.progress + '%"></i></div>' +
    '<p style="font-size:12.5px;color:var(--muted)">確定売上 ¥123,400 ÷ 実費 ¥75,200。推計値と帰属不能な成果は含みません。</p></div>' +
    '<div class="months">' + OUTCOMES.months.map((m) =>
      '<div class="month' + (m.hit ? " is-hit" : "") + '"><small>' + esc(m.m) + "</small><strong>" + esc(m.v) + "</strong></div>").join("") +
    "</div></div></div>";

  const ledger = (title, rows) => '<div class="card card-pad"><h3 style="font-size:14px">' + esc(title) + '</h3><div class="breakdown" style="margin-top:8px">' +
    rows.map((r) => '<div class="breakdown-row' + (r.total ? " total" : "") + '"><span>' + esc(r.label) + "</span><span>" + esc(r.value) + "</span></div>").join("") +
    "</div></div>";

  return (stale ? staleBanner(
      "A8成果データが15日前（期待間隔7日）",
      "理由: ASP側の確定処理待ち。表示中の確定CVと売上は8月8日時点であり、8月9日以降の成果は未反映です。") : "") +
    '<div class="readonly-note"><span aria-hidden="true">🔒</span><span>この画面はread-onlyです。承認・差し戻し・override操作はありません（L2 screen-list: 取消 N/A）。</span></div>' +
    sectionHead("成果 / WP-UI-07", "表示・AI露出・CV・収益を分離して見る",
      "各値は測定sourceと取得時刻へtraceします。推計と実測を混ぜません。") +
    goal +
    '<div class="metrics" style="margin-top:14px">' + OUTCOMES.metrics.map((m) =>
      '<article class="metric"><span class="m-label">' + esc(m.label) + '</span><strong class="m-value">' + esc(m.value) +
      '</strong><span class="m-delta ' + (m.tone === "neutral" ? "neutral" : "") + '">' + esc(m.delta) +
      '</span><span class="m-source">' + esc(m.source) + "</span></article>").join("") + "</div>" +
    sectionHead("内訳 / LEDGER", "売上とコストの内訳", "帰属不能な成果は集計から除外しています。") +
    '<div class="alerts">' + ledger("売上（確定のみ）", OUTCOMES.revenue) + ledger("運用コスト（実費）", OUTCOMES.cost) + "</div>";
}

/* --------------------------------------------------------------------------
   9. 未着手surface
   ------------------------------------------------------------------------ */

function renderSoon(s) {
  return '<section class="state-panel"><div class="state-icon" aria-hidden="true">◇</div>' +
    "<h2>" + esc(s.title) + "（" + esc(s.surface) + "）は次のprototype revisionで確認します</h2>" +
    "<p>POの問い「" + esc(s.question) + "」に対する画面です。優先度P1のため、まずP0の4画面（ホーム・記事KW・処理監査・成果）で判断骨格を合意します。</p>" +
    stateFacts([
      ["surface ID", s.surface + " · " + s.screen],
      ["route", s.route],
      ["優先度", "P1（L2 screen-list.md）"],
      ["この画面がない間の代替", "ホームのattention領域に重大な事象のみ表示する"]
    ]) +
    stateActions([["ホームへ戻る", "goto", "home"]]) + "</section>";
}

/* --------------------------------------------------------------------------
   10. dialog: 公開可能条件 → 承認（2 step）
   ------------------------------------------------------------------------ */

const publishDialog = $("#publish-dialog");
const reasonDialog = $("#reason-dialog");
const evidenceDialog = $("#evidence-dialog");

function openDialog(dialog, html) {
  ui.lastFocus = document.activeElement;
  const body = dialog.firstElementChild;
  body.innerHTML = html;
  dialog.showModal();
  const first = body.querySelector("[data-autofocus]:not([disabled])") ||
    body.querySelector("textarea") ||
    body.querySelector("button:not([disabled])");
  if (first) { first.focus(); }
}

function closeDialog(dialog) {
  if (dialog.open) { dialog.close(); }
}

[publishDialog, reasonDialog, evidenceDialog].forEach((dialog) => {
  dialog.addEventListener("close", () => {
    if (ui.lastFocus && document.contains(ui.lastFocus)) { ui.lastFocus.focus(); }
  });
});

function publishStep1(d) {
  const conditions = publishConditions(d.post, d.redIndex);
  const green = conditions.filter((c) => c.ok).length;
  const blocked = green < 7;

  return '<div class="dlg-head"><div><p class="eyebrow">STEP 1 / 2 · 公開可能条件</p>' +
    '<h2 id="publish-dialog-title">公開可能条件 ' + green + "/7</h2>" +
    '<p class="dlg-sub">WordPress post <strong>#' + d.post.id + "</strong> · digest <code>" + esc(d.post.digest) + "</code> · action <strong>draft → publish</strong></p></div>" +
    '<button type="button" class="dlg-close" data-act="cancel-dialog" aria-label="閉じる（取消）">×</button></div>' +

    '<div class="dlg-body">' +
      '<div class="steps"><b class="is-now"><span class="s-num">1</span>条件を確認</b><span aria-hidden="true">›</span>' +
      '<b><span class="s-num">2</span>理由を入力して承認</b><span aria-hidden="true">›</span><b><span class="s-num">3</span>operation ID表示</b></div>' +

      (blocked ? '<div class="blocked-note"><span aria-hidden="true">⛔</span><span><b>公開writeは実行できません。</b>' +
        "条件が1件でもredの場合、公開writeは0件になります（AC-S1-008）。差し戻して原因を解消してください。</span></div>" : "") +

      '<div class="impact-grid">' +
        '<div class="impact-cell"><h4>実行差分</h4><p class="diff-line"><span class="from">draft</span><span aria-hidden="true">→</span><span class="to">publish</span></p></div>' +
        '<div class="impact-cell is-write"><h4>外部影響</h4><p>WordPress書込 1件<br>公開URL ' + esc(d.post.url) + "</p></div>" +
        '<div class="impact-cell is-rollback"><h4>rollback</h4><p>' + esc(d.post.rollbackId) + "<br>同一post IDをdraftへ復帰</p></div>" +
      "</div>" +

      '<div class="gate-items">' + conditions.map((c) =>
        '<div class="gate-item' + (c.ok ? "" : " is-red") + '"><span class="gate-mark" aria-hidden="true">' + (c.ok ? "✓" : "×") + "</span>" +
        '<span class="gi-body"><strong>' + c.no + ". " + esc(c.title) + "</strong>" +
        "<small>" + esc(c.detail) + "</small>" +
        '<span class="gi-ref">' + (c.ok ? "green" : "RED") + " · evidence " + esc(c.ref) + "</span></span></div>").join("") + "</div>" +

      '<dl class="binding"><div><dt>承認の束縛先</dt><dd>post #' + d.post.id + " / " + esc(d.post.digest) + " / action=publish</dd></div>" +
      "<div><dt>有効期限</dt><dd>" + esc(d.due.at) + "</dd></div>" +
      "<div><dt>公開後の検証</dt><dd>GET再取得で status=publish と URL を確認</dd></div>" +
      "<div><dt>operation chain</dt><dd>" + esc(d.post.operationId) + "</dd></div></dl>" +
    "</div>" +

    '<div class="dlg-foot"><span class="foot-note">取消した場合、外部writeもoperation追記も行いません。</span>' +
    '<button type="button" class="btn btn-secondary" data-act="cancel-dialog">取消して詳細へ戻る</button>' +
    '<button type="button" class="btn btn-primary" data-act="publish-step2" data-arg="' + d.id + '"' + (blocked ? " disabled" : "") + ' data-autofocus>' +
    (blocked ? "承認できません" : "承認へ進む") + "</button></div>";
}

function publishStep2(d) {
  return '<div class="dlg-head"><div><p class="eyebrow">STEP 2 / 2 · 承認</p>' +
    '<h2 id="publish-dialog-title">この内容で公開を承認しますか</h2>' +
    '<p class="dlg-sub">承認は post <strong>#' + d.post.id + "</strong> と digest <code>" + esc(d.post.digest) + "</code>、action <strong>publish</strong> へ束縛されます。</p></div>" +
    '<button type="button" class="dlg-close" data-act="cancel-dialog" aria-label="閉じる（取消）">×</button></div>' +

    '<div class="dlg-body">' +
      '<div class="steps"><b><span class="s-num">1</span>条件を確認</b><span aria-hidden="true">›</span>' +
      '<b class="is-now"><span class="s-num">2</span>理由を入力して承認</b><span aria-hidden="true">›</span><b><span class="s-num">3</span>operation ID表示</b></div>' +

      '<dl class="binding"><div><dt>実行差分</dt><dd>status draft → publish</dd></div>' +
      "<div><dt>外部影響</dt><dd>WordPress書込 1件 / " + esc(d.post.url) + "</dd></div>" +
      "<div><dt>rollback</dt><dd>" + esc(d.post.rollbackId) + "（draftへ復帰・24時間有効）</dd></div>" +
      "<div><dt>公開可能条件</dt><dd>7/7 green</dd></div></dl>" +

      "<div><label class=\"field\" for=\"approve-reason\">承認理由<span class=\"req\">必須</span>" +
      "<small>この理由は承認recordへ保存され、後から公開判断を再現するために使われます。</small></label>" +
      '<textarea id="approve-reason" rows="3" placeholder="例: 公開可能条件7件を確認。事実sourceも全件添付されているため公開する。"></textarea>' +
      '<p class="field-error" id="approve-reason-error">承認理由を入力してください。理由がない承認は記録できません。</p></div>' +

      '<div class="no-retry" style="border-color:var(--info-line);background:var(--info-bg);color:var(--info)">' +
      '<span aria-hidden="true">ⓘ</span><span>これはprototypeです。「承認して公開する」を押しても外部通信・WordPressへのwriteは発生しません。</span></div>' +
    "</div>" +

    '<div class="dlg-foot"><span class="foot-note">Escapeでも取消できます。</span>' +
    '<button type="button" class="btn btn-secondary" data-act="publish-back" data-arg="' + d.id + '">条件確認へ戻る</button>' +
    '<button type="button" class="btn btn-primary" data-act="publish-confirm" data-arg="' + d.id + '">承認して公開する</button></div>';
}

function runPublish(d) {
  const reasonField = $("#approve-reason");
  const reason = reasonField ? reasonField.value.trim() : "";
  if (!reason) {
    $("#approve-reason-error").classList.add("show");
    reasonField.setAttribute("aria-invalid", "true");
    reasonField.focus();
    announce("承認理由が未入力のため承認できません。");
    return;
  }

  ui.completed[d.id] = {
    operationId: d.post.operationId,
    steps: [
      ["承認record作成", "<code>WP-AP-0088</code> · post #" + d.post.id + " / " + esc(d.post.digest) + " / action=publish · 理由記録あり"],
      ["公開write（prototype上の表示のみ）", "idempotency key <code>IK-" + d.post.id + "-publish-7f31</code> · 再送なし"],
      ["公開後GET検証", "status=<strong>publish</strong> · URL " + esc(d.post.url) + " · digest 一致"],
      ["証跡記録", "post ID / status / modified / content digest / 検証時刻 / 相関IDのみ保存。本文と全応答は保存しない"]
    ]
  };

  closeDialog(publishDialog);
  render();
  toast("承認しました。operation ID " + d.post.operationId + "（prototype表示のみ・外部writeなし）");
  announce("承認が完了しました。operation ID " + d.post.operationId + " を表示しています。");
}

/* --------------------------------------------------------------------------
   11. dialog: 理由入力を伴う汎用confirm
   ------------------------------------------------------------------------ */

function openReasonDialog(config) {
  ui.pendingReason = config;
  openDialog(reasonDialog,
    '<div class="dlg-head"><div><p class="eyebrow">' + esc(config.eyebrow) + "</p>" +
    '<h2 id="reason-dialog-title">' + esc(config.title) + "</h2>" +
    '<p class="dlg-sub">' + esc(config.sub) + "</p></div>" +
    '<button type="button" class="dlg-close" data-act="cancel-dialog" aria-label="閉じる（取消）">×</button></div>' +
    '<div class="dlg-body">' +
      '<dl class="binding">' + config.facts.map((f) =>
        "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>").join("") + "</dl>" +
      "<div><label class=\"field\" for=\"generic-reason\">" + esc(config.reasonLabel) + '<span class="req">必須</span>' +
      "<small>" + esc(config.reasonHelp) + "</small></label>" +
      '<textarea id="generic-reason" rows="3" placeholder="' + esc(config.placeholder) + '" data-autofocus></textarea>' +
      '<p class="field-error" id="generic-reason-error">理由を入力してください。</p></div>' +
    "</div>" +
    '<div class="dlg-foot"><span class="foot-note">取消した場合、記録も外部writeも行いません。</span>' +
    '<button type="button" class="btn btn-secondary" data-act="cancel-dialog">取消</button>' +
    '<button type="button" class="btn ' + (config.danger ? "btn-danger" : "btn-primary") + '" data-act="reason-confirm">' + esc(config.confirmLabel) + "</button></div>");
}

function runReasonConfirm() {
  const field = $("#generic-reason");
  const reason = field ? field.value.trim() : "";
  if (!reason) {
    $("#generic-reason-error").classList.add("show");
    field.setAttribute("aria-invalid", "true");
    field.focus();
    announce("理由が未入力のため実行できません。");
    return;
  }
  const message = ui.pendingReason.done;
  closeDialog(reasonDialog);
  toast(message);
  announce(message);
}

/* --------------------------------------------------------------------------
   12. dialog: 証跡（EvidenceLink）
   ------------------------------------------------------------------------ */

function openEvidenceDialog(d) {
  openDialog(evidenceDialog,
    '<div class="dlg-head"><div><p class="eyebrow">EVIDENCE</p>' +
    '<h2 id="evidence-dialog-title">証跡 ' + d.evidence.length + " 件</h2>" +
    '<p class="dlg-sub">post #' + d.post.id + " · chain " + esc(d.post.operationId) + "</p></div>" +
    '<button type="button" class="dlg-close" data-act="cancel-quiet" aria-label="閉じる">×</button></div>' +
    '<div class="dlg-body"><div class="evidence-list" style="margin:0">' +
    d.evidence.map((e) =>
      '<div class="evidence-row"><code>' + esc(e.id) + '</code><span class="ev-label">' + esc(e.label) +
      "</span><time>" + esc(e.at) + "</time></div>").join("") + "</div>" +
    '<dl class="binding"><div><dt>保存している項目</dt><dd>post ID / status / modified / content digest / 検証時刻 / 相関ID</dd></div>' +
    "<div><dt>保存しない項目</dt><dd>記事本文の複製 / 全API応答 / credential・Application Password・Cookie</dd></div>" +
    "<div><dt>content digest</dt><dd>" + esc(d.post.digest) + "</dd></div></dl>" +
    '<p style="font-size:12px;color:var(--muted)">証跡IDは不変です。secret値はこの画面にも証跡にも表示しません。</p></div>' +
    '<div class="dlg-foot"><button type="button" class="btn btn-secondary" data-act="cancel-quiet" data-autofocus>閉じる</button></div>');
}

/* --------------------------------------------------------------------------
   13. 描画
   ------------------------------------------------------------------------ */

function renderFreshness() {
  const copy = (STATE_COPY[ui.view] || STATE_COPY.home).freshness[ui.state];
  const cls = copy.tone === "stale" ? " is-stale" : (copy.tone === "error" ? " is-error" : "");
  $("#freshness-badge").className = "freshness" + cls;
  $("#freshness-badge").innerHTML =
    '<span class="fresh-icon" aria-hidden="true">' + copy.icon + "</span>" +
    '<span class="fresh-body"><strong>' + esc(copy.head) + "</strong><small>" + esc(copy.sub) + "</small></span>";
}

function renderNav() {
  const list = $("#primary-nav");
  /* nav countは判断待ちtabのbadgeと同じ値にする（0件のときは出さない） */
  const pending = ui.state === "empty" ? 0 : pendingCount();
  list.innerHTML = SURFACES.map((s) =>
    '<button type="button" role="tab" id="tab-' + s.id + '" class="nav-item" data-view="' + s.id +
    '" data-soon="' + Boolean(s.soon) + '" aria-selected="' + (s.id === ui.view) +
    '" aria-controls="panel-current" tabindex="' + (s.id === ui.view ? "0" : "-1") + '">' +
    '<span class="nav-glyph" aria-hidden="true">' + s.glyph + "</span>" +
    '<span class="nav-label">' + esc(s.nav) + '<span class="nav-id"> ' + s.surface + "</span></span>" +
    (s.count && !s.soon && pending > 0 ? '<span class="nav-count">' + pending + "</span>" : "") +
    "</button>").join("");
}

function renderStateSwitch() {
  $("#state-switch").innerHTML = STATES.map((s) =>
    '<button type="button" role="radio" class="sim-btn" data-state="' + s.id +
    '" aria-checked="' + (s.id === ui.state) + '" tabindex="' + (s.id === ui.state ? "0" : "-1") + '">' +
    esc(s.label) + "</button>").join("");
}

function renderRailRuntime() {
  const map = {
    normal:    ["dot-ok",   "正常",          "次回取得 8月24日 03:00"],
    stale:     ["dot-warn", "一部データstale", "A8成果 15日前 / 期待7日"],
    loading:   ["dot-ok",   "取得中",        "実行中のstepあり"],
    empty:     ["dot-ok",   "正常 / 判断0件", "次回取得 8月24日 03:00"],
    error:     ["dot-bad",  "failure",       "承認記録stepで失敗"],
    reconcile: ["dot-warn", "照合待ち",      "reconciliation_required"]
  };
  const m = map[ui.state];
  $("#rail-runtime").innerHTML = '<span class="dot ' + m[0] + '" aria-hidden="true"></span>' +
    "<span><strong>" + esc(m[1]) + "</strong><small>" + esc(m[2]) + "</small></span>";
}

const RENDERERS = { home: renderHome, articles: renderArticles, audit: renderAudit, outcomes: renderOutcomes };

function render() {
  const s = surfaceOf(ui.view);

  $("#crumb-surface").textContent = s.surface;
  $("#crumb-screen").textContent = s.screen;
  $("#crumb-route").textContent = s.route;
  $("#page-title").textContent = s.title;
  $("#page-question").textContent = "POの問い: " + s.question;
  document.title = "WP Operations — " + s.title + "（" + s.surface + "）";

  renderNav();
  renderStateSwitch();
  renderFreshness();
  renderRailRuntime();

  const body = s.soon ? renderSoon(s) : RENDERERS[s.id]();
  $("#view-mount").innerHTML =
    '<div id="panel-current" role="tabpanel" aria-labelledby="tab-' + s.id + '">' + body + "</div>";

  writeHash();
}

/* --------------------------------------------------------------------------
   14. 操作
   ------------------------------------------------------------------------ */

function goto(viewId) {
  if (ui.view === viewId) { return; }
  ui.view = viewId;
  render();
  $("#view-region").focus();
  announce(surfaceOf(viewId).title + "を表示しました。");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* 判断ホーム内のsub-tab切替。他surfaceからの導線でも使うためviewごと戻す。 */
function setHomeTab(tabId, quiet) {
  const tab = HOME_TABS.find((t) => t.id === tabId);
  if (!tab) { return; }
  const moved = ui.view !== "home";

  ui.view = "home";
  ui.tab = tab.id;
  render();

  /* 再描画でbutton要素は作り直されるため、選択中tabへfocusを戻す */
  const restored = $("#home-tab-" + tab.id);
  if (restored) { restored.focus(); } else { $("#view-region").focus(); }

  if (!quiet) {
    const st = homeTabStatus(tab.id, ui.state);
    announce(tab.label + "を表示しました。" + st.sr + "。");
  }
  if (moved) { window.scrollTo({ top: 0, behavior: "smooth" }); }
}

function setState(stateId, quiet) {
  ui.state = stateId;
  render();
  if (!quiet) {
    const label = STATES.find((s) => s.id === stateId).label;
    announce("表示状態を " + label + " に切り替えました。");
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-act], [data-view], [data-state], [data-tab]");
  if (!target) { return; }

  if (target.dataset.view) { goto(target.dataset.view); return; }
  if (target.dataset.state) { setState(target.dataset.state); return; }
  if (target.dataset.tab) { setHomeTab(target.dataset.tab); return; }

  const act = target.dataset.act;
  const arg = target.dataset.arg || "";

  switch (act) {
    case "goto":
      goto(arg);
      break;

    case "home-tab":
      setHomeTab(arg);
      break;

    case "goto-cluster":
      ui.clusterId = CLUSTERS.some((c) => c.id === arg) ? arg : ui.clusterId;
      goto("audit");
      break;

    case "select-decision":
      ui.decisionId = arg;
      render();
      announce(decisionOf(arg).title + "の詳細を表示しました。");
      break;

    case "select-cluster":
      ui.clusterId = arg;
      render();
      announce(clusterOf(arg).name + "の判定根拠を表示しました。");
      break;

    case "filter":
      ui.filter = arg;
      render();
      announce("絞り込みを " + (FILTERS.find((f) => f.id === arg) || FILTERS[0]).label + " に変更しました。");
      break;

    case "open-publish":
      openDialog(publishDialog, publishStep1(decisionOf(arg)));
      break;

    case "publish-step2":
      openDialog(publishDialog, publishStep2(decisionOf(arg)));
      break;

    case "publish-back":
      openDialog(publishDialog, publishStep1(decisionOf(arg)));
      break;

    case "publish-confirm":
      runPublish(decisionOf(arg));
      break;

    case "open-return": {
      const d = decisionOf(arg);
      openReasonDialog({
        eyebrow: "差し戻し",
        title: "この対象を差し戻しますか",
        sub: "差し戻しはWordPressへwriteしません。post #" + d.post.id + " は draft のまま維持されます。",
        facts: [
          ["対象", d.title],
          ["post ID / status", "#" + d.post.id + " / " + d.post.status],
          ["content digest", d.post.digest],
          ["外部影響", "なし（WordPressへのwriteは0件）"],
          ["行き先", "harnessの修正queueへ差し戻し理由付きで登録"]
        ],
        reasonLabel: "差し戻し理由",
        reasonHelp: "理由は再生成の入力になります。どのgateをどう直せばよいかが分かる粒度で記録してください。",
        placeholder: "例: 事実provenanceが未充足。未検証の主張3件にsourceを付けてから再提出。",
        confirmLabel: "差し戻す",
        done: "差し戻しました。外部writeは行っていません（prototype表示のみ）。"
      });
      break;
    }

    case "override": {
      const c = clusterOf(ui.clusterId);
      const kindLabel = { split: "分割", merge: "統合", exclude: "KW除外" }[arg];
      openReasonDialog({
        eyebrow: "PO OVERRIDE",
        title: "cluster " + c.id + " を" + kindLabel + "しますか",
        sub: "overrideは機械判定を消さず、理由付きの別recordとして追記されます。",
        facts: [
          ["対象cluster", c.id + " / " + c.name],
          ["機械判定", c.verdict.label],
          ["導出規則", c.rule + "（source event " + c.event + "）"],
          ["override種別", kindLabel],
          ["外部影響", "なし（WordPressへのwriteは0件）"]
        ],
        reasonLabel: "override理由",
        reasonHelp: "この理由は再解析後も保持され、後から判定差分を説明するために使われます。",
        placeholder: "例: 検索意図が「設計手順」と「外注費用」に二分しているため分割する。",
        confirmLabel: kindLabel + "する",
        danger: arg === "exclude",
        done: "override（" + kindLabel + "）を記録しました。外部writeは行っていません（prototype表示のみ）。"
      });
      break;
    }

    case "evidence":
      openEvidenceDialog(decisionOf(arg));
      break;

    case "reset-decision":
      delete ui.completed[arg];
      render();
      toast("prototypeの承認状態を初期化しました。");
      break;

    case "retry":
      setState("loading", true);
      announce("再取得しています。");
      window.setTimeout(() => {
        setState("normal", true);
        toast("再取得しました。判断可能な状態へ戻っています。");
        announce("再取得が完了し、normal表示へ戻りました。");
      }, 1400);
      break;

    case "recon":
      toast("WP側の実測結果を照会しました。再送は行っていません（prototype表示のみ）。");
      announce("照会を実行しました。自動再送は行っていません。");
      break;

    case "recon-queue":
      toast("PO判断queueへ送りました。同一operation chainへ追記されます。");
      announce("PO判断queueへ送りました。");
      break;

    case "cancel-dialog":
      closeDialog(publishDialog);
      closeDialog(reasonDialog);
      toast("取消しました。外部writeもoperation追記も行っていません。");
      announce("取消しました。対象詳細へ戻ります。");
      break;

    case "cancel-quiet":
      closeDialog(evidenceDialog);
      break;

    case "reason-confirm":
      runReasonConfirm();
      break;

    default:
      break;
  }
});

/* Escape（dialogのcancel event）も取消として扱う */
[publishDialog, reasonDialog].forEach((dialog) => {
  dialog.addEventListener("cancel", () => {
    toast("取消しました。外部writeもoperation追記も行っていません。");
  });
});

/* --------------------------------------------------------------------------
   15. keyboard: tablist と radiogroup の矢印key移動
   ------------------------------------------------------------------------ */

function roving(container, selector, onPick, orientationKeys) {
  container.addEventListener("keydown", (event) => {
    const items = $$(selector, container);
    const index = items.indexOf(document.activeElement);
    if (index < 0) { return; }

    let next = -1;
    if (orientationKeys.next.indexOf(event.key) >= 0) { next = (index + 1) % items.length; }
    if (orientationKeys.prev.indexOf(event.key) >= 0) { next = (index - 1 + items.length) % items.length; }
    if (event.key === "Home") { next = 0; }
    if (event.key === "End") { next = items.length - 1; }
    if (next < 0) { return; }

    event.preventDefault();
    items[next].focus();
    onPick(items[next]);
  });
}

roving($("#primary-nav"), ".nav-item", (item) => {
  goto(item.dataset.view);
  const restored = $("#tab-" + ui.view);
  if (restored) { restored.focus(); }
}, { next: ["ArrowDown", "ArrowRight"], prev: ["ArrowUp", "ArrowLeft"] });

roving($("#state-switch"), ".sim-btn", (item) => {
  const id = item.dataset.state;
  setState(id);
  const restored = $('#state-switch [data-state="' + id + '"]');
  if (restored) { restored.focus(); }
}, { next: ["ArrowRight", "ArrowDown"], prev: ["ArrowLeft", "ArrowUp"] });

/* ホームのsub-tablistは再描画で作り直されるため、安定した祖先#view-mountへ委譲する。
   focusが .subtab 上にないkey操作は roving() 側で無視される。 */
roving($("#view-mount"), ".subtab", (item) => {
  setHomeTab(item.dataset.tab);
}, { next: ["ArrowRight", "ArrowDown"], prev: ["ArrowLeft", "ArrowUp"] });

/* --------------------------------------------------------------------------
   16. deep link
   L2 screen-flow.md「deep linkは対象とfilterを保持する」の確認用。
   `t=` はホーム内sub-tabで、reload・再入場でも選択中tabを保持する。
   例: index.html#/articles?state=stale&f=red
       index.html#/home?state=normal&t=runtime
   ------------------------------------------------------------------------ */

let syncingHash = false;

function readHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) { return; }
  const parts = raw.split("?");
  const viewId = parts[0];
  const params = new URLSearchParams(parts[1] || "");

  if (SURFACES.some((s) => s.id === viewId)) { ui.view = viewId; }
  if (STATES.some((s) => s.id === params.get("state"))) { ui.state = params.get("state"); }
  if (HOME_TABS.some((t) => t.id === params.get("t"))) { ui.tab = params.get("t"); }
  if (decisionOf(params.get("d"))) { ui.decisionId = params.get("d"); }
  if (clusterOf(params.get("c"))) { ui.clusterId = params.get("c"); }
  if (FILTERS.some((f) => f.id === params.get("f"))) { ui.filter = params.get("f"); }
}

function writeHash() {
  const query = "state=" + ui.state + "&t=" + ui.tab + "&d=" + ui.decisionId + "&c=" + ui.clusterId + "&f=" + ui.filter;
  const next = "#/" + ui.view + "?" + query;
  if (window.location.hash === next) { return; }
  syncingHash = true;
  try { window.location.hash = next; } catch (e) { /* file://配下では無視する */ }
  window.setTimeout(() => { syncingHash = false; }, 0);
}

window.addEventListener("hashchange", () => {
  if (syncingHash) { return; }
  readHash();
  render();
});

/* --------------------------------------------------------------------------
   17. init
   ------------------------------------------------------------------------ */

readHash();
render();
announce("WP Operations prototypeを表示しました。fixture表示のみで外部通信は行いません。");
