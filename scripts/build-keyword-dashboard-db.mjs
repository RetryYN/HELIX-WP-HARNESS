import { mkdirSync } from "node:fs";
import path from "node:path";
import { buildDashboardDb } from "./keyword-dashboard-db.mjs";
import { readXlsxKeywordSheet } from "./read-xlsx-keywords.mjs";

const dbPath = path.resolve(process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite");
mkdirSync(path.dirname(dbPath), { recursive: true });
const workbook=process.env.WP_KEYWORD_WORKBOOK??"/home/tenni/dev/poc-wp/data/IT就活大学キーワードマップ.xlsx";
const importedKeywords=readXlsxKeywordSheet(workbook,{sheetNumber:1,sheetName:"IT就活",limit:100}).map((row)=>({...row,site_id:"it-shukatu.com",source_keyword_id:`it-shukatu.com:IT就活:${row.source_row}`}));
const db = buildDashboardDb({ dbPath, fixturePath: path.resolve("docs/prototypes/wp-ops-dashboard/data.json"), artifactRoot: path.resolve("artifacts/poc"), importedKeywords });
const counts = Object.fromEntries(["sites", "imported_keywords", "keyword_groups", "dfs_tasks", "gate_runs", "article_links"].map((table) => [table, Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)]));
db.close();
console.log(JSON.stringify({ db_path: dbPath, ...counts }, null, 2));
