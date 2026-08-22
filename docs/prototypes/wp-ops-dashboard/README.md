# WP Operations Dashboard prototype r1

L2要求洗い出し用の静的HTML prototype。production codeではなく、画面構成とPO判断flowへのreactionを
得るための成果物である。表示dataは全てfixtureで、WordPressや外部serviceへ接続・writeしない。

```bash
python3 -m http.server 4173 --directory docs/prototypes/wp-ops-dashboard
```

確認対象:

1. 最初に「何を判断するか」「なぜ」「risk」が分かるか
2. 公開条件7件、post ID、content digest、rollbackを確認してから承認できるか
3. 異常・stale・次回予定が判断queueと混線しないか
4. 記事一覧と処理監査から判断根拠へ到達できるか
5. smartphone幅でも承認に必要な情報が欠落しないか

PO reactionは`docs/requirements/discovery/events.jsonl`へ追記し、accepted revisionを固定する。

Render evidence:

- `prototype-home.png` — 1440×1100
- `prototype-mobile.png` — 390×1100
