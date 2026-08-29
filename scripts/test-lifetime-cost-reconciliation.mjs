import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";

const db=openDashboardDb(".helix/keyword-dashboard.sqlite");
try{
  const site=projectDashboard(db).sites[0],state=site.acquisition_lifetime_state,ledger=site.provider_cost_ledger,reconciliation=ledger.reconciliation;
  assert.equal(state.legacy_committed_cost_usd,.2);
  assert.equal(state.run_committed_cost_usd,.1014);
  assert.equal(state.committed_cost_usd,.3014);
  assert.equal(state.remaining_budget_usd,4.6986);
  assert.equal(ledger.entry_count,197);
  assert.equal(ledger.total_cost_usd,.3014);
  assert.equal(reconciliation.state,"reconciled");
  assert.equal(reconciliation.difference_usd,0);
  assert.equal(reconciliation.analysis_retained_entry_count,100);
  assert.equal(reconciliation.replaced_legacy_entry_count,96);
  assert.equal(reconciliation.non_result_cost_entry_count,1);
  assert.equal(reconciliation.cost_history_retained_entry_count,197);
  assert(ledger.entries.every((row)=>row.source_digest?.length===64));
  assert.equal(site.acquisition_lifetime_approval_manifest.lifetime_budget.projected_maximum,4.99955);
  assert.equal(site.acquisition_lifetime_approval_manifest.execution_authorized,false);
  console.log("lifetime cost reconciliation: OK ($0.3014 committed across 197 lossless entries; $5 cap preserved)");
}finally{db.close()}
