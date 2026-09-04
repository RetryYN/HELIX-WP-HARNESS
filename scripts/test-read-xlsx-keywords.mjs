import assert from "node:assert/strict";
import "./test-xlsx-empty-metrics.mjs";
import {existsSync} from "node:fs";
import path from "node:path";
import {listXlsxSheets,readXlsxKeywordWorkbook} from "./read-xlsx-keywords.mjs";
const file=path.resolve(process.env.WP_KEYWORD_WORKBOOK??"../poc-wp/data/サイトAキーワードマップ.xlsx");
if(!existsSync(file))throw new Error(`keyword workbook fixture missing: ${file}`);
const sheets=listXlsxSheets(file),rows=readXlsxKeywordWorkbook(file);assert.equal(sheets.length,15);assert.equal(rows.length,10694);assert.equal(new Set(rows.map((row)=>row.source_sheet)).size,15);assert.ok(rows.every((row)=>row.raw_keyword&&row.source_row>1));console.log("xlsx keyword workbook: OK (15 sheets / 10,694 non-empty keyword rows)");
