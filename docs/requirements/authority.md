# WP 要求 authority

- initiative_id: `WP-AUTONOMOUS-OPS`
- canonical V-model: `L1-L12`
- development style candidate: `V_DESIGN_SCRUM_IMPLEMENTATION`
- lifecycle: `elicited`
- freeze: **未実施**
- authority owner: PO
- updated: 2026-08-23

## 正本境界

| 層 | 正本 | 状態 | 次の昇格条件 |
| --- | --- | --- | --- |
| L1 | `docs/requirements/l1/` の5 sub-doc | confirmed input | G1 content/pair/traceのPO承認 |
| L2 | `docs/requirements/discovery/events.jsonl` と同イベントから生成する `candidate-projection.json` | non-canonical candidate | 未決事項の解消、画面prototype reaction、PO agreement |
| L3 | `docs/requirements/l3/requirements-ir.json` | draft compile preview | L2 agreement後の再compile、L10 oracleとのpair、G3 PO/TL承認 |

既存の `l1-plan-autonomous-wp-harness.md`、`l2-req-slice1-keyword-to-article.md`、
`l2-req-r6-dashboard.md` は情報源として維持するが、単独のfreeze根拠にはしない。
既存文書中の `confirmed` は「当時の対話内容を保存済み」の意味であり、G1/G2/G3 freezeを意味しない。

AIはPOの回答、prototype合意、freezeを推測しない。未決事項は`human_decision_required`のまま保持する。

## トレーサビリティ

`L1 BR/FR/NFR/TR/SCR → L2 candidate/surface → L3 WP-* → WP-AC-* → WP-AT-*`
をstable IDで接続する。孤児、重複ID、存在しない参照、受入条件のない要求はL3進行を拒否する。

## PoCの扱い

PoCは実現可能性を裏づける入力であり、要求や人間合意の代替ではない。参照可能なPoCは
`docs/poc/wp-poc-inventory.json`にHEAD、ファイルdigest、採用結論、非採用・制約を固定する。
秘密情報、raw CSV、顧客・アカウントデータはこのリポジトリへ複製しない。
