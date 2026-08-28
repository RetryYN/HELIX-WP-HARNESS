import assert from "node:assert/strict";
import {aggregateCompetitorTerms,contentTerms,parseCompetitorHtml} from "./competitor-content-core.mjs";

const html='<!doctype html><title>IT就活 &amp; 対策</title><body><header>menu</header><h1>IT業界の就職</h1><h2>文系学生の対策</h2><p>文系学生がIT業界へ就職する対策です。</p><a href="/inside">内部</a><a href="https://other.example/x">外部</a><script>secret()</script></body>';
const parsed=parseCompetitorHtml(html,"https://example.com/article");
assert.equal(parsed.title,"IT就活 & 対策");assert.deepEqual(parsed.headings.map((item)=>[item.level,item.text]),[[1,"IT業界の就職"],[2,"文系学生の対策"]]);assert.equal(parsed.internal_link_count,1);assert.equal(parsed.external_link_count,1);assert.doesNotMatch(parsed.text,/secret/);assert.match(parsed.text_digest,/^[a-f0-9]{64}$/);
const tokens=(text)=>text.match(/IT業界|文系学生|就職|対策|する/g)?.map((surface_form)=>({surface_form,basic_form:surface_form,pos:surface_form==="する"?"動詞":"名詞",pos_detail_1:"一般"}))??[];
const terms=contentTerms(parsed,tokens);assert.ok(terms.find((item)=>item.term==="対策"&&item.in_heading&&item.in_title&&item.count===2&&item.heading_count===1&&item.title_count===1));assert.ok(!terms.some((item)=>item.term==="する"),"function verbs must not pollute co-occurrence terms");
const aggregate=aggregateCompetitorTerms([{url:"https://a",best_rank:1,terms},{url:"https://b",best_rank:3,terms:[{term:"対策",count:4,title_count:0,heading_count:0,in_title:false,in_heading:false}]}]);
assert.equal(aggregate.find((item)=>item.term==="対策").page_count,2);assert.equal(aggregate.find((item)=>item.term==="対策").heading_page_count,1);assert.equal(aggregate.find((item)=>item.term==="対策").title_count,1);assert.deepEqual(aggregate.find((item)=>item.term==="対策").evidence_urls,["https://a","https://b"]);assert.ok(!aggregate.some((item)=>item.term==="IT業界"),"terms present on fewer than two pages must be excluded");
console.log("competitor content core: OK (heading/text/link parsing, Japanese term evidence, page-level aggregation)");
