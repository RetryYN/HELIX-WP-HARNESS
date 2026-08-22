# L2 Prototype Authority

確認対象は実HTML prototype
`docs/prototypes/wp-ops-dashboard/index.html`（`WP-PROT-UI-02-r3`）。以下のASCIIは履歴参照であり、
画面合意対象ではない。

```text
┌─ WP運用 ─────────────────────────────────────────────┐
│ site / data freshness / next scheduled run           │
├─ 要承認 ─────────────────────────────────────────────┤
│ [対象] [なぜ] [gate] [risk] [期限] [根拠] [判断する] │
├─ 警告 ───────────────────────────────────────────────┤
│ stale / ingest failure / terminated program / gate   │
├─ 成果 ───────────────────────────────────────────────┤
│ impression | AI exposure | CV | revenue/cost ratio   │
└─ Articles / Audit / AIO / Links / Rewrite / Calendar ┘
```

prototype status: `prototyped`。HTML revisionへのPO reactionとagreementは未記録であり、G2 freezeではない。

## Reaction checklist

- 開いた直後に必要な判断・理由・riskが分かるか
- post ID、content digest、公開可能条件、rollbackを確認して公開承認できるか
- 判断前に理由、risk、外部影響、rollbackが足りるか
- キュー0件時に正常と次回予定を誤解なく判断できるか
- smartphoneで承認に必要な情報が欠落しないか
- failureとtimeout後のrecoveryが区別できるか
