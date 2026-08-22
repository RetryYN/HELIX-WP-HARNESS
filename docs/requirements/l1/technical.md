---
layer: L1
sub_doc: technical
status: confirmed_input
pair_artifact: docs/test-design/l12-operational-value-test-design.md
authority: docs/requirements/authority.md
---

# L1 Technical Requirements

| ID | 技術境界 |
| --- | --- |
| WP-TRL1-01 | WP content writeはREST APIを第一経路、WP-CLIを補完経路とする |
| WP-TRL1-02 | 記事正本はschema version付き中間JSONとし、theme adapterがmarkupを決定論生成する |
| WP-TRL1-03 | 解析・gate・状態導出は同一入力から再現可能で、AI出力を判定正本にしない |
| WP-TRL1-04 | 外部データはstaging、schema/鮮度検査を経て解析正本へ昇格する |
| WP-TRL1-05 | UIの変更操作は状態を直接更新せず、append-only operationを記録する |
| WP-TRL1-06 | credentialはrepository、DB、証跡、応答へ保存しない |

PoCで成立した経路は`docs/poc/wp-poc-inventory.json`へdigest束縛する。PoC未検証の一般化は行わない。
