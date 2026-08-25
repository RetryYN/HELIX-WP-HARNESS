import assert from "node:assert/strict";
import {aggregateCompetitorTerms,contentTerms,parseCompetitorHtml} from "./competitor-content-core.mjs";

const html='<!doctype html><title>IT就活 &amp; 対策</title><body><header>menu</header><h1>IT業界の就職</h1><h2>文系学生の対策</h2><p>文系学生がIT業界へ就職する対策です。</p><a href="/inside">内部</a><a href="https://other.example/x">外部</a><script>secret()</script></body>';
const parsed=parseCompetitorHtml(html,"https://example.com/article");
assert.equal(parsed.title,"IT就活 & 対策");assert.deepEqual(parsed.headings.map((item)=>[item.level,item.text]),[[1,"IT業界の就職"],[2,"文系学生の対策"]]);assert.equal(parsed.internal_link_count,1);assert.equal(parsed.external_link_count,1);assert.doesNotMatch(parsed.text,/secret/);assert.match(parsed.text_digest,/^[a-f0-9]{64}$/);
const tokens=(text)=>text.match(/IT業界|文系学生|就職|対策/g)?.map((surface_form)=>({surface_form,basic_form:surface_form,pos:"名詞",pos_detail_1:"一般"}))??[];
const terms=contentTerms(parsed,tokens);assert.ok(terms.find((item)=>item.term==="対策"&&item.in_heading&&item.count===2));
const aggregate=aggregateCompetitorTerms([{url:"https://a",best_rank:1,terms},{url:"https://b",best_rank:3,terms:[{term:"対策",count:4,in_heading:false}]}]);
assert.equal(aggregate.find((item)=>item.term==="対策").page_count,2);assert.equal(aggregate.find((item)=>item.term==="対策").heading_page_count,1);assert.deepEqual(aggregate.find((item)=>item.term==="対策").evidence_urls,["https://a","https://b"]);
console.log("competitor content core: OK (heading/text/link parsing, Japanese term evidence, page-level aggregation)");
