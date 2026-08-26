import assert from "node:assert/strict";
import {resolveDashboardBind} from "./dashboard-bind-policy.mjs";

assert.deepEqual(resolveDashboardBind({}),{host:"127.0.0.1",allow_remote:false,exposure:"loopback_only"});
assert.throws(()=>resolveDashboardBind({WP_DASHBOARD_HOST:"0.0.0.0"}),/Refusing non-loopback/);
assert.throws(()=>resolveDashboardBind({WP_DASHBOARD_HOST:"dashboard.example"}),/Refusing non-loopback/);
assert.deepEqual(resolveDashboardBind({WP_DASHBOARD_HOST:"0.0.0.0",WP_DASHBOARD_ALLOW_REMOTE:"1"}),{host:"0.0.0.0",allow_remote:true,exposure:"explicit_remote_override"});
assert.throws(()=>resolveDashboardBind({WP_DASHBOARD_HOST:"dashboard.example",WP_DASHBOARD_ALLOW_REMOTE:"1"}),/IP literal/);
console.log("dashboard bind policy: OK (loopback default, explicit remote override required)");
