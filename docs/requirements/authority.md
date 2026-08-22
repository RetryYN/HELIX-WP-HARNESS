# WP 要求 authority

- initiative_id: `WP-AUTONOMOUS-OPS`
- canonical V-model: `L1-L12`
- development style candidate: `V_DESIGN_SCRUM_IMPLEMENTATION`
- lifecycle: `L2 prototyping`
- freeze: **未実施**
- authority owner: PO
- updated: 2026-08-23

## 正本境界

| 層 | 正本 | 状態 | 次の昇格条件 |
| --- | --- | --- | --- |
| L1 | `docs/requirements/l1/` の5 sub-doc | confirmed input | G1 content/pair/traceのPO承認 |
| L2 | `docs/requirements/discovery/events.jsonl` と同イベントから生成する `candidate-projection.json` | non-canonical candidate | 未決事項の解消、画面prototype reaction、PO agreement |
| L3 | 未開始。`docs/requirements/l3/`は早期gap inventoryとして撤回済み | not_started | 画面prototype reactionとL2 agreement後に新規compile |

既存の `l1-plan-autonomous-wp-harness.md`、`l2-req-slice1-keyword-to-article.md`、
`l2-req-r6-dashboard.md` は情報源として維持するが、単独のfreeze根拠にはしない。
既存文書中の `confirmed` は「当時の対話内容を保存済み」の意味であり、G1/G2/G3 freezeを意味しない。

AIはPOの回答、prototype合意、freezeを推測しない。未決事項は`human_decision_required`のまま保持する。

2026-08-23のPO判断により、画面を伴う本案件は確認可能なprototypeを先に提示し、画面構成を確定するまで
L3要件定義へ進まない。既存`docs/requirements/l3/`は漏れ検査に使った非正本inventoryであり、
`compile requested/completed`、`specified`、G3到達の証拠に使用しない。

## トレーサビリティ

`L1 BR/FR/NFR/TR/SCR → L2 candidate/surface → L3 WP-* → WP-AC-* → WP-AT-*`
をstable IDで接続する。L3未開始中の未降下L1 IDは`docs/requirements/l3/coverage-gaps.json`へ
理由と再入場actionを伴ってexact inventory化する。未記録gap、解消済みgapの残存、二重管理不一致、
重複ID、存在しない参照、受入条件のない要求を拒否し、L3 compile完了・G3 freeze時はgap 0を必須とする。

## PoCの扱い

PoCは実現可能性を裏づける入力であり、要求や人間合意の代替ではない。参照可能なPoCは
`docs/poc/wp-poc-inventory.json`にHEAD、ファイルdigest、採用結論、非採用・制約を固定する。
秘密情報、raw CSV、顧客・アカウントデータはこのリポジトリへ複製しない。
