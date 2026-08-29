import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";
import {routeResearchApi} from "./keyword-dashboard-api.mjs";

const db=openDashboardDb(process.env.WP_DASHBOARD_DB??".helix/keyword-dashboard.sqlite");
try {
  const data=projectDashboard(db),siteId=data.sites[0].site_id;
  const expectedGroups=Number(db.prepare("SELECT COUNT(*) AS count FROM competitor_terms WHERE group_id IN (SELECT group_id FROM keyword_groups WHERE site_id=?)").get(siteId).count);
  const expectedTasks=Number(db.prepare("SELECT COUNT(*) AS count FROM competitor_task_terms WHERE task_id IN (SELECT task_id FROM data_provider_b_tasks JOIN keyword_groups USING(group_id) WHERE site_id=?)").get(siteId).count);
  const request=(suffix)=>{const url=new URL(`/api/v1/cooccurrence?site_id=${encodeURIComponent(siteId)}&limit=1${suffix}`,"http://localhost");return routeResearchApi(url.pathname,url,data,db)};
  const groups=request(""),tasks=request("&scope=task"),details=request("&details=true");
  assert.equal(groups.status,200);assert.equal(groups.body.meta.total,expectedGroups);assert.equal(groups.body.data.length,1);
  assert.equal(tasks.status,200);assert.equal(tasks.body.meta.total,expectedTasks);assert.equal(tasks.body.data.length,1);
  assert.ok(details.body.data[0].seo_tool_a_semantics.page_details.length>0);assert.equal(details.body.data[0].seo_tool_a_semantics.occurrence_page_count,details.body.data[0].total_count);assert.equal(details.body.data[0].seo_tool_a_semantics.site_count_total,new Set(details.body.data[0].seo_tool_a_semantics.page_details.map((row)=>row.domain)).size);assert.ok(details.body.data[0].seo_tool_a_semantics.page_details.every((row)=>row.page_count===1&&row.count>=0&&typeof row.in_heading==="boolean"));
  assert.ok(expectedGroups>data.competitor_terms.length,"full group API must exceed dashboard preview");
  assert.ok(expectedTasks>data.competitor_task_terms.length,"full task API must exceed dashboard preview");
  console.log(`cooccurrence full API: OK (group ${expectedGroups}, task ${expectedTasks}, URL-level term evidence and site counts)`);
} finally { db.close() }
