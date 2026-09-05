import assert from 'node:assert/strict';
import {renderKeywordMeaningReview} from './render-keyword-meaning-review.mjs';
const html=renderKeywordMeaningReview({packets:[],story:{interpretations:[],problem_clusters:[{id:'x',problem:'<script>alert(1)</script>',reader:'reader',answer_scope:'scope',interpretation_ids:[]}],story_transitions:[],relations:[]}});
assert(!html.includes('<script>'));
assert(html.includes('&lt;script&gt;'));
assert(html.includes("default-src 'none'"));
assert(html.includes('次の遷移は未設定'));
assert(html.includes('独立評価'));
console.log('meaning review rendering: OK (escaped text, no network/scripts, unresolved transitions explicit)');
