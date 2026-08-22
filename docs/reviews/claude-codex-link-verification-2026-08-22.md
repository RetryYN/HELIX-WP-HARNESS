# Claude / Codex 連携経路検証（2026-08-22）

## 結論

repository-local adapterのdry-runとprovider handover生成は成立したが、Claude実行は
`WORKER_CONTEXT_AUTHORITY_UNRESOLVED` でfail-closeした。consumer packageが実行時に要求する
authority / rule文書の一部をconsumer repoへ配布していないため、現pin
`github:RetryYN/HELIX-HARNESS#dcfbb845` では正式なcross-provider実行を完了できない。

## 確認結果

| 項目 | 結果 | 証跡 |
| --- | --- | --- |
| repository-local CLI | PASS | `npm run helix -- status` |
| consumer doctor | PASS | `npm run helix -- doctor --profile consumer` |
| hybrid team dry-run | PASS | provider=`codex`,`claude`、`executable=true` |
| active PLAN | PASS | `.helix/state/current-plan` |
| Codex→Claude handover | PASS | `.helix/handover/provider/CURRENT.json` |
| worker context schema | PASS相当 | schema-valid boundaryを作成し、未指定時の`UNSEALED`から`AUTHORITY_UNRESOLVED`へ進行 |
| Claude実レビュー | BLOCKED | `WORKER_CONTEXT_AUTHORITY_UNRESOLVED` |

## 原因

HELIX packageの`worker-context-boundary-operator-guide.md`と実装は、実行時authorityとして
次の文書をcurrent repository rootから解決する。

- `docs/governance/helix-harness-requirements_v1.3.md`
- `docs/governance/l12-canonical-vmodel-direction-directive_v0.1.md`
- `docs/design/helix/L3-requirements/worker-common-contract.md`
- `docs/skills/judgment-core.md`（rule packet）

これらは`media/wp` consumer repoには存在しない。HELIX Lite方針では本家の設計文書をconsumerへ
複製しないため、consumer側でコピーして回避しない。HELIX package側でconsumer向けauthority packetを
同梱するか、package内authorityを正規に解決する修正が必要である。

## 補足: `model_family=codex`

dry-runのClaude reviewerに表示される`model_family=codex`はprovider誤配線ではない。
現実装では`fast` / `codex` / `frontier`をモデル能力帯として使い、provider=`claude`の場合は
同じ帯をClaudeモデルへ写像する。実行先は`provider=claude`、`model=claude-sonnet-5`で正しい。
名称は誤読を招くが、本検証では実行阻害バグに分類しない。

## 次アクション

1. HELIX-HARNESSはread-only参照専用とし、本リポジトリから編集しない。
2. 上流所有者がconsumer実行時authority解決を修正した場合だけ、修正版pinへ
   `helix version-up dry-run`を経て更新する。
3. 同じworker contextでClaude read-onlyレビューを再実行する。
4. `review_kind=cross_agent`、`worker_model`、`reviewer_model`、`verdict`をPLANへ記録する。
