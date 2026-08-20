# HELIX Lite 導入 PoC 証跡（2026-08-21）

PO 判断により、HELIX-HARNESS のコア（開発規律・CI・doctor・review・completion evidence）を
本リポへ consumer として導入した。resident lanes / routing / allocation / 配布系は本家で育てる
（HELIX Lite 境界 — CLAUDE.md project-owned 節参照）。

## 構成

- HELIX-HARNESS = npm devDependency `helix: github:RetryYN/HELIX-HARNESS#dcfbb845`（固定 commit）。
  当初は vendor submodule で結合したが、doctor の consumer-ci-workflow 契約が checkout への
  submodule 追加を許さない（`npm ci` だけで揃う形が正）ため npm 依存へ切替、submodule は撤去
- runtime: Node v24.19.0（bun 非使用・node fallback）。deps は `npm ci` のみで揃う
- 入口: `npm run helix -- <cmd>`（= `tsx node_modules/helix/src/cli.ts`）と PATH 上の `helix`
  （`~/.local/bin/helix` が repo の node_modules 経由で exec）。typecheck は harness src を対象にした
  repo 直下 tsconfig.json（tests は vitest 依存のため除外）
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
- node_modules 内の harness ファイルは編集禁止。導入中に PATH wrapper の symlink 書込みで vendor 実体を誤上書きした事故が 1 件あり
  `git checkout -- scripts/helix` で復元済み（その後 vendor submodule 自体を撤去）。
