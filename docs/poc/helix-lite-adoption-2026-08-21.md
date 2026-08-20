# HELIX Lite 導入 PoC 証跡（2026-08-21）

PO 判断により、HELIX-HARNESS のコア（開発規律・CI・doctor・review・completion evidence）を
本リポへ consumer として導入した。resident lanes / routing / allocation / 配布系は本家で育てる
（HELIX Lite 境界 — CLAUDE.md project-owned 節参照）。

## 構成

- `vendor/helix-harness/` = RetryYN/HELIX-HARNESS の固定 commit `dcfbb845` を submodule 結合（read-only）
- runtime: Node v24.19.0（bun 非使用・node fallback）。deps は本リポと submodule 双方で `npm ci`
- 入口: `npm run helix -- <cmd>`（package.json script）と PATH 上の `helix`
  （`~/.local/bin/helix` → vendor wrapper への転送スクリプト。symlink は wrapper の
  ROOT 解決を壊すので不可）
- 生成物: `helix setup project` により AGENTS.md / CLAUDE.md / .claude / .codex / .vscode /
  .github(harness-check・escalation-stale・templates) / scripts/setup-branch-protection.sh /
  .helix(state・teams・memory・evidence) を生成

## 検証結果（consumer smoke）

| command | 結果 |
| --- | --- |
| `helix --version` | 0.1.0 |
| `helix setup project --dry-run --json` | rc=0（plan-only） |
| `helix setup project --json` | 生成完了・importReport requiresReview=false |
| `helix doctor --profile consumer --json` | **ok=true**（全 check green） |
| `helix status --json` | rc=0（whole-program completion は blocked=正常。未完了 work が無いためではなく閉じた work が無いため） |
| `helix completion decision-packet --json` | rc=0 |
| `helix completion review-bundle --json` | rc=0 |
| `helix rename plan --json` | rc=0（plan-only） |

## 制約・注意

- branch protection の適用は emit-only（`--apply-branch-protection` と admin 権限が必要）。未適用。
- `helix version-up dry-run` の release-remote（HELIX-HARNESS-OS）は本家 #659 未終端のため実運用しない。
- vendor 内ファイルは編集禁止。導入中に wrapper を誤上書きした事故が 1 件あり
  `git checkout -- scripts/helix` で復元済み（本コミットの vendor pin はクリーン）。
