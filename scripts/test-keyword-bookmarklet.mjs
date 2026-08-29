import assert from "node:assert/strict";
import {buildQuickSearchBookmarklet} from "../docs/prototypes/wp-ops-dashboard/bookmarklet.mjs";

const href=buildQuickSearchBookmarklet({dashboardUrl:"http://127.0.0.1:4173/?old=1#x",siteId:"site-a.example"});
assert.ok(href.startsWith("javascript:"));
const source=decodeURIComponent(href.slice("javascript:".length));
assert.match(source,/getSelection/);assert.match(source,/document\.title/);assert.match(source,/quick_q/);assert.match(source,/quick-search/);assert.match(source,/it-shukatu\.com/);assert.doesNotMatch(source,/old=1/);
console.log("keyword bookmarklet: OK (selection/title fallback, site scope, dashboard route)");
