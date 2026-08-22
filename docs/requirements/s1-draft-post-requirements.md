# S1 最小運用タスク要求 — WordPress記事の安全な公開

> authority note (2026-08-23): 本書は`WP-CAND-POST`のL2 source。PO回答により、下書き作成だけで
> 完了せず、安全条件を満たして公開結果を検証できるところまでをS1到達点とする。

## 状態

- status: accepted candidate / prototype agreement待ち
- owner: PO
- PLAN: `PLAN-L2-001-s1-draft-post-requirements`
- 上流: `docs/planning/l1-plan-autonomous-wp-harness.md`
- PoC証跡: `docs/poc/`（接続車線の成立確認。個別証跡IDはレビューで確定する）

## 目的

POが指定した記事をWordPressへ下書き保存し、公開前gateとPO承認を閉じた後、同じpost IDを
安全に公開して取得結果を検証できることをS1最小運用単位とする。

## 対象

- 対象サイト、投稿タイプ、タイトル、本文、必要な分類をPO指示から受け取る。
- WordPress REST APIを第一経路とする。
- 下書き作成後はWordPressのpost IDを状態identityとする。
- WPから都度取得できる本文や全API応答は重複保存しない。保持するのはpost ID、status、modified、
  content digest、検証時刻、相関ID、gate/approval/evidence参照だけとする。

## 非対象

- 予約公開、既存投稿の無承認上書きまたは削除
- メディアアップロード、SEOメタ、CTA、計測タグの設定
- credentialの生成、保存、ログ出力
- 指示にない補完や自動的な公開判断

## 安全境界

1. 新規作成は必ず`status=draft`から開始し、直接`publish`する要求を拒否する。
2. 対象サイトと投稿内容がPO指示にない場合はwrite前に停止する。
3. credential、Application Password、Cookieを証跡へ含めない。
4. 応答が不明またはtimeoutの場合、同一内容を無条件再送しない。既存結果を照会してから再試行を判断する。
5. 失敗時に公開、削除、既存投稿更新へfallbackしない。
6. 公開直前にpost IDを再取得し、期待`modified`とcontent digestが一致しなければ停止する。
7. 公開後に同じpost IDを再取得し、`status=publish`と公開URLを検証する。結果不明時は再公開せず照会する。

## 公開可能条件

以下が全件greenの場合だけ、draftからpublishへの遷移を許可する。

1. 対象site、post ID、期待modified、content digestが固定され、WP再取得結果と一致する。
2. 中間JSON schema、未知type、Gutenberg editor validityのgateがgreen。
3. KW/PAA/共通見出し、writing regulation、事実provenanceの適用対象gateがgreen。
4. credential/secret検査、permission、外部link、公開URL競合のpreflightがgreen。
5. PO承認が同一post ID・content digest・公開actionへ束縛され、有効期限内である。
6. 公開失敗時に同じpost IDをdraftへ戻すrollbackが準備されている。
7. 公開後のGET検証と証跡記録が同一operation chainで実行可能。

## 受入条件（candidate）

- AC-S1-001: 正常系では新規draftが1件だけ作成され、post IDを取得後はそのIDで状態を照会する。
- AC-S1-002: `publish`、`future`、`private`を指定した要求はwrite前に拒否される。
- AC-S1-003: 必須入力不足、対象サイト不明、認証失敗時はWordPressの状態を変更しない。
- AC-S1-004: timeout後の再確認で同一投稿が存在する場合、重複投稿を作成しない。
- AC-S1-005: 証跡にはpost ID、status、modified、content digest、時刻、検証結果を含み、本文複製・全応答・credentialを含まない。
- AC-S1-006: 公開可能条件7件と同一actionへのPO承認が揃った場合だけ、同じpost IDを公開する。
- AC-S1-007: 公開後GETで`status=publish`とURLを確認し、不明応答時は再送せずpost IDで照合する。
- AC-S1-008: 任意の公開可能条件を1件redにすると、公開writeが0件になる。

## PO判断待ち

- 最初の実機検証で使用する記事内容と対象サイト
- category/tagをS1最小単位へ含めるか
- 公開前確認を行う画面prototypeのPO agreement
