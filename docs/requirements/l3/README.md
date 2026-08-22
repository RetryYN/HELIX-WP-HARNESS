# L3 compile preview

`requirements-ir.json`はstrict consumer IRのcompile previewであり、現時点ではcanonical/frozenではない。
`acceptance-cases.json`と`traceability.json`を分離し、`npm run requirements:validate`が次をfail-closeする。

- 未知・欠落property
- 重複requirement/acceptance/event ID
- L1→L2→L3→testの孤児
- surfaceもnon-UI N/A receiptもない要求
- decision IDを持たない`human_decision_required`
- human agreementなしのcompile完了・G3 freeze

現在のbackflowは`WP-Q-POST-01`、`WP-Q-POST-02`、`WP-Q-UI-01`。PO回答とprototype reactionを
append-only eventへ追加した後にprojectionを再構築し、Claude/Codex独立レビューを通してからG3候補にする。
