# L12 Operational Value Test Design

| Test ID | Business requirement | measurement |
| --- | --- | --- |
| WP-OT-01 | WP-BR-01 | 通常運用taskのPO手作業時間、例外停止率、誤write件数を月次集計 |
| WP-OT-02 | WP-BR-02 | 引継ぎinventoryのcoverage、未決owner、rollback rehearsal |
| WP-OT-03 | WP-BR-03 | S4別sliceで新規siteを立上げ、theme接続と運用開始を検証 |
| WP-OT-04 | WP-BR-04 | production operationから要求・承認・結果へのtrace orphan 0 |
| WP-OT-05 | WP-BR-05 | 全対象siteの実測売上÷実測運用costが2以上を連続3か月 |

売上、費用、為替、返金、共通AI費用配賦の規則が未確定の間、WP-OT-05は測定不能としてpassを出さない。
