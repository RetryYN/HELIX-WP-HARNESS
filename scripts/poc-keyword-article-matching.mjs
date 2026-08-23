import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { matchKeywordGroupToArticles } from "./keyword-article-matching.mjs";

const db=openDashboardDb(process.env.WP_DASHBOARD_DB??".helix/keyword-dashboard.sqlite");
const dashboard=projectDashboard(db);db.close();
const siteId=process.env.WP_SITE_ID??"it-shukatu.com";
const groups=dashboard.groups.filter((group)=>group.site_id===siteId);
const articles=dashboard.article_query_summaries.filter((article)=>article.site_id===siteId);
const matches=groups.map((group)=>matchKeywordGroupToArticles(group,articles));
const counts=Object.fromEntries(["確定","タイトル一致のみ","競合","新規記事候補"].map((state)=>[state,matches.filter((match)=>match.state===state).length]));
console.log(JSON.stringify({site_id:siteId,groups:groups.length,articles:articles.length,counts,matches:matches.filter((match)=>match.state!=="新規記事候補")},null,2));
