# L2 Low-Fi Wireframe

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

prototype status: `prototyped`。PO reactionとagreementは未記録であり、G2 freezeではない。

## Reaction checklist

- 開いた直後に必要な判断が分かるか
- 判断前に理由、risk、外部影響、rollbackが足りるか
- キュー0件時に正常と次回予定を誤解なく判断できるか
- smartphoneで承認に必要な情報が欠落しないか
- failureとtimeout後のrecoveryが区別できるか
