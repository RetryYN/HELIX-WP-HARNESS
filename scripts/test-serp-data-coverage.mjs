import assert from "node:assert/strict";
import { auditSerpDataCoverage } from "./audit-serp-data-coverage.mjs";

const audit=auditSerpDataCoverage();
assert.equal(audit.raw_files,100);
assert.equal(audit.item_type_counts.organic,926);
assert.equal(audit.item_type_counts.people_also_ask,99);
assert.equal(audit.item_type_counts.related_searches,99);
assert.equal(audit.item_type_counts.ai_overview,68);
assert.equal(audit.acquired_but_empty_or_incomplete.paa_questions,396);
assert.equal(audit.acquired_but_empty_or_incomplete.paa_answer_items,0,"PAA questions are present but answers were not expanded/acquired");
assert.equal(audit.acquired_but_empty_or_incomplete.aio_items,69);
assert.equal(audit.acquired_but_empty_or_incomplete.aio_references,96);
assert.ok(audit.captured_raw_only.some((row)=>row.field==="organic.description"&&row.nonempty_count===918),"organic descriptions currently remain raw-only");
assert.ok(audit.captured_raw_only.some((row)=>row.field==="ai_overview.markdown"&&row.nonempty_count===17),"AIO text currently remains raw-only");
assert.ok(audit.not_acquired.some((row)=>row.dataset==="competitor H1-H6/body/link graph"));
console.log("SERP data coverage audit: OK (projected vs raw-only vs not-acquired are explicit)");
