# L10 System Acceptance Test Design

本書はL3 requirement IRの右腕である。現時点はdraftであり、L3 freezeを主張しない。

| Test ID | Requirement | positive oracle | negative/boundary oracle | evidence |
| --- | --- | --- | --- | --- |
| WP-AT-KW-01 | WP-FR-KW-01 | 既知Excelの戦略fieldと原文digestが一致 | headerなし、破損fileはwriteなしで拒否 | ingest receipt |
| WP-AT-KW-02 | WP-FR-KW-02 | 同一snapshot+規則versionで同一分類 | 記事型3未満は判定不能で停止 | analyzer receipt |
| WP-AT-KW-03 | WP-FR-KW-03 | 母集団式の差分0 | 重複帰属・孤児をgateが拒否 | coverage report |
| WP-AT-DOC-01 | WP-FR-DOC-01 | post/page adapterを正しく選択 | unknown doc_typeをwrite前拒否 | schema/adapter test |
| WP-AT-DOC-02 | WP-FR-DOC-02 | roundtrip semantic digest一致 | 未知blockを破棄せずraw保全 | fixture diff |
| WP-AT-TR-01 | WP-TR-DOC-01 | 収穫markupがeditor warning 0 | 手書きinvalid blockをgateが拒否 | Playwright |
| WP-AT-POST-01 | WP-FR-POST-01 | 1要求から1投稿、証跡field完備 | timeout再確認後も重複0 | WP REST+receipt |
| WP-AT-POST-02 | WP-FR-POST-02 | 同一action承認時だけwrite | 未承認・期限切れ・digest違いを拒否 | approval audit |
| WP-AT-UI-01 | WP-FR-UI-01 | 実証跡で全状態を表示 | 空DBにdummy値0 | Playwright+screenshots |
| WP-AT-AUDIT-01 | WP-FR-AUDIT-01 | KWから外部結果まで全edge到達 | 存在しないevidence参照0 | trace graph |
| WP-AT-SEC-01 | WP-NFR-SEC-01 | 認証後least privilegeで利用可能 | 未認証、CSRF、private IP、secret出力を拒否 | security profile |
| WP-AT-REL-01 | WP-NFR-REL-01 | recovery後同一operation chainへ収束 | 不明応答を成功扱い・無条件再送しない | failure injection |
| WP-AT-PERF-01 | WP-NFR-PERF-01 | 指定workloadでp95 budget内 | dataset/環境欠落なら合格しない | performance report |
| WP-AT-COST-01 | WP-NFR-COST-01 | cacheと月次集計を再現 | 上限超過要求を外部送信前に拒否 | cost ledger |

各requirementに対応する`A`は正常系、`B`は拒否・境界系のacceptance IDとする。実装PLANはRed evidence、
expected failure、Green evidenceをこのTest IDへ束縛する。
