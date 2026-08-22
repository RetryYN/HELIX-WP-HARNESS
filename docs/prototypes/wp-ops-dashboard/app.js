/* ==========================================================================
   WP Operations — L2 画面prototype (WP-PROT-UI-02-r4)

   fixture-only。fetch / XHR / WebSocket を一切使わず、外部通信も本番writeも
   行わない。DataForSEO surfaceを含め全ての値はfixtureであり、DataForSEO API
   への接続・課金・credential保持は一切ない。
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

const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

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
  { id: "home",      surface: "WP-UI-01", screen: "WP-SCR-01", route: "/",               nav: "ホーム",           title: "判断ホーム",       question: "今、判断が必要か。運転は正常か",           count: 2 },
  { id: "articles",  surface: "WP-UI-02", screen: "WP-SCR-02", route: "/articles",       nav: "記事・KW",         title: "記事・KW",         question: "全KWがどの記事・除外理由へ帰属したか" },
  { id: "audit",     surface: "WP-UI-03", screen: "WP-SCR-03", route: "/audit/clusters", nav: "処理の監査",       title: "処理の監査",       question: "なぜこのcluster・gate判定になったか" },
  { id: "outcomes",  surface: "WP-UI-07", screen: "WP-SCR-07", route: "/outcomes",       nav: "成果",             title: "成果",             question: "収益と費用、L1成功基準の現在値は何か" },
  { id: "aio",       surface: "WP-UI-04", screen: "WP-SCR-04", route: "/aio",            nav: "AIO / LLMO",       title: "AIO / LLMO",       question: "AIに読まれ、露出しているか",             soon: true },
  { id: "links",     surface: "WP-UI-05", screen: "WP-SCR-05", route: "/links",          nav: "内部link・売り場", title: "内部link・売り場", question: "孤立、提携切れ、差替対象は何か",         soon: true },
  { id: "rewrites",  surface: "WP-UI-06", screen: "WP-SCR-06", route: "/rewrites",       nav: "rewrite",          title: "rewrite",          question: "どの記事をなぜ直し、結果がどう変化したか", soon: true },
  { id: "calendar",  surface: "WP-UI-08", screen: "WP-SCR-08", route: "/calendar",       nav: "calendar",         title: "calendar",         question: "何が起き、次に何が起きるか",             soon: true }
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

/* 判断ホーム(WP-UI-01)内のsub-tab。判断＝行動 / 運転＝監視 / 成果＝結果 に分ける。 */
const HOME_TABS = [
  { id: "decide",  label: "判断待ち" },
  { id: "runtime", label: "運転と注意" },
  { id: "outcome", label: "成果" }
];

/* empty / failure / timeout照合 は判断pipelineの状態なので判断待ちtabが所有する。
   所有しないtabでは最新表示を維持したまま、状態の所在をscope-noteで示す。 */
const HOME_STATE_SCOPE = { empty: "decide", error: "decide", reconcile: "decide" };

const HOME_LOADING_NOTE = {
  decide:  "承認queueとWP状態を取得しています…",
  runtime: "運転状況と注意事項を取得しています…",
  outcome: "確定成果とコストを突合しています…"
};

/* --------------------------------------------------------------------------
   2. fixture — 判断（WP-UI-01）
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
    why: "cluster C-204 の全gateがgreen。WordPress下書き #1842 の再取得結果が、承認対象のcontent digestと一致している。",
    risk: { level: "low", label: "低", tone: "ok", reason: "新規投稿1件のみ。既存投稿の上書き・削除はなく、公開URL競合もない。" },
    due: { label: "承認期限 4時間", at: "2026-08-23 14:42 まで", note: "失効すると承認束縛が切れ、digest再確認からやり直す" },
    post: {
      id: 1842, status: "draft", modified: "2026-08-23 10:42:11",
      digest: "sha256:5ea1…93bd", approvalExpiry: "14:42",
      rollbackId: "RB-1842-02", operationId: "WP-OP-2026-0823-014",
      url: "https://solobiz-lab.com/?p=1842", slug: "hitori-kigyo-hajimekata"
    },
    cluster: "C-204",
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
    why: "cluster C-198 の構成gateは通過したが、事実provenanceのgateがredのため公開writeを実行できない。",
    risk: { level: "high", label: "高", tone: "danger", reason: "未検証の主張を含んだまま公開すると、事後の記事差し替えが必要になる。" },
    due: { label: "判断不可", at: "gate green化まで保留", note: "redが1件でも残る限り公開writeは0件（AC-S1-008）" },
    post: {
      id: 1839, status: "draft", modified: "2026-08-22 19:07:40",
      digest: "sha256:0c74…41af", approvalExpiry: "承認取得時に確定（取得後4時間）",
      rollbackId: "RB-1839-01", operationId: "WP-OP-2026-0822-031",
      url: "https://solobiz-lab.com/?p=1839", slug: "chiisana-jigyo-seo"
    },
    cluster: "C-198",
    redIndex: 3,
    evidence: [
      { id: "WP-EV-0404", label: "WP再取得 GET /posts/1839", at: "昨日 19:08" },
      { id: "WP-EV-0405", label: "事実provenance評価 · 未検証の主張 3件", at: "昨日 19:09" }
    ]
  }
];

/* --------------------------------------------------------------------------
   3. fixture — KW母集団の会計（WP-UI-02）

   母集団 1,000 KW は「記事へ割当 / 未割当 / 足切り / 取込失敗」の
   exactly one へ帰属する。lane合計は必ず母集団と一致させる。
   ------------------------------------------------------------------------ */

const KW_TOTAL = 1000;

const LANES = [
  { id: "assigned",   label: "記事へ割当", n: 612, sub: "24 cluster",                 tone: "ok",      icon: "▤" },
  { id: "unassigned", label: "未割当",     n: 148, sub: "cluster未確定・取得待ち",     tone: "warn",    icon: "…" },
  { id: "excluded",   label: "足切り",     n: 218, sub: "kw-filter v2.1 / policy v1.4", tone: "neutral", icon: "⊘" },
  { id: "failed",     label: "取込失敗",   n: 22,  sub: "重複・空欄・読取不可",         tone: "danger",  icon: "×" }
];

/* mapへ収録済みのcluster（10件 / 445 KW）。残り14 cluster・167 KWはmap未収録として
   会計行で明示する（612 = 445 + 167）。 */
const MAP_CLUSTERS_TOTAL = 24;
const MAP_KW_UNLISTED = 167;

const CLUSTERS = [
  {
    id: "C-204", article: "ひとり起業の始め方", kw: 62, flag: "decide",
    main: "ひとり起業 始め方", wp: "draft · #1842", updated: "10:42",
    gate: { label: "gate 7/7", tone: "ok" }, overlap: 72,
    dropped: { n: 6, why: "意図不一致 4 / volume下限 2" },
    snapshot: "2026-08-22 04:10 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0011",
    intents: [
      { label: "手順を知りたい", n: 24, kws: ["ひとり起業 始め方", "ひとり起業 やること"] },
      { label: "費用を知りたい", n: 14, kws: ["ひとり起業 費用", "ひとり起業 初期費用"] },
      { label: "資格・要件",     n: 12, kws: ["ひとり起業 資格", "ひとり起業 開業届"] },
      { label: "事例を見たい",   n: 12, kws: ["ひとり起業 事例", "ひとり起業 体験談"] }
    ],
    reasoning: [
      { ok: true, text: "上位10件のうち記事型が8件で、同一の検索意図に収束している", ref: "WP-EV-0410" },
      { ok: true, text: "PAA 4問を記事構成のH2へ割当済み（欠落0）", ref: "WP-EV-0412" }
    ]
  },
  {
    id: "C-198", article: "小さな事業のSEO設計", kw: 38, flag: "red",
    main: "小さな事業 SEO", wp: "draft · #1839", updated: "昨日 19:07",
    gate: { label: "gate 1 red", tone: "danger" }, overlap: 54,
    dropped: { n: 4, why: "意図不一致 3 / 季節切れ 1" },
    snapshot: "2026-08-22 04:10 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0011",
    intents: [
      { label: "設計手順",   n: 16, kws: ["小さな事業 SEO", "個人事業 SEO 設計"] },
      { label: "外注費用",   n: 12, kws: ["SEO 外注 費用", "SEO 依頼 相場"] },
      { label: "ツール比較", n: 10, kws: ["SEO ツール 個人", "SEO ツール 無料"] }
    ],
    reasoning: [
      { ok: true,  text: "SERP重複率が統合しきい値50%をわずかに上回る", ref: "WP-EV-0406" },
      { ok: false, text: "検索意図が「設計手順」と「外注費用」に二分している疑い", ref: "WP-EV-0407" }
    ]
  },
  {
    id: "C-211", article: "個人事業の固定費を減らす", kw: 44, flag: "running",
    main: "個人事業 固定費", wp: "未作成", updated: "10:31",
    gate: { label: "gate 解析中", tone: "neutral" }, overlap: 38,
    dropped: { n: 9, why: "volume下限 6 / 競合強度 3" },
    snapshot: "2026-08-23 03:00 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0012",
    intents: [
      { label: "削減方法", n: 18, kws: ["個人事業 固定費 削減", "固定費 見直し 個人事業"] },
      { label: "相場",     n: 14, kws: ["個人事業 固定費 平均", "フリーランス 固定費"] },
      { label: "経費計上", n: 12, kws: ["固定費 経費 計上", "家賃 経費 個人事業"] }
    ],
    reasoning: [
      { ok: true,  text: "SERP取得は完了。重複率はしきい値未満で分割候補", ref: "WP-EV-0430" },
      { ok: false, text: "PAA割当が未実行のため記事構成へ接続できていない", ref: "WP-EV-0431" }
    ]
  },
  {
    id: "C-186", article: "屋号と開業届の出し方", kw: 57, flag: "done",
    main: "開業届 書き方", wp: "publish · #1821", updated: "8月21日",
    gate: { label: "gate 7/7", tone: "ok" }, overlap: 68,
    dropped: { n: 5, why: "意図不一致 5" },
    snapshot: "2026-08-21 04:10 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0009",
    intents: [
      { label: "書き方",       n: 22, kws: ["開業届 書き方", "開業届 記入例"] },
      { label: "提出先・期限", n: 18, kws: ["開業届 提出期限", "開業届 提出先"] },
      { label: "屋号の決め方", n: 17, kws: ["屋号 決め方", "屋号 例"] }
    ],
    reasoning: [
      { ok: true, text: "上位10件中9件が同一の手続き解説型で、意図が単一に収束している", ref: "WP-EV-0391" },
      { ok: true, text: "PAA 5問すべてを記事構成へ割当済み", ref: "WP-EV-0392" }
    ]
  },
  {
    id: "C-177", article: "ひとり法人の社会保険", kw: 41, flag: "done",
    main: "ひとり法人 社会保険", wp: "publish · #1804", updated: "8月18日",
    gate: { label: "gate 7/7", tone: "ok" }, overlap: 63,
    dropped: { n: 3, why: "規制・YMYL 2 / 意図不一致 1" },
    snapshot: "2026-08-18 04:10 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0007",
    intents: [
      { label: "加入条件", n: 17, kws: ["ひとり法人 社会保険 加入", "一人社長 社会保険"] },
      { label: "保険料",   n: 14, kws: ["ひとり法人 社会保険料", "役員報酬 社会保険料"] },
      { label: "手続き",   n: 10, kws: ["社会保険 新規適用 手続き", "年金事務所 届出"] }
    ],
    reasoning: [
      { ok: true, text: "制度解説型が上位を占め、SERP重複率がしきい値を上回る", ref: "WP-EV-0380" },
      { ok: true, text: "YMYL隣接KW 2件は足切り規則で除外済み（記事へ混入なし）", ref: "WP-EV-0381" }
    ]
  },
  {
    id: "C-165", article: "ひとり起業の資金調達", kw: 53, flag: "running",
    main: "ひとり起業 資金調達", wp: "未作成", updated: "10:28",
    gate: { label: "gate 解析中", tone: "neutral" }, overlap: 41,
    dropped: { n: 7, why: "競合強度 5 / volume下限 2" },
    snapshot: "2026-08-23 03:00 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0012",
    intents: [
      { label: "融資",     n: 21, kws: ["ひとり起業 融資", "日本政策金融公庫 創業融資"] },
      { label: "補助金",   n: 18, kws: ["ひとり起業 補助金", "小規模事業者持続化補助金"] },
      { label: "自己資金", n: 14, kws: ["創業 自己資金 目安", "起業 貯金 いくら"] }
    ],
    reasoning: [
      { ok: true,  text: "SERPは取得済み。融資と補助金でSERPが分離しており分割候補", ref: "WP-EV-0432" },
      { ok: false, text: "検索volume・CPCが未取得のため戦場選定のソートが確定できない", ref: "WP-EV-0433" }
    ]
  },
  {
    id: "C-158", article: "個人事業の確定申告", kw: 66, flag: "done",
    main: "確定申告 個人事業", wp: "publish · #1795", updated: "8月15日",
    gate: { label: "gate 7/7", tone: "ok" }, overlap: 76,
    dropped: { n: 8, why: "意図不一致 5 / 季節切れ 3" },
    snapshot: "2026-08-15 04:10 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0006",
    intents: [
      { label: "申告手順", n: 26, kws: ["確定申告 個人事業 やり方", "確定申告 手順 個人"] },
      { label: "経費",     n: 22, kws: ["個人事業 経費 一覧", "経費 家事按分"] },
      { label: "青色申告", n: 18, kws: ["青色申告 承認申請", "青色申告 65万円 条件"] }
    ],
    reasoning: [
      { ok: true, text: "SERP重複率76%は統合しきい値を大きく上回る", ref: "WP-EV-0370" },
      { ok: true, text: "季節KW 3件は対象期間外として足切り済み", ref: "WP-EV-0371" }
    ]
  },
  {
    id: "C-149", article: "ひとりビジネスの集客導線", kw: 39, flag: "running",
    main: "ひとりビジネス 集客", wp: "未作成", updated: "10:25",
    gate: { label: "gate 解析中", tone: "neutral" }, overlap: 44,
    dropped: { n: 5, why: "意図不一致 4 / volume下限 1" },
    snapshot: "2026-08-23 03:00 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0012",
    intents: [
      { label: "SNS集客",  n: 15, kws: ["ひとりビジネス SNS 集客", "X 集客 個人事業"] },
      { label: "導線設計", n: 13, kws: ["集客 導線 設計", "LP 集客 個人"] },
      { label: "広告",     n: 11, kws: ["個人事業 広告 少額", "リスティング 個人 予算"] }
    ],
    reasoning: [
      { ok: true,  text: "SNS・広告でSERPが分離しており統合しきい値に届かない", ref: "WP-EV-0434" },
      { ok: false, text: "共通見出しの抽出が判定不能（対象URLの取得数が不足）", ref: "WP-EV-0435" }
    ]
  },
  {
    id: "C-142", article: "ひとり起業の失敗事例", kw: 25, flag: "done",
    main: "ひとり起業 失敗", wp: "publish · #1777", updated: "8月11日",
    gate: { label: "gate 7/7", tone: "ok" }, overlap: 58,
    dropped: { n: 2, why: "意図不一致 2" },
    snapshot: "2026-08-11 04:10 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0005",
    intents: [
      { label: "失敗理由", n: 13, kws: ["ひとり起業 失敗 理由", "個人事業 廃業 理由"] },
      { label: "撤退判断", n: 12, kws: ["個人事業 撤退 タイミング", "廃業届 出し方"] }
    ],
    reasoning: [
      { ok: true,  text: "体験談型が上位に集まり、意図は「事例を知る」に収束", ref: "WP-EV-0360" },
      { ok: false, text: "重複率58%はしきい値近傍のため境界ケースとして要注意", ref: "WP-EV-0361" }
    ]
  },
  {
    id: "C-133", article: "屋号入り銀行口座の作り方", kw: 20, flag: "done",
    main: "屋号 銀行口座", wp: "publish · #1762", updated: "8月7日",
    gate: { label: "gate 7/7", tone: "ok" }, overlap: 66,
    dropped: { n: 3, why: "volume下限 3" },
    snapshot: "2026-08-07 04:10 / JP / mobile / 上位10件",
    rule: "cluster-rules v3.2", event: "WP-EVT-0004",
    intents: [
      { label: "開設手順",   n: 11, kws: ["屋号 銀行口座 作り方", "屋号付き口座 開設"] },
      { label: "必要書類",   n: 9,  kws: ["屋号 口座 必要書類", "開業届 銀行口座"] }
    ],
    reasoning: [
      { ok: true, text: "手続き解説型が上位を占め、重複率がしきい値を上回る", ref: "WP-EV-0350" },
      { ok: true, text: "PAA 3問すべてを記事構成へ割当済み", ref: "WP-EV-0351" }
    ]
  }
];

/* 未割当 / 足切り / 取込失敗 の内訳。laneの合計と一致させる。 */
const LANE_DETAIL = {
  unassigned: {
    columns: ["未割当の理由", "件数", "判定した規則", "次の扱い"],
    rows: [
      ["cluster未確定（SERP重複率がしきい値±5%）", 54, "cluster-rules v3.2", "次回SERP snapshotで再判定"],
      ["SERP未取得（DataForSEO 重点KW枠外）",       62, "dfs-budget v1.0",    "週次バッチの取得待ち"],
      ["検索意図が判定不能",                        32, "intent-rules v1.3",  "人手確認queueへ（PO確認）"]
    ]
  },
  excluded: {
    columns: ["足切り理由", "件数", "判定した規則", "次の扱い"],
    rows: [
      ["検索意図がサイトコンセプトと不一致", 86, "kw-filter v2.1", "再取込しても同一規則で再度足切り"],
      ["検索volumeが下限（30/月）未満",      64, "kw-filter v2.1", "volume再取得時に再評価"],
      ["競合強度が上限（KD 60）超過",        41, "kw-filter v2.1", "資産が増えた段階で再評価"],
      ["季節切れ（対象期間外）",             15, "kw-filter v2.1", "対象期間に入ると自動復帰"],
      ["規制・YMYL領域として除外",           12, "policy v1.4",    "復帰しない（PO判断が必要）"]
    ]
  },
  failed: {
    columns: ["取込失敗の内容", "件数", "検出した工程", "次の扱い"],
    rows: [
      ["重複KW（先勝ち・警告記録）", 14, "ingest-design", "先勝ち分のみ有効。重複側は再取込対象外"],
      ["空欄KW行",                   6,  "ingest-design", "設計Excel側の修正が必要"],
      ["読み取り不可セル（結合セル）", 2, "ingest-design", "設計Excel側の修正が必要"]
    ]
  }
};

const FILTERS = [
  { id: "all",     label: "すべて",   test: () => true },
  { id: "decide",  label: "判断待ち", test: (c) => c.flag === "decide" },
  { id: "red",     label: "gate red", test: (c) => c.flag === "red" },
  { id: "running", label: "解析中",   test: (c) => c.flag === "running" },
  { id: "done",    label: "公開済み", test: (c) => c.flag === "done" }
];

/* --------------------------------------------------------------------------
   4. fixture — DataForSEO（fixture-only。APIは呼ばない）

   値が存在しない項目は null とし、画面では「未取得」と表示する。
   0や推定値で埋めない（WP-NFRL1-05 / 存在しない証跡を作らない）。
   ------------------------------------------------------------------------ */

const DFS_COMMON = {
  provider: "DataForSEO",
  queue: "standard queue（低頻度batch）",
  location: "Japan（location_code 2392）",
  language: "Japanese（ja）",
  device: "mobile / Android"
};

const DFS_BUDGET = {
  month: "2026年8月",
  spent: "$1.28", cap: "$5.00", pct: 26,
  calls: "1,842 call（重点KW 100件 × 週次 × 3 endpoint 相当）",
  stop: "上限到達前に取得を停止しPOへ通知する（WP-NFR-COST-01 / WP-AC-COST-01B）"
};

const DFS_TERMS =
  "DataForSEO利用規約・cache制約: 取得結果は解析目的のcacheとしてTTL 7日で保持し、再配布・第三者提供・SERP結果の転載を行わない。" +
  "取得条件（provider / location / language / device / 取得時刻）をprovenanceへ束縛する（WP-NFRL1-11 / WP-NFR-LEGAL-01）。";

const DFS_COVERAGE =
  "母集団 " + num(KW_TOTAL) + " KW のうち DataForSEO の取得対象は重点KW 100件（週次 / standard queue）。" +
  "取得対象外のKWは全項目「未取得」として扱い、0や推定値で埋めない。";

const DFS = {
  "ひとり起業 始め方": {
    cluster: "C-204",
    snapshot: "DFS-SNAP-20260822-0410-JP-01",
    fetchedAt: "2026-08-22 04:10:22 JST",
    fresh: { tone: "ok", label: "fresh", detail: "経過1日 · 期待間隔 7日（週次）" },
    window: "検索volume: 直近12か月平均（2025-08〜2026-07） / SERP・PAA: 2026-08-22 04:10 時点のsnapshot",
    cost: "$0.0010",
    cache: "3 endpoint中 1件が cache hit（TTL 7日 · 残り5日）",
    evidence: ["WP-POC-03", "WP-EV-0410"],
    endpoints: [
      { path: "serp/google/organic/task_get/advanced",        kind: "SERP上位 / PAA / AI Overview", at: "2026-08-22 04:10:22", cache: "miss（新規取得）",            cost: "$0.0006" },
      { path: "keywords_data/google_ads/search_volume/live",  kind: "検索volume / CPC / competition", at: "2026-08-22 04:11:05", cache: "hit（TTL 7日 · 残り5日）", cost: "$0.0000" },
      { path: "dataforseo_labs/google/related_keywords/live", kind: "関連KW",                        at: "2026-08-22 04:11:40", cache: "miss（新規取得）",            cost: "$0.0004" }
    ],
    metrics: {
      volume: { value: "1,300 / 月", kind: "estimated", note: "Google Ads由来の推定値。実測clickではない" },
      cpc:    { value: "$1.21",      kind: "estimated", note: "広告単価の推定値" },
      comp:   { value: "0.42",       kind: "estimated", note: "competition index（0–1）" },
      level:  { value: "MEDIUM",     kind: "estimated", note: "competition indexの区分" }
    },
    serp: [
      { rank: "—", type: "ai_overview", title: "AI Overview（生成要約 · 引用元3件）", url: "google.com/search 上の生成枠" },
      { rank: 1,   type: "organic",     title: "ひとり起業の始め方｜準備から開業届まで", url: "example-media.jp/hitori-kigyo/start" },
      { rank: 2,   type: "organic",     title: "個人で起業する手順を7ステップで解説",   url: "kigyo-guide.example.com/steps" },
      { rank: 3,   type: "organic",     title: "ひとり起業で失敗しないための準備",       url: "solo-biz.example.net/prep" },
      { rank: 4,   type: "video",       title: "【解説】ひとり起業の始め方",             url: "youtube.com/watch（動画枠）" }
    ],
    paa: [
      "ひとり起業に必要な資金はいくらですか",
      "ひとり起業で最初にやることは何ですか",
      "開業届はいつまでに出しますか",
      "ひとり起業に資格は必要ですか"
    ],
    related: [
      { term: "ひとり起業 やること",   volume: "880 / 月" },
      { term: "ひとり起業 費用",       volume: "590 / 月" },
      { term: "ひとり起業 資格",       volume: "320 / 月" }
    ]
  },

  "ひとり起業 費用": {
    cluster: "C-204",
    snapshot: "DFS-SNAP-20260822-0410-JP-02",
    fetchedAt: "2026-08-22 04:12:03 JST",
    fresh: { tone: "ok", label: "fresh", detail: "経過1日 · 期待間隔 7日（週次）" },
    window: "検索volume: 直近12か月平均（2025-08〜2026-07） / SERP・PAA: 2026-08-22 04:12 時点のsnapshot",
    cost: "$0.0000",
    cache: "全 endpoint が cache hit（TTL 7日 · 残り5日 · 追加課金なし）",
    evidence: ["WP-POC-03", "WP-EV-0411"],
    endpoints: [
      { path: "serp/google/organic/task_get/advanced",       kind: "SERP上位 / PAA",                at: "2026-08-22 04:12:03", cache: "hit（TTL 7日 · 残り5日）", cost: "$0.0000" },
      { path: "keywords_data/google_ads/search_volume/live", kind: "検索volume / CPC / competition", at: "2026-08-22 04:12:10", cache: "hit（TTL 7日 · 残り5日）", cost: "$0.0000" }
    ],
    metrics: {
      volume: { value: "590 / 月", kind: "estimated", note: "Google Ads由来の推定値" },
      cpc:    { value: "$0.94",    kind: "estimated", note: "広告単価の推定値" },
      comp:   { value: "0.37",     kind: "estimated", note: "competition index（0–1）" },
      level:  { value: "LOW",      kind: "estimated", note: "competition indexの区分" }
    },
    serp: [
      { rank: 1, type: "organic", title: "ひとり起業にかかる費用の内訳",   url: "example-media.jp/hitori-kigyo/cost" },
      { rank: 2, type: "organic", title: "起業の初期費用はいくら必要か",   url: "kigyo-guide.example.com/cost" },
      { rank: 3, type: "organic", title: "開業資金ゼロで始める方法",       url: "solo-biz.example.net/zero" }
    ],
    paa: [
      "ひとり起業の初期費用の平均はいくらですか",
      "開業資金がない場合はどうしますか"
    ],
    related: [
      { term: "ひとり起業 初期費用", volume: "260 / 月" },
      { term: "起業 費用 個人",      volume: "210 / 月" }
    ]
  },

  "小さな事業 SEO": {
    cluster: "C-198",
    snapshot: "DFS-SNAP-20260815-0410-JP-07",
    fetchedAt: "2026-08-15 04:10:44 JST",
    fresh: { tone: "warn", label: "stale", detail: "経過8日 · 期待間隔 7日 · 理由: SERP取得cronが2回連続失敗" },
    window: "検索volume: 直近12か月平均（2025-07〜2026-06） / SERP・PAA: 2026-08-15 04:10 時点のsnapshot",
    cost: "$0.0006",
    cache: "cache TTL 7日を超過（期限切れ）。再取得まで表示値はstale",
    evidence: ["WP-POC-03", "WP-EV-0406"],
    endpoints: [
      { path: "serp/google/organic/task_get/advanced",       kind: "SERP上位 / PAA",                at: "2026-08-15 04:10:44", cache: "miss（新規取得）", cost: "$0.0006" },
      { path: "keywords_data/google_ads/search_volume/live", kind: "検索volume / CPC / competition", at: "2026-08-15 04:11:02", cache: "miss（新規取得）", cost: "$0.0000" }
    ],
    metrics: {
      volume: { value: "480 / 月", kind: "estimated", note: "2026-08-15時点の推定値（stale）" },
      cpc:    { value: "$2.640",   kind: "estimated", note: "広告単価の推定値（stale）" },
      comp:   { value: "0.71",     kind: "estimated", note: "competition index（0–1）" },
      level:  { value: "HIGH",     kind: "estimated", note: "competition indexの区分" }
    },
    serp: [
      { rank: 1, type: "organic", title: "小さな会社のSEO設計ガイド",     url: "seo-lab.example.com/small-business" },
      { rank: 2, type: "organic", title: "個人事業主のためのSEO入門",     url: "example-media.jp/seo/solo" },
      { rank: 3, type: "organic", title: "SEO外注の費用相場と選び方",     url: "outsourcing.example.net/seo-cost" }
    ],
    paa: [
      "個人事業でもSEOは効果がありますか",
      "SEOの外注費用の相場はいくらですか",
      "SEOは自分でできますか"
    ],
    related: [
      { term: "個人事業 SEO 設計", volume: "170 / 月" },
      { term: "SEO 外注 費用",     volume: "390 / 月" }
    ]
  },

  "個人事業 固定費": {
    cluster: "C-211",
    snapshot: "DFS-SNAP-20260823-0300-JP-03",
    fetchedAt: "2026-08-23 03:00:51 JST",
    fresh: { tone: "ok", label: "fresh", detail: "経過0日 · 期待間隔 7日（週次）" },
    window: "検索volume: 直近12か月平均（2025-08〜2026-07） / SERP: 未取得",
    cost: "$0.0000",
    cache: "volume系のみ cache hit（TTL 7日 · 残り6日）。SERPはbatch未実行のため取得なし",
    evidence: ["WP-POC-03", "WP-EV-0430"],
    endpoints: [
      { path: "keywords_data/google_ads/search_volume/live", kind: "検索volume", at: "2026-08-23 03:00:51", cache: "hit（TTL 7日 · 残り6日）", cost: "$0.0000" }
    ],
    metrics: {
      volume: { value: "720 / 月", kind: "estimated", note: "Google Ads由来の推定値" },
      cpc:    { value: null,       kind: null, note: "同一responseにCPCが含まれていない（未取得）" },
      comp:   { value: null,       kind: null, note: "同一responseにcompetitionが含まれていない（未取得）" },
      level:  { value: null,       kind: null, note: "competition未取得のため区分も未取得" }
    },
    serp: null,
    paa: null,
    related: [
      { term: "固定費 見直し 個人事業", volume: "140 / 月" }
    ]
  },

  "開業届 書き方": {
    cluster: "C-186",
    snapshot: "DFS-SNAP-20260821-0410-JP-05",
    fetchedAt: "2026-08-21 04:10:19 JST",
    fresh: { tone: "ok", label: "fresh", detail: "経過2日 · 期待間隔 7日（週次）" },
    window: "検索volume: 直近12か月平均（2025-08〜2026-07） / SERP・PAA: 2026-08-21 04:10 時点のsnapshot",
    cost: "$0.0006",
    cache: "SERPは miss、volume系は hit（TTL 7日 · 残り4日）",
    evidence: ["WP-POC-03", "WP-EV-0391"],
    endpoints: [
      { path: "serp/google/organic/task_get/advanced",       kind: "SERP上位 / PAA / AI Overview",  at: "2026-08-21 04:10:19", cache: "miss（新規取得）",            cost: "$0.0006" },
      { path: "keywords_data/google_ads/search_volume/live", kind: "検索volume / CPC / competition", at: "2026-08-21 04:10:31", cache: "hit（TTL 7日 · 残り4日）", cost: "$0.0000" }
    ],
    metrics: {
      volume: { value: "2,900 / 月", kind: "estimated", note: "Google Ads由来の推定値" },
      cpc:    { value: "$0.58",      kind: "estimated", note: "広告単価の推定値" },
      comp:   { value: "0.28",       kind: "estimated", note: "competition index（0–1）" },
      level:  { value: "LOW",        kind: "estimated", note: "competition indexの区分" }
    },
    serp: [
      { rank: "—", type: "ai_overview", title: "AI Overview（生成要約 · 引用元2件）", url: "google.com/search 上の生成枠" },
      { rank: 1,   type: "organic",     title: "開業届の書き方と記入例",             url: "kaigyo.example.jp/todokede/write" },
      { rank: 2,   type: "organic",     title: "開業届の提出期限と提出先",           url: "example-media.jp/kaigyo/deadline" },
      { rank: 3,   type: "organic",     title: "屋号の決め方と注意点",               url: "yago.example.com/naming" }
    ],
    paa: [
      "開業届はいつまでに提出しますか",
      "開業届に屋号は必要ですか",
      "開業届を出さないとどうなりますか",
      "開業届はオンラインで出せますか",
      "開業届の控えは必要ですか"
    ],
    related: [
      { term: "開業届 記入例",   volume: "1,000 / 月" },
      { term: "開業届 提出期限", volume: "720 / 月" }
    ]
  },

  "確定申告 個人事業": {
    cluster: "C-158",
    snapshot: "DFS-SNAP-20260815-0410-JP-09",
    fetchedAt: "2026-08-15 04:10:58 JST",
    fresh: { tone: "warn", label: "stale", detail: "経過8日 · 期待間隔 7日 · 理由: SERP取得cronが2回連続失敗" },
    window: "検索volume: 直近12か月平均（2025-07〜2026-06） / SERP・PAA: 2026-08-15 04:10 時点のsnapshot",
    cost: "$0.0006",
    cache: "cache TTL 7日を超過（期限切れ）。再取得まで表示値はstale",
    evidence: ["WP-POC-03", "WP-EV-0370"],
    endpoints: [
      { path: "serp/google/organic/task_get/advanced",       kind: "SERP上位 / PAA / AI Overview",  at: "2026-08-15 04:10:58", cache: "miss（新規取得）", cost: "$0.0006" },
      { path: "keywords_data/google_ads/search_volume/live", kind: "検索volume / CPC / competition", at: "2026-08-15 04:11:12", cache: "miss（新規取得）", cost: "$0.0000" }
    ],
    metrics: {
      volume: { value: "8,100 / 月", kind: "estimated", note: "季節変動が大きい（推定値・stale）" },
      cpc:    { value: "$1.87",      kind: "estimated", note: "広告単価の推定値（stale）" },
      comp:   { value: "0.66",       kind: "estimated", note: "competition index（0–1）" },
      level:  { value: "HIGH",       kind: "estimated", note: "competition indexの区分" }
    },
    serp: [
      { rank: "—", type: "ai_overview", title: "AI Overview（生成要約 · 引用元4件）", url: "google.com/search 上の生成枠" },
      { rank: 1,   type: "organic",     title: "個人事業主の確定申告のやり方",       url: "tax-guide.example.jp/kojin" },
      { rank: 2,   type: "organic",     title: "青色申告と白色申告の違い",           url: "example-media.jp/tax/aoiro" },
      { rank: 3,   type: "organic",     title: "経費にできるもの一覧",               url: "keihi.example.com/list" }
    ],
    paa: [
      "個人事業主の確定申告はいくらから必要ですか",
      "青色申告の65万円控除の条件は何ですか",
      "経費にできるものは何ですか"
    ],
    related: [
      { term: "個人事業 経費 一覧", volume: "3,600 / 月" },
      { term: "青色申告 承認申請",  volume: "1,600 / 月" }
    ]
  },

  "ひとり起業 資金調達": {
    cluster: "C-165",
    snapshot: "DFS-SNAP-20260823-0300-JP-06",
    fetchedAt: "2026-08-23 03:02:14 JST",
    fresh: { tone: "ok", label: "fresh", detail: "経過0日 · 期待間隔 7日（週次）" },
    window: "SERP・PAA: 2026-08-23 03:02 時点のsnapshot / 検索volume: 未取得",
    cost: "$0.0006",
    cache: "SERPは miss（新規取得）。volume系はbatch未実行のため取得なし",
    evidence: ["WP-POC-03", "WP-EV-0432"],
    endpoints: [
      { path: "serp/google/organic/task_get/advanced", kind: "SERP上位 / PAA", at: "2026-08-23 03:02:14", cache: "miss（新規取得）", cost: "$0.0006" }
    ],
    metrics: {
      volume: { value: null, kind: null, note: "search_volume endpointが未実行（未取得）" },
      cpc:    { value: null, kind: null, note: "search_volume endpointが未実行（未取得）" },
      comp:   { value: null, kind: null, note: "search_volume endpointが未実行（未取得）" },
      level:  { value: null, kind: null, note: "competition未取得のため区分も未取得" }
    },
    serp: [
      { rank: 1, type: "organic", title: "創業融資の受け方と必要書類",   url: "yushi.example.jp/sogyo" },
      { rank: 2, type: "organic", title: "ひとり起業で使える補助金一覧", url: "hojokin.example.com/solo" },
      { rank: 3, type: "organic", title: "自己資金はいくら必要か",       url: "example-media.jp/fund/self" }
    ],
    paa: [
      "創業融資はいくらまで借りられますか",
      "自己資金なしでも融資は受けられますか"
    ],
    related: null
  }
};

/* DFSデータ一覧に載せるKW。取得済み7件・未取得5件を混在させ、
   未取得を0や推定で埋めないことを一覧上でも確認できるようにする。 */
const DFS_TABLE_KWS = CLUSTERS.map((c) => c.main).concat(["ひとり起業 費用", "開業届 提出期限"]);
const KNOWN_KWS = [...new Set(DFS_TABLE_KWS.concat(
  CLUSTERS.flatMap((cluster) => cluster.intents.map((intent) => intent.term))
))];

const dfsOf = (term) => DFS[term] || null;

const clusterByMain = (term) => CLUSTERS.find((c) => c.main === term) || null;

function clusterOfKw(term) {
  const rec = dfsOf(term);
  if (rec) { return clusterOf(rec.cluster); }
  const byMain = clusterByMain(term);
  if (byMain) { return byMain; }
  return CLUSTERS.find((c) => c.intents.some((i) => i.kws.indexOf(term) >= 0)) || null;
}

/* --------------------------------------------------------------------------
   5. fixture — 成果 / 状態文言
   ------------------------------------------------------------------------ */

const OUTCOMES = {
  ratio: "1.64×", target: "2.00×", progress: 82,
  months: [
    { m: "6月", v: "1.21×" },
    { m: "7月", v: "1.48×" },
    { m: "8月", v: "1.64×" }
  ],
  metrics: [
    { label: "表示回数",    value: "128,420", delta: "+12.4%",     tone: "up",      source: "GSC · 8月1–22日 · 取得 2日前" },
    { label: "AI露出KW",    value: "18",      delta: "+3",         tone: "up",      source: "AIO測定 · 8月22日 · 週次" },
    { label: "確定CV",      value: "42",      delta: "+8.1%",      tone: "up",      source: "A8確定成果 · 8月8日 · 推計を含まない" },
    { label: "売上÷コスト", value: "1.64×",   delta: "目標 2.00×", tone: "neutral", source: "確定売上 ÷ 実費 · 帰属不能分は除外" }
  ],
  revenue: [
    { label: "確定成果（A8）", value: "¥98,200" },
    { label: "確定成果（その他ASP）", value: "¥25,200" },
    { label: "合計売上", value: "¥123,400", total: true }
  ],
  cost: [
    { label: "LLM利用", value: "¥41,200" },
    { label: "外部API・SERP取得（DataForSEO $1.28 を含む）", value: "¥12,400" },
    { label: "人手確認（PO時間換算）", value: "¥21,600" },
    { label: "合計コスト", value: "¥75,200", total: true }
  ]
};

const STATE_COPY = {
  home: {
    freshness: {
      normal:    { tone: "ok",    icon: "✓", head: "WordPress 再取得 10:42:14", sub: "期間窓 直近24時間 · 期待間隔 5分 · 遅延なし" },
      stale:     { tone: "stale", icon: "!", head: "A8成果データ 15日前",        sub: "期間窓 8月1–8日 · 期待間隔 7日 · 理由: ASP側の集計遅延" },
      loading:   { tone: "ok",    icon: "⟳", head: "取得中",                     sub: "期間窓 直近24時間 · 期待間隔 5分" },
      empty:     { tone: "ok",    icon: "✓", head: "WordPress 再取得 10:42:14", sub: "期間窓 直近24時間 · 判断対象 0件" },
      error:     { tone: "error", icon: "×", head: "承認記録の書込みに失敗",      sub: "最終成功 10:42:14 · 外部writeは0件" },
      reconcile: { tone: "stale", icon: "?", head: "公開writeの結果が不明",       sub: "最終応答 timeout 11:03:07 · 自動再送しない" }
    },
    empty: {
      title: "いま判断が必要な項目はありません",
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
      title: "承認記録の書込みに失敗しました",
      lead: "失敗したstepは「承認記録」です。WordPressへのwriteは実行していません。post状態は変わっていません。",
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
      lead: "timeoutにより応答が不明です。同一要求の自動再送を行わず、idempotency keyとWP側の実測結果を照合します。"
    }
  },
  articles: {
    freshness: {
      normal:    { tone: "ok",    icon: "✓", head: "KW帰属の再計算 10:35",  sub: "期間窓 母集団 1,000 KW · 期待間隔 24時間" },
      stale:     { tone: "stale", icon: "!", head: "SERP snapshot 8日前",    sub: "期間窓 8月15日 · 期待間隔 7日 · 理由: DFS取得cronが2回連続失敗" },
      loading:   { tone: "ok",    icon: "⟳", head: "取得中",                 sub: "期間窓 母集団 1,000 KW" },
      empty:     { tone: "ok",    icon: "✓", head: "KW取込 未実施",          sub: "母集団 0件" },
      error:     { tone: "error", icon: "×", head: "KW帰属の導出に失敗",     sub: "最終成功 8月22日 10:35" },
      reconcile: { tone: "stale", icon: "?", head: "取込結果が二重の可能性", sub: "同一batchの応答が不明" }
    },
    empty: {
      title: "KW母集団がまだ取り込まれていません",
      lead: "帰属を表示するためのKW証跡がありません。取込が終わるまで、記事とKWの対応は導出できません。",
      facts: [
        ["証跡がない理由", "初回KW取込が未実行（source: サイト設計Excel + GSC）"],
        ["次回取得予定", "8月24日 03:00 GSC週次取得"],
        ["必要なPO action", "対象サイトと設計Excelの指定"],
        ["この画面が空である影響", "処理監査・公開判断はKW帰属に依存するため同様に0件"]
      ],
      actions: [["ホームへ戻る", "goto", "home"]]
    },
    error: {
      title: "KW帰属の導出に失敗しました",
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
      title: "監査対象のclusterがありません",
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
      title: "cluster判定を再現できませんでした",
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
      lead: "override記録要求がtimeoutしました。二重適用を避けるため自動再送せず、override keyで既存記録を照合します。"
    },
    loadingNote: "cluster判定の根拠を再現しています…"
  },
  outcomes: {
    freshness: {
      normal:    { tone: "ok",    icon: "✓", head: "確定成果 8月8日取得", sub: "期間窓 8月1–22日 · 期待間隔 7日 · 推計値は含まない" },
      stale:     { tone: "stale", icon: "!", head: "A8成果データ 15日前",  sub: "期間窓 8月1–8日 · 期待間隔 7日 · 理由: ASP側の確定処理待ち" },
      loading:   { tone: "ok",    icon: "⟳", head: "集計中",               sub: "期間窓 8月1–22日" },
      empty:     { tone: "ok",    icon: "✓", head: "確定成果 0件",         sub: "測定期間内に確定データなし" },
      error:     { tone: "error", icon: "×", head: "成果集計に失敗",       sub: "最終成功 8月8日" },
      reconcile: { tone: "stale", icon: "?", head: "成果取得の結果が不明", sub: "自動再送しない" }
    },
    empty: {
      title: "確定した成果がまだありません",
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
      title: "成果集計に失敗しました",
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
   6. 実行時state
   ------------------------------------------------------------------------ */

const ui = {
  view: "home",
  tab: HOME_TABS[0].id,     // 判断ホーム内のsub-tab。deep link `t=`
  state: "normal",
  decisionId: DECISIONS[0].id,
  clusterId: CLUSTERS[0].id,
  filter: "all",            // deep link `f=`（記事cluster状態）
  lane: LANES[0].id,        // deep link `l=`（KW会計lane）
  kwView: "map",            // deep link `v=`（map / dfs）
  kw: CLUSTERS[0].main,     // deep link `k=`（DataForSEO詳細の選択KW）
  completed: {},
  lastFocus: null,
  pendingReason: null
};

const surfaceOf = (id) => SURFACES.find((s) => s.id === id);
const decisionOf = (id) => DECISIONS.find((d) => d.id === id);
const clusterOf = (id) => CLUSTERS.find((c) => c.id === id);

/* --------------------------------------------------------------------------
   7. 共通component
   ------------------------------------------------------------------------ */

/* StateBadge契約: 色だけに依存せずlabelとiconを併記する */
function badge(text, tone, icon) {
  return '<span class="badge badge-' + tone + '"><span class="bi" aria-hidden="true">' + (icon || "•") + "</span>" + esc(text) + "</span>";
}

const toneIcon = (tone) => (tone === "ok" ? "✓" : tone === "danger" ? "×" : tone === "warn" ? "!" : "…");

function sectionHead(title, sub, right) {
  return '<div class="section"><div><h2>' + esc(title) + "</h2>" +
    (sub ? '<p class="sub">' + esc(sub) + "</p>" : "") + "</div>" + (right || "") + "</div>";
}

function stateFacts(rows) {
  return '<dl class="facts">' + rows.map((r) =>
    "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"
  ).join("") + "</dl>";
}

function stateActions(actions) {
  return '<div class="row-actions">' + actions.map((a, i) =>
    '<button type="button" class="btn ' + (i === 0 ? "btn-primary" : "btn-secondary") +
    '" data-act="' + a[1] + '" data-arg="' + esc(a[2]) + '">' + esc(a[0]) + "</button>"
  ).join("") + "</div>";
}

/* EmptyState: 証跡がない理由・次回取得予定・必要action */
function renderEmpty(viewId) {
  const c = STATE_COPY[viewId].empty;
  return '<section class="panel"><h2>' + esc(c.title) + "</h2><p class=\"lead\">" + esc(c.lead) + "</p>" +
    stateFacts(c.facts) + stateActions(c.actions) + "</section>";
}

/* ErrorState: failure step・evidence・retry/再入場owner */
function renderError(viewId) {
  const c = STATE_COPY[viewId].error;
  return '<section class="panel is-error"><h2>' + badge("failure", "danger", "×") + " " + esc(c.title) + "</h2>" +
    '<p class="lead">' + esc(c.lead) + "</p>" + stateFacts(c.facts) + stateActions(c.actions) + "</section>";
}

/* ReconciliationPanel: timeout・不明応答・重複候補の比較。自動再送を禁止する */
function renderReconcile(viewId) {
  const c = STATE_COPY[viewId].reconcile;
  const r = RECONCILE[viewId];
  const col = (title, rows) => '<div class="recon-col"><h3>' + esc(title) + "</h3><dl>" +
    rows.map((row) => "<div><dt>" + esc(row[0]) + "</dt><dd" + (row[2] ? ' class="mismatch"' : "") + ">" + esc(row[1]) + "</dd></div>").join("") +
    "</dl></div>";

  return '<section class="panel is-warn"><h2>' + badge("timeout照合", "warn", "?") + " " + esc(c.title) + "</h2>" +
    '<p class="lead">' + esc(c.lead) + "</p>" +
    '<p class="mono-note"><code>' + esc(r.key) + "</code></p>" +
    '<div class="recon-compare">' + col("要求した内容", r.expected) + col("WP / 外部側の実測", r.observed) + "</div>" +
    '<p class="hard-note"><b>自動再送は行いません。</b>' + esc(r.duplicates) +
    " 結果が一意に確認できない場合はPO判断queueへ送ります（<strong>reconciliation_required</strong>）。</p>" +
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

  const homeShapes = {
    decide:
      '<div class="sk-2col"><div class="sk-stack">' +
        skCard(["w40", "w80", "w60"]) + skCard(["w40", "w80", "w60"]) + "</div>" +
        skCard(["w40", "w80"], 240) + "</div>",
    runtime:
      '<div class="runtime-strip">' + [0, 0, 0, 0, 0].map(() =>
        '<div class="runtime-cell">' + skCard(["w60", "w80"]) + "</div>").join("") + "</div>" +
      '<div class="notes" style="margin-top:18px">' + skCard(["w60", "w80"]) + skCard(["w60", "w80"]) + "</div>",
    outcome:
      skCard(["w40"], 100) + '<div style="margin-top:12px">' + metricsSk + "</div>"
  };

  const homeTab = homeShapes[sub] ? sub : HOME_TABS[0].id;
  const note = viewId === "home" ? HOME_LOADING_NOTE[homeTab] : STATE_COPY[viewId].loadingNote;

  const shapes = {
    home: homeShapes[homeTab],
    articles:
      skCard(["w40", "w80"], 54) +
      '<div class="cmap-grid" style="margin-top:12px">' + skCard(["w60", "w80", "w80", "w40"]) + skCard(["w60", "w80", "w80", "w40"]) + "</div>",
    audit:
      '<div class="audit-layout"><div class="col-list">' + skCard(["w60", "w80"]) + skCard(["w60", "w80"]) + "</div>" +
      skCard(["w40", "w80"], 260) + "</div>",
    outcomes:
      skCard(["w40"], 100) + '<div style="margin-top:12px">' + metricsSk + "</div>"
  };

  return '<div class="loading-note"><span class="spinner" aria-hidden="true"></span><span>' + esc(note) + "</span></div>" +
    '<div class="skeleton-grid" aria-hidden="true">' + shapes[viewId] + "</div>";
}

function staleBanner(text, impact) {
  return '<div class="banner"><span class="b-mark" aria-hidden="true">!</span><span><b>stale: ' + esc(text) + "</b> " + esc(impact) + "</span></div>";
}

/* --------------------------------------------------------------------------
   8. ホーム (WP-UI-01)
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

  if (state === "stale")     { cells[4].sub = "GSC週次取得 · 前回は15日前"; }
  if (state === "empty")     { cells[1].dd = "0"; cells[1].sub = "直近24時間の判断は完了済み"; cells[1].tone = ""; }
  if (state === "error")     { cells[3].dd = "1"; cells[3].sub = "承認記録step · 外部write 0件"; cells[3].tone = "is-bad"; }
  if (state === "reconcile") { cells[1].sub = "うち照合待ち 1件（自動再送なし）"; }

  return '<dl class="runtime-strip">' + cells.map((c) =>
    '<div class="runtime-cell ' + (c.tone || "") + '"><dt>' + esc(c.dt) + "</dt><dd>" + esc(c.dd) +
    "<small>" + esc(c.sub) + "</small>" +
    (c.to ? '<button type="button" class="linkbtn" data-act="home-tab" data-arg="' + c.to + '">判断待ちを開く →</button>' : "") +
    "</dd></div>").join("") + "</dl>";
}

function queueItem(d) {
  const done = Boolean(ui.completed[d.id]);
  const blocked = d.redIndex > 0;
  const green = blocked ? 6 : 7;
  return '<button type="button" class="q-item' + (blocked ? " is-blocked" : "") + '" data-act="select-decision" data-arg="' + d.id +
    '" aria-pressed="' + (ui.decisionId === d.id) + '">' +
    "<h3>" + esc(d.title) + "</h3>" +
    '<span class="q-meta"><span>' + (done ? "公開済み" : "gate " + green + "/7") + "</span><span>post #" + d.post.id +
    "</span><span>risk " + esc(d.risk.label) + "</span><span>" + esc(d.due.label) + "</span></span></button>";
}

function decisionResult(d) {
  const r = ui.completed[d.id];
  return '<section class="card card-pad is-ok">' +
    "<h3>✓ 公開まで完了しました — operation ID <code>" + esc(r.operationId) + "</code></h3>" +
    '<p class="lead">この結果はprototype上の表示遷移です。実際のWordPressへは書き込んでいません。</p>' +
    '<ol class="steps-done">' + r.steps.map((s) =>
      "<li><strong>" + esc(s[0]) + "</strong><span>" + s[1] + "</span></li>").join("") + "</ol>" +
    '<div class="row-actions"><span class="hint">rollback ' + esc(d.post.rollbackId) +
    ' は公開後24時間有効です。</span><button type="button" class="btn btn-secondary" data-act="evidence" data-arg="' + d.id +
    '">証跡を見る</button><button type="button" class="btn btn-secondary" data-act="reset-decision" data-arg="' + d.id +
    '">初期状態へ戻す</button></div></section>';
}

function decisionCard(d, stale) {
  if (ui.completed[d.id]) { return decisionResult(d); }

  const blocked = d.redIndex > 0;
  const green = blocked ? 6 : 7;

  const facts = [
    ["post ID / status", "#" + d.post.id + " · " + d.post.status],
    ["content digest", d.post.digest],
    ["modified（WP再取得）", d.post.modified],
    ["rollback", d.post.rollbackId + " · 同一post IDをdraftへ復帰"],
    ["risk " + d.risk.label, d.risk.reason],
    ["期限", d.due.at + " · " + d.due.note]
  ];

  return '<article class="card card-pad decision">' +
    "<h2>" + esc(d.title) + "</h2>" +
    '<p class="d-line">' + badge("gate " + green + "/7", blocked ? "danger" : "ok", blocked ? "×" : "✓") +
      "<span>risk " + esc(d.risk.label) + " · " + esc(d.due.label) + "</span></p>" +
    '<p class="lead">' + esc(d.why) + "</p>" +
    stateFacts(facts) +

    '<div class="gate-line' + (blocked ? " is-blocked" : "") + '">' +
      "<span>" + (blocked
        ? "公開可能条件に red が1件あります。red が残る限り公開writeは0件（AC-S1-008）。"
        : "公開可能条件は7件すべてgreen。site / post ID / modified / digest がWP再取得結果と一致。") + "</span>" +
      '<button type="button" class="btn btn-secondary btn-sm" data-act="open-publish" data-arg="' + d.id + '">条件7件を確認</button>' +
    "</div>" +

    '<ul class="ev-list">' + d.evidence.slice(0, 2).map((e) =>
      "<li><code>" + esc(e.id) + "</code><span>" + esc(e.label) + "</span><time>" + esc(e.at) + "</time></li>").join("") +
      '<li class="ev-more"><button type="button" class="linkbtn" data-act="evidence" data-arg="' + d.id +
      '">証跡 ' + d.evidence.length + " 件をすべて見る →</button></li></ul>" +

    '<div class="row-actions">' +
      '<span class="hint">' + (blocked
        ? "承認できません。差し戻して事実sourceの補完を依頼します。外部writeは0件のままです。"
        : (stale
          ? "成果データはstaleですが、公開条件はWP再取得結果に依存するため判断は可能です。"
          : "承認は post #" + d.post.id + " / digest " + d.post.digest + " へ束縛されます。")) + "</span>" +
      '<button type="button" class="btn btn-secondary" data-act="open-return" data-arg="' + d.id + '">差し戻す</button>' +
      '<button type="button" class="btn btn-primary" data-act="open-publish" data-arg="' + d.id + '"' + (blocked ? " disabled" : "") + ">" +
      (blocked ? "承認不可（red 1件）" : "内容を確認して承認") + "</button>" +
    "</div></article>";
}

/* 注意領域は承認対象ではない。tone !== "ok" の件数が「運転と注意」tabのbadgeになる。 */
function homeAlerts(state) {
  if (state === "error") {
    return [{ tone: "danger", title: "承認記録の書込みに失敗しています",
      body: "失敗stepは approval_record_write。WordPressへのwriteは0件で post #1842 は draft のまま。判断待ちタブで WP-EV-0429 を確認し、digest再確認から再入場します。",
      act: "判断待ちへ", to: "tab:decide" }];
  }
  if (state === "reconcile") {
    return [{ tone: "warn", title: "公開writeの結果が照合待ちです",
      body: "idempotency key IK-1842-publish-7f31 の応答が timeout。自動再送はせず、判断待ちタブでWP側実測と照合します。",
      act: "判断待ちへ", to: "tab:decide" }];
  }
  if (state === "empty") {
    return [{ tone: "ok", title: "判断待ちは0件です",
      body: "直近24時間の判断は全て完了（最後: WP-OP-2026-0822-031 · 8月22日 19:12）。次回取得は8月24日 03:00 GSC週次。",
      act: "判断待ちへ", to: "tab:decide" }];
  }
  if (state === "stale") {
    return [
      { tone: "warn", title: "A8成果データがstaleです",
        body: "最終取得から15日経過（期待間隔7日 · ASP側の確定処理待ち）。公開判断への影響はありません。",
        act: "成果へ", to: "tab:outcome" },
      { tone: "warn", title: "DataForSEO SERP snapshotが8日前です",
        body: "取得cronが2回連続失敗。gate判定は前回snapshot基準のため、公開承認前に再取得が必要です。",
        act: "記事・KWへ", to: "articles" }
    ];
  }
  return [
    { tone: "warn", title: "cluster C-198 の判定が要確認です",
      body: "SERP重複率54%はしきい値をわずかに上回るのみ。検索意図が二分している疑い。処理監査でoverride判断が必要です。",
      act: "監査へ", to: "audit" },
    { tone: "ok", title: "提携切れリンクはありません",
      body: "126リンクを8月22日に照合済み。終了プログラム0件。次回照合は8月29日。",
      act: "", to: "" }
  ];
}

const attentionCount = (state) => homeAlerts(state).filter((a) => a.tone !== "ok").length;

function alertRows(state) {
  return '<ul class="notes">' + homeAlerts(state).map((a) => {
    const tab = a.to.indexOf("tab:") === 0;
    const arg = tab ? a.to.slice(4) : a.to;
    return '<li class="note note-' + a.tone + '"><span class="n-mark" aria-hidden="true">' + toneIcon(a.tone) + "</span>" +
      "<div><strong>" + esc(a.title) + "</strong><p>" + esc(a.body) + "</p>" +
      (a.act ? '<button type="button" class="linkbtn" data-act="' + (tab ? "home-tab" : "goto") + '" data-arg="' + esc(arg) + '">' +
        esc(a.act) + " →</button>" : "") + "</div></li>";
  }).join("") + "</ul>";
}

/* sub-tabのbadge。色に依存しないよう icon と読み上げ用テキストを必ず併せて返す。 */
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
  return '<div class="subtabs" role="tablist" aria-label="判断ホーム内の区分">' +
    HOME_TABS.map((t) => {
      const on = t.id === ui.tab;
      const st = homeTabStatus(t.id, state);
      return '<button type="button" role="tab" class="subtab" id="home-tab-' + t.id + '" data-tab="' + t.id +
        '" aria-selected="' + on + '" aria-controls="home-panel" tabindex="' + (on ? "0" : "-1") +
        '" aria-label="' + esc(t.label + "、" + st.sr) + '">' + esc(t.label) +
        '<span class="badge badge-' + st.tone + '" aria-hidden="true"><span class="bi">' + st.icon + "</span>" + esc(st.text) + "</span>" +
        "</button>";
    }).join("") + "</div>";
}

/* 状態を所有しないtabで、状態の所在と「この表示は最新である」ことを明示する */
function scopeNote(state) {
  const owner = HOME_TABS.find((t) => t.id === HOME_STATE_SCOPE[state]);
  const copy = {
    empty:     ["neutral", "判断待ちが0件です。運転は継続しています。"],
    error:     ["danger",  "承認記録の書込みに失敗しています（WordPressへのwriteは0件）。"],
    reconcile: ["warn",    "公開writeの結果が照合待ちです（自動再送は行いません）。"]
  }[state];

  return '<div class="scope-note">' +
    badge(STATES.find((s) => s.id === state).label, copy[0], toneIcon(copy[0])) +
    "<span>" + esc(copy[1]) + "この状態は「" + esc(owner.label) + "」が対象です。このタブの表示は最新です。</span>" +
    '<button type="button" class="btn btn-secondary btn-sm" data-act="home-tab" data-arg="' + owner.id + '">' +
    esc(owner.label) + "を開く</button></div>";
}

/* tab 1: 判断待ち */
function renderHomeDecide(state) {
  const stale = state === "stale";
  const attn = attentionCount(state);

  return (stale ? staleBanner("A8成果データが15日前（期待間隔7日）",
      "判断への影響はありません。公開可能条件はWordPress再取得結果（10:42:14）に依存します。") : "") +
    sectionHead("いま判断が必要なもの") +
    '<div class="two-col">' +
      '<div class="col-list">' + DECISIONS.map(queueItem).join("") +
        '<p class="col-note">承認・差し戻しは選択中の1件にのみ実行されます。</p></div>' +
      '<div class="col-detail">' + decisionCard(decisionOf(ui.decisionId), stale) + "</div>" +
    "</div>" +
    '<p class="handoff">承認対象ではない要確認 ' + attn + ' 件と運転状況は' +
    '<button type="button" class="linkbtn" data-act="home-tab" data-arg="runtime">運転と注意 →</button></p>';
}

/* tab 2: 運転と注意 */
function renderHomeRuntime(state) {
  const stale = state === "stale";
  return (stale ? staleBanner("A8成果データが15日前（期待間隔7日）",
      "古いのは成果データのみで、WP状態と公開可能条件は10:42:14時点で最新です。") : "") +
    sectionHead("運転状況") +
    runtimeStrip(state) +
    sectionHead("確認しておくこと", "承認対象ではありません。") +
    alertRows(state);
}

/* tab 3: 成果 */
function renderHomeOutcome(state) {
  const stale = state === "stale";
  return (stale ? staleBanner("A8成果データが15日前（期待間隔7日）",
      "確定CVと売上は8月8日時点です。L1成功基準の現在値は暫定です。") : "") +
    sectionHead("今月の成果", "確定値のみ。",
      '<button type="button" class="linkbtn" data-act="goto" data-arg="outcomes">成果を詳しく見る →</button>') +
    goalCard() +
    '<div class="metrics" style="margin-top:12px">' + metricTiles() + "</div>";
}

function goalCard() {
  return '<div class="card card-pad goal">' +
    "<div><p class=\"g-label\">L1成功基準: 売上 ÷ 運用コスト</p>" +
    '<p class="g-figure"><strong>' + esc(OUTCOMES.ratio) + "</strong><span>/ 目標 " + esc(OUTCOMES.target) + " を3か月連続</span></p>" +
    '<div class="meter"><i style="width:' + OUTCOMES.progress + '%"></i></div>' +
    '<p class="g-note">確定売上 ¥123,400 ÷ 実費 ¥75,200。推計値と帰属不能な成果は含みません。</p></div>' +
    '<div class="months">' + OUTCOMES.months.map((m) =>
      "<div><small>" + esc(m.m) + "</small><strong>" + esc(m.v) + "</strong></div>").join("") + "</div></div>";
}

function metricTiles() {
  return OUTCOMES.metrics.map((m) =>
    '<article class="metric"><span class="m-label">' + esc(m.label) + '</span><strong class="m-value">' + esc(m.value) +
    '</strong><span class="m-delta ' + (m.tone === "neutral" ? "neutral" : "") + '">' + esc(m.delta) +
    '</span><span class="m-source">' + esc(m.source) + "</span></article>").join("");
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
    const owned = { empty: renderEmpty, error: renderError, reconcile: renderReconcile };
    panel = owned[state]("home");
  } else {
    panel = (owner ? scopeNote(state) : "") + HOME_PANELS[tab](state);
  }

  return renderHomeTabs(state) +
    '<div class="home-panel" id="home-panel" role="tabpanel" aria-labelledby="home-tab-' + tab + '">' + panel + "</div>";
}

/* --------------------------------------------------------------------------
   9. 記事・KW (WP-UI-02) — キーワードマップ / DataForSEOデータ
   ------------------------------------------------------------------------ */

const laneOf = (id) => LANES.find((l) => l.id === id) || LANES[0];
const laneSum = () => LANES.reduce((s, l) => s + l.n, 0);
const mapKwListed = () => CLUSTERS.reduce((s, c) => s + c.kw, 0);
const kwLedger = () => {
  let sequence = 0;
  return LANES.flatMap((lane) => Array.from({ length: lane.n }, () => ({
    id: "KW-" + String(++sequence).padStart(4, "0"),
    lane: lane.id
  })));
};

/* 母集団の会計。lane合計 = 母集団 であることを常時表示する。 */
function kwAccounting() {
  const sum = laneSum();
  const ledger = kwLedger();
  const identities = ledger.map((entry) => entry.id);
  const uniqueIdentities = new Set(identities);
  const duplicates = identities.length - uniqueIdentities.size;
  const orphans = Math.max(0, KW_TOTAL - uniqueIdentities.size);
  const balanced = sum === KW_TOTAL && ledger.length === KW_TOTAL && duplicates === 0 && orphans === 0;
  const label = LANES.map((l) => l.label + " " + l.n + "件").join("、");
  return '<section class="card card-pad account">' +
    '<div class="account-head"><h2>KW母集団 ' + num(KW_TOTAL) + " 件の会計</h2>" +
    "<p>全KWは4 laneの<b>ちょうど1つ</b>に属します。</p></div>" +
    '<div class="account-bar" role="img" aria-label="' + esc(label) + '">' +
    LANES.map((l) => '<span class="seg seg-' + l.id + '" style="width:' + (l.n / KW_TOTAL * 100) + '%"></span>').join("") + "</div>" +
    '<div class="lanes" role="group" aria-label="KW帰属laneの選択">' + LANES.map((l) => {
      const on = l.id === ui.lane;
      return '<button type="button" class="lane lane-' + l.id + '" data-act="lane" data-arg="' + l.id +
        '" aria-pressed="' + on + '" aria-label="' + esc(l.label + " " + l.n + "件。" + l.sub) + '">' +
        '<span class="lane-label"><span class="lane-mark" aria-hidden="true">' + l.icon + "</span>" + esc(l.label) + "</span>" +
        '<strong class="lane-n">' + num(l.n) + "</strong>" +
        '<span class="lane-sub">' + esc(l.sub) + "</span></button>";
    }).join("") + "</div>" +
    '<p class="account-check">' + LANES.map((l) => num(l.n)).join(" ＋ ") + " ＝ " + num(sum) +
    (balanced ? "（ID台帳と一致）" : "（不整合あり）") + " · 孤児KW <b>" + num(orphans) +
    "件</b> · 二重計上 " + num(duplicates) + "件</p>" +
    "</section>";
}

/* 記事・KW画面の表示切替（キーワードマップ / DataForSEOデータ） */
function kwViewSwitch() {
  const tabs = [
    { id: "map", label: "キーワードマップ", sr: "記事clusterを主役にKWの帰属を追う" },
    { id: "dfs", label: "DataForSEOデータ", sr: "取得条件つきのKW指標を確認する" }
  ];
  return '<div class="subtabs kwtabs" role="tablist" aria-label="記事・KWの表示">' + tabs.map((t) => {
    const on = t.id === ui.kwView;
    return '<button type="button" role="tab" class="subtab kwtab" data-kwview="' + t.id +
      '" aria-selected="' + on + '" aria-controls="kw-panel" tabindex="' + (on ? "0" : "-1") +
      '" aria-label="' + esc(t.label + "。" + t.sr) + '">' + esc(t.label) + "</button>";
  }).join("") + "</div>";
}

function kwChip(term) {
  const has = Boolean(dfsOf(term));
  return '<button type="button" class="kwchip' + (has ? "" : " is-unknown") + '" data-act="kw" data-arg="' + esc(term) +
    '" aria-label="' + esc(term + " の DataForSEOデータを開く" + (has ? "" : "（未取得）")) + '">' + esc(term) +
    (has ? "" : '<span class="kc-mark" aria-hidden="true">未取得</span>') + "</button>";
}

/* cluster card = 記事を中心にした「意図lane × KW」のtree */
function clusterCard(c) {
  const rec = dfsOf(c.main);
  const vol = rec && rec.metrics.volume.value
    ? '<span class="vol">' + esc(rec.metrics.volume.value) + '<small>DFS推定</small></span>'
    : '<span class="vol is-unknown">検索volume 未取得</span>';

  return '<article class="cmap' + (c.id === ui.clusterId ? " is-current" : "") + '">' +
    '<header class="cmap-head"><div><span class="cid">' + esc(c.id) + "</span>" +
    "<h3>" + esc(c.article) + "</h3></div>" +
    badge(c.gate.label, c.gate.tone, toneIcon(c.gate.tone)) + "</header>" +

    '<p class="cmap-main"><span class="mk">main</span>' + kwChip(c.main) + vol + "</p>" +

    '<ul class="itree">' + c.intents.map((i) => {
      const rest = i.n - i.kws.length;
      return '<li><span class="i-label">' + esc(i.label) + '</span><span class="i-n">' + i.n + "</span>" +
        '<span class="i-kws">' + i.kws.map(kwChip).join("") +
        (rest > 0 ? '<span class="kwrest">+' + rest + "</span>" : "") + "</span></li>";
    }).join("") + "</ul>" +

    '<p class="cmap-foot">KW <b>' + c.kw + "</b> 件（main 1 + sub " + (c.kw - 1) + "） · WP " + esc(c.wp) +
    " · 更新 " + esc(c.updated) + "<br>この記事から外したKW " + c.dropped.n + " 件（" + esc(c.dropped.why) +
    "）— 足切りlane " + LANES[2].n + " 件の内数</p>" +

    '<div class="cmap-acts">' +
    '<button type="button" class="linkbtn" data-act="goto-cluster" data-arg="' + c.id + '">処理監査で根拠を見る →</button>' +
    '<button type="button" class="linkbtn" data-act="kw" data-arg="' + esc(c.main) + '">main KWのDataForSEOデータ →</button>' +
    "</div></article>";
}

/* map集計とfilterの関係を明示する。表示中 → lane合計 → 母集団 を1行で結ぶ。 */
function mapRelation(shown) {
  const listed = mapKwListed();
  const shownKw = shown.reduce((s, c) => s + c.kw, 0);
  const active = FILTERS.find((f) => f.id === ui.filter) || FILTERS[0];
  return '<p class="relation">記事へ割当 ' + num(LANES[0].n) + " ＝ map収録 " + num(listed) +
    "（" + CLUSTERS.length + " cluster）＋ map未収録 " + num(MAP_KW_UNLISTED) +
    "（" + (MAP_CLUSTERS_TOTAL - CLUSTERS.length) + " cluster）。" +
    "filter「" + esc(active.label) + "」: <b>表示 " + shown.length + " cluster / " + num(shownKw) + " KW</b>。</p>";
}

function laneTable(laneId) {
  const l = laneOf(laneId);
  const d = LANE_DETAIL[laneId];
  const sum = d.rows.reduce((s, r) => s + r[1], 0);
  const head = "<thead><tr>" + d.columns.map((c, i) =>
    '<th' + (i === 1 ? ' class="num"' : "") + ">" + esc(c) + "</th>").join("") + "</tr></thead>";
  const body = "<tbody>" + d.rows.map((r) =>
    "<tr><td>" + esc(r[0]) + '</td><td class="num">' + r[1] + "</td><td><code>" + esc(r[2]) + "</code></td><td>" + esc(r[3]) + "</td></tr>").join("") + "</tbody>";

  return '<p class="relation">母集団 ' + num(KW_TOTAL) + " のうち「" + esc(l.label) + "」lane は " + num(l.n) +
    " 件。内訳の合計 " + num(sum) + " 件と一致します（このlaneのKWは記事へ帰属しません）。</p>" +
    '<div class="table-card"><div class="table-scroll"><table><caption class="sr-only">' + esc(l.label) + "の内訳</caption>" +
    head + body + "</table></div></div>" +
    '<div class="only-mobile">' + d.rows.map((r) =>
      '<div class="m-card"><div class="m-card-head"><strong>' + esc(r[0]) + "</strong><b>" + r[1] + "件</b></div>" +
      "<dl><div><dt>判定した規則</dt><dd>" + esc(r[2]) + "</dd></div><div><dt>次の扱い</dt><dd>" + esc(r[3]) + "</dd></div></dl></div>").join("") + "</div>";
}

function kwMapBody() {
  if (ui.lane !== "assigned") { return laneTable(ui.lane); }

  const active = FILTERS.find((f) => f.id === ui.filter) || FILTERS[0];
  const shown = CLUSTERS.filter(active.test);

  const chips = '<div class="chips">' + FILTERS.map((f) => {
    const n = CLUSTERS.filter(f.test).length;
    return '<button type="button" class="chip" data-act="filter" data-arg="' + f.id + '" aria-pressed="' + (f.id === ui.filter) + '">' +
      esc(f.label) + '<span class="c-count">' + n + "</span></button>";
  }).join("") + "</div>";

  const cards = shown.length === 0
    ? '<div class="card card-pad center">この条件に一致する記事clusterはありません。' +
      '<button type="button" class="linkbtn" data-act="filter" data-arg="all">すべてに戻す</button></div>'
    : '<div class="cmap-grid">' + shown.map(clusterCard).join("") + "</div>";

  return sectionHead("記事cluster", "KWを選ぶとDataForSEO詳細が開きます。", chips) +
    mapRelation(shown) + cards;
}

/* --- DataForSEO surface ------------------------------------------------- */

const unknownTag = '<span class="unknown">未取得</span>';

function dfsMetricTile(label, m) {
  const has = m && m.value;
  return '<div class="dfs-metric' + (has ? "" : " is-unknown") + '"><dt>' + esc(label) + "</dt>" +
    "<dd>" + (has ? esc(m.value) : unknownTag) + "</dd>" +
    '<p class="dm-kind">' + (has ? badge(m.kind === "estimated" ? "estimated（推定）" : "実測", m.kind === "estimated" ? "neutral" : "info", m.kind === "estimated" ? "≈" : "◉") : "") +
    "</p><small>" + esc(m.note) + "</small></div>";
}

/* KW詳細。map（dialog）とDataForSEOデータ一覧（inline）で同じ描画を使う。 */
function dfsDetail(term) {
  const rec = dfsOf(term);
  const cluster = clusterOfKw(term);
  const clusterLine = cluster
    ? '<button type="button" class="linkbtn" data-act="goto-cluster" data-arg="' + cluster.id +
      '">' + esc(cluster.id + " / " + cluster.article) + " の処理監査へ →</button>"
    : "<span>cluster未確定</span>";

  const head = '<div class="dfs-head"><div><p class="dfs-kw">' + esc(term) + "</p>" +
    '<p class="dfs-sub">' + badge("provider: DataForSEO", "info", "◉") +
    (rec ? badge(rec.fresh.label, rec.fresh.tone === "ok" ? "ok" : "warn", rec.fresh.tone === "ok" ? "✓" : "!")
         : badge("未取得", "neutral", "◇")) + "</p></div>" + clusterLine + "</div>";

  const limits = '<p class="dfs-terms">' + esc(DFS_TERMS) + "</p>" +
    '<p class="dfs-terms">費用: ' + esc(DFS_BUDGET.month) + " 実測 <b>" + esc(DFS_BUDGET.spent) + "</b> / 上限 <b>" +
    esc(DFS_BUDGET.cap) + "</b>（" + DFS_BUDGET.pct + "% · " + esc(DFS_BUDGET.calls) + "）。" + esc(DFS_BUDGET.stop) + "</p>" +
    '<p class="dfs-terms is-fixture">このprototypeはfixture表示です。DataForSEO APIへの接続・課金・credential保持は行いません。</p>';

  if (!rec) {
    return head +
      '<div class="panel is-inline"><h3>DataForSEO 未取得のKWです</h3>' +
      '<p class="lead">取得対象（重点KW 100件 / 週次）の枠外のため、このKWのDataForSEOデータは存在しません。' +
      "存在しない値を0や推定で埋めることはしません。</p>" +
      stateFacts([
        ["provider / queue", DFS_COMMON.provider + " · " + DFS_COMMON.queue],
        ["snapshot ID", "未取得"],
        ["endpoint / data種別", "未取得（1件も呼び出していない）"],
        ["location / language / device", "未取得（取得条件が確定していない）"],
        ["取得時刻 / 期間窓", "未取得"],
        ["fresh / stale", "未取得（判定不能）"],
        ["検索volume / CPC / competition", "未取得"],
        ["SERP順位 / PAA / 関連KW", "未取得"],
        ["費用 / cache", "$0.0000（呼び出しなし） · cacheエントリなし"],
        ["source / evidence ID", "未取得（証跡なし）"],
        ["次回取得予定", "重点KW枠に入った場合のみ週次batchで取得"]
      ]) + "</div>" + limits;
  }

  const ep = '<div class="table-card"><div class="table-scroll"><table>' +
    "<caption class=\"sr-only\">endpointと取得条件</caption>" +
    "<thead><tr><th>endpoint</th><th>data種別</th><th>取得時刻</th><th>cache</th><th>費用</th></tr></thead><tbody>" +
    rec.endpoints.map((e) => "<tr><td><code>" + esc(e.path) + "</code></td><td>" + esc(e.kind) +
      "</td><td>" + esc(e.at) + "</td><td>" + esc(e.cache) + "</td><td>" + esc(e.cost) + "</td></tr>").join("") +
    "</tbody></table></div></div>";

  const serp = rec.serp
    ? '<div class="table-card"><div class="table-scroll"><table><caption class="sr-only">SERP上位</caption>' +
      "<thead><tr><th>順位</th><th>type</th><th>title</th><th>URL</th></tr></thead><tbody>" +
      rec.serp.map((s) => '<tr><td class="num">' + esc(s.rank) + "</td><td>" + badge(s.type, s.type === "organic" ? "neutral" : "info", "•") +
        "</td><td>" + esc(s.title) + '</td><td class="url">' + esc(s.url) + "</td></tr>").join("") +
      "</tbody></table></div></div>" +
      '<p class="dfs-terms">SERP順位・URL・title・typeは snapshot 時点の<b>実測</b>です（推定ではありません）。</p>'
    : '<p class="dfs-none">' + unknownTag + " SERPは取得していません（該当endpointが未実行）。順位・URLは表示しません。</p>";

  const paa = rec.paa
    ? '<ul class="paa">' + rec.paa.map((q) => "<li>" + esc(q) + "</li>").join("") + "</ul>"
    : '<p class="dfs-none">' + unknownTag + " PAAは取得していません。</p>";

  const related = rec.related
    ? '<ul class="rel">' + rec.related.map((r) =>
        '<li><button type="button" class="kwchip' + (dfsOf(r.term) ? "" : " is-unknown") + '" data-act="kw" data-arg="' + esc(r.term) + '">' +
        esc(r.term) + "</button><span>" + esc(r.volume) + '<small>DFS推定</small></span></li>').join("") + "</ul>"
    : '<p class="dfs-none">' + unknownTag + " 関連KWは取得していません。</p>";

  return head +
    '<div class="dfs-grid">' +
      dfsMetricTile("検索volume", rec.metrics.volume) +
      dfsMetricTile("CPC", rec.metrics.cpc) +
      dfsMetricTile("competition", rec.metrics.comp) +
      dfsMetricTile("competition level", rec.metrics.level) +
    "</div>" +

    "<h3>取得条件（provenance）</h3>" +
    stateFacts([
      ["provider / queue", DFS_COMMON.provider + " · " + DFS_COMMON.queue],
      ["snapshot ID", rec.snapshot],
      ["location / language / device", DFS_COMMON.location + " / " + DFS_COMMON.language + " / " + DFS_COMMON.device],
      ["取得時刻", rec.fetchedAt],
      ["期間窓", rec.window],
      ["fresh / stale", rec.fresh.label + " · " + rec.fresh.detail],
      ["cache hit / TTL", rec.cache],
      ["費用（このKW合計）", rec.cost],
      ["source / evidence ID", rec.evidence.join(" · ")]
    ]) +

    "<h3>endpoint / data種別</h3>" + ep +
    "<h3>SERP（実測）</h3>" + serp +
    "<h3>PAA質問</h3>" + paa +
    "<h3>関連KW</h3>" + related +
    limits;
}

function dfsRow(term) {
  const rec = dfsOf(term);
  const c = clusterOfKw(term);
  const on = term === ui.kw;
  const cell = (m) => (m && m.value ? esc(m.value) : unknownTag);
  const top = rec && rec.serp ? rec.serp.filter((s) => s.rank !== "—")[0] : null;

  return '<tr' + (on ? ' class="is-current"' : "") + "><td><span class=\"t-main\">" + esc(term) + "</span>" +
    '<span class="t-sub">' + (c ? esc(c.id + " · " + c.article) : "cluster未確定") + "</span></td>" +
    '<td class="num">' + (rec ? cell(rec.metrics.volume) : unknownTag) + "</td>" +
    '<td class="num">' + (rec ? cell(rec.metrics.cpc) : unknownTag) + "</td>" +
    "<td>" + (rec ? (rec.metrics.level.value ? esc(rec.metrics.level.value) + " / " + esc(rec.metrics.comp.value) : unknownTag) : unknownTag) + "</td>" +
    '<td class="num">' + (rec ? (top ? esc(top.rank) + "位" : unknownTag) : unknownTag) + "</td>" +
    '<td class="num">' + (rec ? (rec.paa ? rec.paa.length + "問" : unknownTag) : unknownTag) + "</td>" +
    "<td>" + (rec ? esc(rec.fetchedAt.slice(0, 16)) + "<br>" + badge(rec.fresh.label, rec.fresh.tone === "ok" ? "ok" : "warn", rec.fresh.tone === "ok" ? "✓" : "!") : unknownTag) + "</td>" +
    "<td>" + (rec ? esc(rec.cost) : "$0.0000") + "</td>" +
    '<td><button type="button" class="linkbtn" data-act="kw-select" data-arg="' + esc(term) +
    '" aria-pressed="' + on + '">詳細</button></td></tr>';
}

function dfsCards(terms) {
  return terms.map((term) => {
    const rec = dfsOf(term);
    const c = clusterOfKw(term);
    const cell = (m) => (m && m.value ? esc(m.value) : unknownTag);
    return '<div class="m-card"><div class="m-card-head"><div><strong>' + esc(term) + "</strong>" +
      "<small>" + (c ? esc(c.id + " · " + c.article) : "cluster未確定") + "</small></div>" +
      (rec ? badge(rec.fresh.label, rec.fresh.tone === "ok" ? "ok" : "warn", rec.fresh.tone === "ok" ? "✓" : "!")
           : badge("未取得", "neutral", "◇")) + "</div>" +
      "<dl><div><dt>検索volume</dt><dd>" + (rec ? cell(rec.metrics.volume) : unknownTag) + "</dd></div>" +
      "<div><dt>CPC</dt><dd>" + (rec ? cell(rec.metrics.cpc) : unknownTag) + "</dd></div>" +
      "<div><dt>competition</dt><dd>" + (rec ? cell(rec.metrics.level) : unknownTag) + "</dd></div>" +
      "<div><dt>費用</dt><dd>" + (rec ? esc(rec.cost) : "$0.0000") + "</dd></div></dl>" +
      '<button type="button" class="btn btn-secondary btn-sm btn-block" data-act="kw" data-arg="' + esc(term) + '">DataForSEO詳細</button></div>';
  }).join("");
}

function kwDfsBody() {
  const terms = DFS_TABLE_KWS;
  const got = terms.filter((t) => dfsOf(t)).length;

  const table = '<div class="table-card"><div class="table-scroll"><table>' +
    '<caption class="sr-only">DataForSEO取得値の一覧</caption>' +
    "<thead><tr><th>KW / cluster</th><th>検索volume</th><th>CPC</th><th>competition</th><th>最高順位</th><th>PAA</th><th>取得時刻 / 鮮度</th><th>費用</th><th>詳細</th></tr></thead>" +
    "<tbody>" + terms.map(dfsRow).join("") + "</tbody></table></div></div>";

  return sectionHead("DataForSEO 取得データ", "未取得は0や推定で埋めません。") +
    '<p class="relation">' + esc(DFS_COVERAGE) + " 表示 " + terms.length + " 件（取得済み <b>" + got +
    "</b> / 未取得 <b>" + (terms.length - got) + "</b>）。取得条件は全行共通で " +
    esc(DFS_COMMON.location) + " / " + esc(DFS_COMMON.language) + " / " + esc(DFS_COMMON.device) + "。</p>" +
    '<div class="no-mobile">' + table + "</div>" +
    '<div class="only-mobile">' + dfsCards(terms) + "</div>" +
    '<section class="card card-pad dfs-detail" id="dfs-detail" aria-label="選択したKWのDataForSEO詳細">' +
    dfsDetail(ui.kw) + "</section>";
}

function renderArticles() {
  if (ui.state === "loading")   { return renderLoading("articles"); }
  if (ui.state === "empty")     { return renderEmpty("articles"); }
  if (ui.state === "error")     { return renderError("articles"); }
  if (ui.state === "reconcile") { return renderReconcile("articles"); }

  const stale = ui.state === "stale";
  return (stale ? staleBanner("DataForSEO SERP snapshotが8日前（期待間隔7日）",
      "理由: 取得cronが2回連続失敗。gate判定は前回snapshot基準のため、公開承認前に再取得が必要です。") : "") +
    kwAccounting() +
    kwViewSwitch() +
    '<div id="kw-panel" role="tabpanel">' + (ui.kwView === "dfs" ? kwDfsBody() : kwMapBody()) + "</div>";
}

/* --------------------------------------------------------------------------
   10. 処理の監査 (WP-UI-03)
   ------------------------------------------------------------------------ */

/* 判定はsnapshotと規則から導出する値であり、手入力では作成できない（DerivedStatus） */
function verdictOf(c) {
  if (c.gate.tone === "neutral") { return { label: "解析中", tone: "neutral" }; }
  if (c.overlap >= 60) { return { label: "統合", tone: "ok" }; }
  if (c.overlap >= 50) { return { label: "統合（要確認）", tone: "warn" }; }
  return { label: "分割候補", tone: "neutral" };
}

function renderAudit() {
  if (ui.state === "loading")   { return renderLoading("audit"); }
  if (ui.state === "empty")     { return renderEmpty("audit"); }
  if (ui.state === "error")     { return renderError("audit"); }
  if (ui.state === "reconcile") { return renderReconcile("audit"); }

  const stale = ui.state === "stale";
  const c = clusterOf(ui.clusterId);
  const v = verdictOf(c);

  const list = CLUSTERS.map((x) => {
    const xv = verdictOf(x);
    return '<button type="button" class="q-item" data-act="select-cluster" data-arg="' + x.id +
      '" aria-pressed="' + (x.id === ui.clusterId) + '">' +
      "<h3>" + esc(x.id) + " · " + esc(x.article) + "</h3>" +
      '<span class="q-meta"><span>KW ' + x.kw + "</span><span>SERP重複 " + x.overlap + "%</span><span>" +
      esc(xv.label) + "</span></span></button>";
  }).join("");

  const detail = '<article class="card card-pad">' +
    '<div class="section"><div><h2>' + esc(c.id) + " · " + esc(c.article) + "</h2>" +
    '<p class="sub">' + c.kw + " KW · main " + esc(c.main) + " · snapshot " + esc(c.snapshot) + "</p></div>" +
    badge(c.gate.label, c.gate.tone, toneIcon(c.gate.tone)) + "</div>" +

    '<p class="derived"><b>DerivedStatus:</b> 判定「' + esc(v.label) + "」は source event <code>" + esc(c.event) +
    "</code> と導出規則 <code>" + esc(c.rule) + "</code> から導出された値です。手入力では作成・編集できません。" +
    "PO overrideは判定を上書きせず、理由付きの別recordとして追記されます。</p>" +

    '<div class="overlap"><p><span>SERP重複率</span><b>' + c.overlap + '%<small>/ 統合しきい値 50%</small></b></p>' +
    '<div class="meter' + (c.overlap < 60 ? " warn" : "") + '" role="img" aria-label="SERP重複率 ' + c.overlap +
    'パーセント、統合しきい値50パーセント"><i style="width:' + c.overlap + '%"></i><span class="mark" style="left:50%"></span></div></div>' +

    stateFacts([
      ["snapshot条件", c.snapshot],
      ["導出規則version", c.rule],
      ["source event", c.event],
      ["WP状態", c.wp]
    ]) +

    "<h3>判定根拠</h3>" +
    '<ul class="reasoning">' + c.reasoning.map((r) =>
      '<li><span class="r-mark' + (r.ok ? "" : " is-warn") + '" aria-hidden="true">' + (r.ok ? "✓" : "!") + "</span>" +
      "<span>" + esc(r.text) + "<small>" + (r.ok ? "根拠" : "反証候補") + " <code>" + esc(r.ref) + "</code></small></span></li>").join("") + "</ul>" +

    '<p class="handoff">このclusterのKWは' +
    '<button type="button" class="linkbtn" data-act="goto-map" data-arg="' + c.id + '">キーワードマップ →</button>' +
    "で確認できます。</p></article>";

  const override = '<aside class="card card-pad">' +
    "<h3>PO override — " + esc(c.id) + "</h3>" +
    '<p class="lead">機械判定と結論が違う場合のみ、理由を残して追記します。overrideは選択中のclusterにのみ適用され、再解析後も維持されます。</p>' +
    '<div class="stack">' +
      '<button type="button" class="btn btn-secondary btn-block" data-act="override" data-arg="split">clusterを分割する</button>' +
      '<button type="button" class="btn btn-secondary btn-block" data-act="override" data-arg="merge">clusterを統合する</button>' +
      '<button type="button" class="btn btn-danger btn-block" data-act="override" data-arg="exclude">KWを除外する</button>' +
    "</div>" +
    '<p class="col-note">いずれも理由入力と確認stepを経てから記録されます。取消した場合、記録も外部writeも行いません。</p>' +
    '<button type="button" class="linkbtn" data-act="home-tab" data-arg="decide">承認queueへ戻る →</button></aside>';

  return (stale ? staleBanner("SERP snapshotが8日前（期待間隔7日）",
      "この判定は8月15日のsnapshotに基づくため、公開承認の根拠としては再取得後に再評価が必要です。") : "") +
    sectionHead("cluster・gate判定の根拠", "判定は導出値です。手入力では作成できません。") +
    '<div class="audit-layout">' +
      '<div class="col-list">' + list + "</div>" +
      '<div class="col-detail">' + detail + "</div>" +
      '<div class="col-side">' + override + "</div>" +
    "</div>";
}

/* --------------------------------------------------------------------------
   11. 成果 (WP-UI-07)
   ------------------------------------------------------------------------ */

function renderOutcomes() {
  if (ui.state === "loading")   { return renderLoading("outcomes"); }
  if (ui.state === "empty")     { return renderEmpty("outcomes"); }
  if (ui.state === "error")     { return renderError("outcomes"); }
  if (ui.state === "reconcile") { return renderReconcile("outcomes"); }

  const stale = ui.state === "stale";
  const ledger = (title, rows) => '<div class="card card-pad"><h3>' + esc(title) + '</h3><div class="breakdown">' +
    rows.map((r) => '<div class="b-row' + (r.total ? " total" : "") + '"><span>' + esc(r.label) + "</span><span>" + esc(r.value) + "</span></div>").join("") +
    "</div></div>";

  return (stale ? staleBanner("A8成果データが15日前（期待間隔7日）",
      "確定CVと売上は8月8日時点であり、8月9日以降の成果は未反映です。") : "") +
    sectionHead("成果指標", "read-only。各値は測定sourceへtraceします。") +
    goalCard() +
    '<div class="metrics" style="margin-top:12px">' + metricTiles() + "</div>" +
    sectionHead("売上とコストの内訳", "帰属不能な成果は集計から除外しています。") +
    '<div class="two-even">' + ledger("売上（確定のみ）", OUTCOMES.revenue) + ledger("運用コスト（実費）", OUTCOMES.cost) + "</div>";
}

/* --------------------------------------------------------------------------
   12. 未着手surface
   ------------------------------------------------------------------------ */

function renderSoon(s) {
  return '<section class="panel"><h2>' + esc(s.title) + "（" + esc(s.surface) + "）は次のprototype revisionで確認します</h2>" +
    '<p class="lead">POの問い「' + esc(s.question) + "」に対する画面です。優先度P1のため、まずP0の4画面で判断骨格を合意します。</p>" +
    stateFacts([
      ["surface ID", s.surface + " · " + s.screen],
      ["route", s.route],
      ["優先度", "P1（L2 screen-list.md）"],
      ["この画面がない間の代替", "ホームの「運転と注意」に重大な事象のみ表示する"]
    ]) +
    stateActions([["ホームへ戻る", "goto", "home"]]) + "</section>";
}

/* --------------------------------------------------------------------------
   13. dialog: 公開可能条件 → 承認（2 step）
   ------------------------------------------------------------------------ */

const publishDialog = $("#publish-dialog");
const reasonDialog = $("#reason-dialog");
const evidenceDialog = $("#evidence-dialog");
const kwDialog = $("#kw-dialog");

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

[publishDialog, reasonDialog, evidenceDialog, kwDialog].forEach((dialog) => {
  dialog.addEventListener("close", () => {
    if (ui.lastFocus && document.contains(ui.lastFocus)) { ui.lastFocus.focus(); }
  });
});

function publishStep1(d) {
  const conditions = publishConditions(d.post, d.redIndex);
  const green = conditions.filter((c) => c.ok).length;
  const blocked = green < 7;

  return '<div class="dlg-head"><div><p class="dlg-eyebrow">STEP 1 / 2 · 公開可能条件</p>' +
    '<h2 id="publish-dialog-title">公開可能条件 ' + green + "/7</h2>" +
    '<p class="dlg-sub">post <strong>#' + d.post.id + "</strong> · digest <code>" + esc(d.post.digest) + "</code> · action <strong>draft → publish</strong></p></div>" +
    '<button type="button" class="dlg-close" data-act="cancel-dialog" aria-label="閉じる（取消）">×</button></div>' +

    '<div class="dlg-body">' +
      (blocked ? '<p class="hard-note"><b>公開writeは実行できません。</b>' +
        "条件が1件でもredの場合、公開writeは0件になります（AC-S1-008）。差し戻して原因を解消してください。</p>" : "") +

      stateFacts([
        ["実行差分", "status draft → publish"],
        ["外部影響", "WordPress書込 1件 · 公開URL " + d.post.url],
        ["rollback", d.post.rollbackId + " · 同一post IDをdraftへ復帰"]
      ]) +

      '<div class="gate-items">' + conditions.map((c) =>
        '<div class="gate-item' + (c.ok ? "" : " is-red") + '"><span class="gate-mark" aria-hidden="true">' + (c.ok ? "✓" : "×") + "</span>" +
        "<span><strong>" + c.no + ". " + esc(c.title) + "</strong>" +
        "<small>" + esc(c.detail) + "</small>" +
        "<small class=\"gi-ref\">" + (c.ok ? "green" : "RED") + " · evidence " + esc(c.ref) + "</small></span></div>").join("") + "</div>" +

      stateFacts([
        ["承認の束縛先", "post #" + d.post.id + " / " + d.post.digest + " / action=publish"],
        ["有効期限", d.due.at],
        ["公開後の検証", "GET再取得で status=publish と URL を確認"],
        ["operation chain", d.post.operationId]
      ]) +
    "</div>" +

    '<div class="dlg-foot"><span class="foot-note">取消した場合、外部writeもoperation追記も行いません。</span>' +
    '<button type="button" class="btn btn-secondary" data-act="cancel-dialog">取消して詳細へ戻る</button>' +
    '<button type="button" class="btn btn-primary" data-act="publish-step2" data-arg="' + d.id + '"' + (blocked ? " disabled" : "") + ' data-autofocus>' +
    (blocked ? "承認できません" : "承認へ進む") + "</button></div>";
}

function publishStep2(d) {
  return '<div class="dlg-head"><div><p class="dlg-eyebrow">STEP 2 / 2 · 承認</p>' +
    '<h2 id="publish-dialog-title">この内容で公開を承認しますか</h2>' +
    '<p class="dlg-sub">承認は post <strong>#' + d.post.id + "</strong> と digest <code>" + esc(d.post.digest) + "</code>、action <strong>publish</strong> へ束縛されます。</p></div>" +
    '<button type="button" class="dlg-close" data-act="cancel-dialog" aria-label="閉じる（取消）">×</button></div>' +

    '<div class="dlg-body">' +
      stateFacts([
        ["実行差分", "status draft → publish"],
        ["外部影響", "WordPress書込 1件 / " + d.post.url],
        ["rollback", d.post.rollbackId + "（draftへ復帰・24時間有効）"],
        ["公開可能条件", "7/7 green"]
      ]) +

      "<div><label class=\"field\" for=\"approve-reason\">承認理由<span class=\"req\">必須</span>" +
      "<small>この理由は承認recordへ保存され、後から公開判断を再現するために使われます。</small></label>" +
      '<textarea id="approve-reason" rows="3" placeholder="例: 公開可能条件7件を確認。事実sourceも全件添付されているため公開する。"></textarea>' +
      '<p class="field-error" id="approve-reason-error">承認理由を入力してください。理由がない承認は記録できません。</p></div>' +

      '<p class="info-note">これはprototypeです。「承認して公開する」を押しても外部通信・WordPressへのwriteは発生しません。</p>' +
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
   14. dialog: 理由入力を伴う汎用confirm
   ------------------------------------------------------------------------ */

function openReasonDialog(config) {
  ui.pendingReason = config;
  openDialog(reasonDialog,
    '<div class="dlg-head"><div><p class="dlg-eyebrow">' + esc(config.eyebrow) + "</p>" +
    '<h2 id="reason-dialog-title">' + esc(config.title) + "</h2>" +
    '<p class="dlg-sub">' + esc(config.sub) + "</p></div>" +
    '<button type="button" class="dlg-close" data-act="cancel-dialog" aria-label="閉じる（取消）">×</button></div>' +
    '<div class="dlg-body">' + stateFacts(config.facts) +
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
   15. dialog: 証跡（EvidenceLink） / DataForSEO詳細
   ------------------------------------------------------------------------ */

function openEvidenceDialog(d) {
  openDialog(evidenceDialog,
    '<div class="dlg-head"><div><p class="dlg-eyebrow">EVIDENCE</p>' +
    '<h2 id="evidence-dialog-title">証跡 ' + d.evidence.length + " 件</h2>" +
    '<p class="dlg-sub">post #' + d.post.id + " · chain " + esc(d.post.operationId) + "</p></div>" +
    '<button type="button" class="dlg-close" data-act="cancel-quiet" aria-label="閉じる">×</button></div>' +
    '<div class="dlg-body"><ul class="ev-list">' +
    d.evidence.map((e) =>
      "<li><code>" + esc(e.id) + "</code><span>" + esc(e.label) + "</span><time>" + esc(e.at) + "</time></li>").join("") + "</ul>" +
    stateFacts([
      ["保存している項目", "post ID / status / modified / content digest / 検証時刻 / 相関ID"],
      ["保存しない項目", "記事本文の複製 / 全API応答 / credential・Application Password・Cookie"],
      ["content digest", d.post.digest]
    ]) +
    '<p class="col-note">証跡IDは不変です。secret値はこの画面にも証跡にも表示しません。</p></div>' +
    '<div class="dlg-foot"><button type="button" class="btn btn-secondary" data-act="cancel-quiet" data-autofocus>閉じる</button></div>');
}

function openKwDialog(term) {
  openDialog(kwDialog,
    '<div class="dlg-head"><div><p class="dlg-eyebrow">DATAFORSEO</p>' +
    '<h2 id="kw-dialog-title">KWデータ詳細</h2>' +
    '<p class="dlg-sub">fixture表示のみ。外部APIへは接続しません。</p></div>' +
    '<button type="button" class="dlg-close" data-act="cancel-quiet" aria-label="閉じる">×</button></div>' +
    '<div class="dlg-body dfs-detail">' + dfsDetail(term) + "</div>" +
    '<div class="dlg-foot"><span class="foot-note">DataForSEO利用規約・cache TTL・月$5上限は詳細内に表示しています。</span>' +
    '<button type="button" class="btn btn-secondary" data-act="cancel-quiet" data-autofocus>閉じる</button></div>');
}

/* --------------------------------------------------------------------------
   16. 描画
   ------------------------------------------------------------------------ */

function renderFreshness() {
  const copy = (STATE_COPY[ui.view] || STATE_COPY.home).freshness[ui.state];
  const cls = copy.tone === "stale" ? " is-stale" : (copy.tone === "error" ? " is-error" : "");
  $("#freshness-badge").className = "freshness" + cls;
  $("#freshness-badge").innerHTML =
    '<span class="f-icon" aria-hidden="true">' + copy.icon + "</span>" +
    "<span><strong>" + esc(copy.head) + "</strong><small>" + esc(copy.sub) + "</small></span>";
}

function renderNav() {
  const list = $("#primary-nav");
  const pending = ui.state === "empty" ? 0 : pendingCount();
  list.innerHTML = SURFACES.map((s) =>
    '<button type="button" role="tab" id="tab-' + s.id + '" class="nav-item" data-view="' + s.id +
    '" data-soon="' + Boolean(s.soon) + '" aria-selected="' + (s.id === ui.view) +
    '" aria-controls="panel-current" tabindex="' + (s.id === ui.view ? "0" : "-1") + '">' +
    "<span>" + esc(s.nav) + "</span>" +
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
    normal:    ["dot-ok",   "正常",           "次回取得 8月24日 03:00"],
    stale:     ["dot-warn", "一部データstale", "A8成果 15日前 / 期待7日"],
    loading:   ["dot-ok",   "取得中",         "実行中のstepあり"],
    empty:     ["dot-ok",   "正常 / 判断0件",  "次回取得 8月24日 03:00"],
    error:     ["dot-bad",  "failure",        "承認記録stepで失敗"],
    reconcile: ["dot-warn", "照合待ち",       "reconciliation_required"]
  };
  const m = map[ui.state];
  $("#rail-runtime").innerHTML = '<span class="dot ' + m[0] + '" aria-hidden="true"></span>' +
    "<span><strong>" + esc(m[1]) + "</strong><small>" + esc(m[2]) + "</small></span>";
}

const RENDERERS = { home: renderHome, articles: renderArticles, audit: renderAudit, outcomes: renderOutcomes };

function render() {
  const s = surfaceOf(ui.view);

  $("#page-title").textContent = s.title;
  $("#page-question").textContent = s.question;
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
   17. 操作
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

  const restored = $("#home-tab-" + tab.id);
  if (restored) { restored.focus(); } else { $("#view-region").focus(); }

  if (!quiet) {
    const st = homeTabStatus(tab.id, ui.state);
    announce(tab.label + "を表示しました。" + st.sr + "。");
  }
  if (moved) { window.scrollTo({ top: 0, behavior: "smooth" }); }
}

function setKwView(viewId, quiet) {
  ui.kwView = viewId === "dfs" ? "dfs" : "map";
  ui.view = "articles";
  render();
  const restored = $('[data-kwview="' + ui.kwView + '"]');
  if (restored) { restored.focus(); }
  if (!quiet) {
    announce(ui.kwView === "dfs" ? "DataForSEOデータを表示しました。" : "キーワードマップを表示しました。");
  }
}

function setState(stateId, quiet) {
  ui.state = stateId;
  render();
  const restored = $('#state-switch [data-state="' + stateId + '"]');
  if (restored) { restored.focus(); }
  if (!quiet) {
    const label = STATES.find((s) => s.id === stateId).label;
    announce("表示状態を " + label + " に切り替えました。");
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-act], [data-view], [data-state], [data-tab], [data-kwview]");
  if (!target) { return; }

  if (target.dataset.view) { goto(target.dataset.view); return; }
  if (target.dataset.state) { setState(target.dataset.state); return; }
  if (target.dataset.tab) { setHomeTab(target.dataset.tab); return; }
  if (target.dataset.kwview) { setKwView(target.dataset.kwview); return; }

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
      if (ui.view === "audit") { render(); announce(clusterOf(ui.clusterId).article + "の判定根拠を表示しました。"); }
      else { goto("audit"); }
      break;

    case "goto-map":
      ui.clusterId = CLUSTERS.some((c) => c.id === arg) ? arg : ui.clusterId;
      ui.lane = "assigned";
      ui.kwView = "map";
      ui.filter = "all";
      goto("articles");
      break;

    case "lane":
      ui.lane = LANES.some((l) => l.id === arg) ? arg : ui.lane;
      ui.kwView = "map";
      render();
      announce(laneOf(ui.lane).label + " lane（" + laneOf(ui.lane).n + "件）を表示しました。");
      break;

    case "kw":
      openKwDialog(arg);
      break;

    case "kw-select":
      ui.kw = arg;
      render();
      announce(arg + " のDataForSEO詳細を表示しました。");
      break;

    case "select-decision":
      ui.decisionId = arg;
      render();
      announce(decisionOf(arg).title + "の詳細を表示しました。");
      break;

    case "select-cluster":
      ui.clusterId = arg;
      render();
      announce(clusterOf(arg).article + "の判定根拠を表示しました。");
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
      const v = verdictOf(c);
      const kindLabel = { split: "分割", merge: "統合", exclude: "KW除外" }[arg];
      openReasonDialog({
        eyebrow: "PO OVERRIDE",
        title: "cluster " + c.id + " を" + kindLabel + "しますか",
        sub: "overrideは機械判定を消さず、理由付きの別recordとして追記されます。",
        facts: [
          ["対象cluster", c.id + " / " + c.article],
          ["機械判定", v.label + "（SERP重複率 " + c.overlap + "%）"],
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
      closeDialog(kwDialog);
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
   18. keyboard: tablist と radiogroup の矢印key移動
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

const HORIZONTAL = { next: ["ArrowRight", "ArrowDown"], prev: ["ArrowLeft", "ArrowUp"] };

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
}, HORIZONTAL);

/* ホームのsub-tablistと記事・KWの表示切替は再描画で作り直されるため、
   安定した祖先 #view-mount へ委譲する。 */
roving($("#view-mount"), ".subtab:not(.kwtab)", (item) => {
  setHomeTab(item.dataset.tab);
}, HORIZONTAL);

roving($("#view-mount"), ".kwtab", (item) => {
  setKwView(item.dataset.kwview);
}, HORIZONTAL);

/* --------------------------------------------------------------------------
   19. deep link
   L2 screen-flow.md「deep linkは対象とfilterを保持する」の確認用。
   例: index.html#/home?state=normal&t=runtime
       index.html#/articles?state=stale&f=red
       index.html#/articles?v=dfs&k=%E3%81%B2%E3%81%A8%E3%82%8A%E8%B5%B7%E6%A5%AD%20%E5%A7%8B%E3%82%81%E6%96%B9
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
  if (LANES.some((l) => l.id === params.get("l"))) { ui.lane = params.get("l"); }
  if (["map", "dfs"].indexOf(params.get("v")) >= 0) { ui.kwView = params.get("v"); }
  if (params.get("k") && KNOWN_KWS.indexOf(params.get("k")) >= 0) { ui.kw = params.get("k"); }
}

function writeHash() {
  const query = "state=" + ui.state + "&t=" + ui.tab + "&d=" + ui.decisionId + "&c=" + ui.clusterId +
    "&f=" + ui.filter + "&l=" + ui.lane + "&v=" + ui.kwView + "&k=" + encodeURIComponent(ui.kw);
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
   20. init
   ------------------------------------------------------------------------ */

readHash();
render();
announce("WP Operations prototypeを表示しました。fixture表示のみで外部通信は行いません。");
