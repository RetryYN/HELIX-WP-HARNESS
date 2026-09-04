import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readXlsxKeywordSheet } from "./read-xlsx-keywords.mjs";

const root = mkdtempSync(path.join(tmpdir(), "keyword-metrics-test-"));
mkdirSync(path.join(root, "xl/worksheets"), { recursive: true });
writeFileSync(path.join(root, "xl/workbook.xml"), '<workbook><sheets><sheet name="test" sheetId="1"/></sheets></workbook>');
writeFileSync(path.join(root, "xl/sharedStrings.xml"), '<sst><si><t>検証</t></si></sst>');
writeFileSync(path.join(root, "xl/worksheets/sheet1.xml"), `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><v></v></c><c r="C2"><v> </v></c></row>
<row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3"><v>0</v></c><c r="C3"><v>0.25</v></c><c r="D3"><v>1</v></c></row>
</sheetData></worksheet>`);
const archive = path.join(root, "fixture.xlsx");
execFileSync("python3", ["-c", "import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],'w'); [z.write(p,p.relative_to(root)) for p in (root/'xl').rglob('*.xml')]; z.close()", root, archive]);
const rows = readXlsxKeywordSheet(archive, { sheetName: "test" });
assert.equal(rows[0].search_volume, null, "empty cached value must not become measured zero");
assert.equal(rows[0].cpc, null, "whitespace value must stay missing");
assert.equal(rows[0].competition, null, "absent cell stays missing");
assert.equal(rows[1].search_volume, 0);
assert.equal(rows[1].cpc, 0.25);
assert.equal(rows[1].competition, 1);
console.log("XLSX metrics: empty/whitespace/absent cells stay null; measured zero and decimals preserved");
