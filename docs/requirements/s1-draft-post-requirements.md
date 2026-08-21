# S1 最小運用タスク要求 — WordPress記事の下書き作成

## 状態

- status: draft
- owner: PO
- PLAN: `PLAN-L2-001-s1-draft-post-requirements`
- 上流: `docs/planning/l1-plan-autonomous-wp-harness.md`
- PoC証跡: `docs/poc/`（接続車線の成立確認。個別証跡IDはレビューで確定する）

## 目的

POが指定した記事内容をWordPressへ1件だけ下書き保存し、公開を伴わず、入力・結果・失敗を
追跡可能な証跡として残せることをS1最小運用単位とする。

## 対象

- 対象サイト、投稿タイプ、タイトル、本文、必要な分類をPO指示から受け取る。
- WordPress REST APIを第一経路とする。
- 作成結果はpost ID、status、検証時刻、使用経路を記録する。

## 非対象

- 公開、予約公開、既存投稿の上書きまたは削除
- メディアアップロード、SEOメタ、CTA、計測タグの設定
- credentialの生成、保存、ログ出力
- 指示にない補完や自動的な公開判断

## 安全境界

1. `status=draft` 以外の作成要求を拒否する。
2. 対象サイトと投稿内容がPO指示にない場合はwrite前に停止する。
3. credential、Application Password、Cookieを証跡へ含めない。
4. 応答が不明またはtimeoutの場合、同一内容を無条件再送しない。既存結果を照会してから再試行を判断する。
5. 失敗時に公開、削除、既存投稿更新へfallbackしない。

## 受入条件（draft）

- AC-S1-001: 正常系では新規投稿が1件だけ作成され、取得結果の`status`が`draft`である。
- AC-S1-002: `publish`、`future`、`private`を指定した要求はwrite前に拒否される。
- AC-S1-003: 必須入力不足、対象サイト不明、認証失敗時はWordPressの状態を変更しない。
- AC-S1-004: timeout後の再確認で同一投稿が存在する場合、重複投稿を作成しない。
- AC-S1-005: 証跡にはpost ID、status、時刻、検証結果を含み、credentialを含まない。
- AC-S1-006: 実機writeはPOの個別指示があるセッションでのみ実行する。

## PO判断待ち

- 最初の実機検証で使用する記事内容と対象サイト
- 重複判定に使う冪等キーの形式と保持期間
- category/tagをS1最小単位へ含めるか
- 下書き作成後の人間確認方法（WP管理画面またはUIフロント）
