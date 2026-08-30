# 公開証跡 fixture の digest 方針

公開情報の伏せ字化に伴い、リポジトリ内に raw fixture が保持されている証跡は、既存の生成処理と同じアルゴリズムで digest を再計算した。対象は fixture tree、raw API response、SERP の再現性 digest、および構造化 manifest の親子 evidence digest である。

一方、次の digest は元データをリポジトリに保持しない設計のため、伏せ字化後の内容から再計算できない。元の digest は provenance anchor として変更せず保持している。

- 公開 HTML の document/title/head digest
- WordPress 本文・section・paragraph の digest
- robots と sitemap XML の source digest
- 外部 API の元 response や元 workbook に対する digest
- 過去期間の外部エクスポートに対する tree anchor

これらについて元データを推測したり、伏せ字化後のデータから別の値を捏造したりしていない。raw fixture が再取得される場合は、既存の生成スクリプトで新しい証跡一式を作成し、その時点の digest を付与する。

今回の伏せ字化では、保持された fixture と構造化 manifest から再計算可能な fixture tree、raw response、SERP 再現性、親子 evidence の digest を更新し、元データを保持しない document/title/head、本文・section・paragraph、robots・sitemap、外部 response・workbook、過去 export の tree anchor は provenance anchor として据え置いた。
