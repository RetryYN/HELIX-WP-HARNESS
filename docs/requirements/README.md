# 要求

正本入口は [`authority.md`](./authority.md)。L1の5 sub-doc、L2 discovery/prototype、L3 compile preview、
L10～L12 test designを分離している。既存の大判文書は情報源であり、単独でfreezeを表さない。

```bash
npm run requirements:validate
```

本ディレクトリは WordPress ハーネスの要求置き場である。

- [l2-req-slice1-keyword-to-article.md](l2-req-slice1-keyword-to-article.md) —
  スライス1「キーワードから記事を書ける基盤」の L2 情報源（**confirmed input** 2026-08-21、
  以後 PO 対話で随時改訂）。PoC 3 点は完了済み・実機基盤の確立状況は同文書の
  「実機基盤の確立状況」節を参照。

要求はappend-only eventからcandidate projectionを再構築する。PO確認は対象revision付きagreement eventへ
記録し、L3 compileとG1/G3承認を経るまでfrozenとしない。
