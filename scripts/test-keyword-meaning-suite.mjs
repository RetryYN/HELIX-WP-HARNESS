import {spawnSync} from 'node:child_process';
const tests=['test-keyword-meaning-evidence.mjs','test-keyword-meaning-story.mjs','test-keyword-meaning-store.mjs','test-keyword-article-routing.mjs','test-keyword-story-article-plan.mjs','test-render-keyword-meaning-review.mjs','test-keyword-benchmark-headings.mjs'];
for(const test of tests){const r=spawnSync(process.execPath,[`scripts/${test}`],{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);}
const python=spawnSync('python3',['-B','scripts/test-benchmark-heading-regions.py'],{stdio:'inherit'});
if(python.error)throw python.error;
if(python.status!==0)process.exit(python.status??1);
console.log(`keyword meaning suite: all ${tests.length+1} test programs passed; semantic quality remains unverified`);
