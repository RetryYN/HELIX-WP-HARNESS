import { mkdirSync } from "node:fs";
import path from "node:path";
import { buildDashboardDb } from "./keyword-dashboard-db.mjs";

const dbPath = path.resolve(process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite");
mkdirSync(path.dirname(dbPath), { recursive: true });
const db = buildDashboardDb({ dbPath, fixturePath: path.resolve("docs/prototypes/wp-ops-dashboard/data.json"), artifactRoot: path.resolve("artifacts/poc") });
const counts = Object.fromEntries(["sites", "keyword_groups", "dfs_tasks", "gate_runs", "article_links"].map((table) => [table, Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)]));
db.close();
console.log(JSON.stringify({ db_path: dbPath, ...counts }, null, 2));
