import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Run only against a dedicated disposable browser, never a personal profile.
const [port, htmlPath] = process.argv.slice(2);
if (!/^\d+$/.test(port ?? "") || !htmlPath) throw new Error("Usage: browser-test PORT REVIEW.html (dedicated browser required)");
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((row) => row.type === "page" && row.url === "about:blank");
assert(target, "An unused about:blank target is required");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map(), requests = [], exceptions = [];
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
  if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
  if (message.id && pending.has(message.id)) {
    const entry = pending.get(message.id); pending.delete(message.id); clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
  }
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 15000);
  pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const value = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert(!value.exceptionDetails, "Browser evaluation failed"); return value.result.value;
};
try {
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable");
  const downloads = mkdtempSync(path.join(tmpdir(), "semantic-review-download-"));
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  await call("Page.navigate", { url: pathToFileURL(path.resolve(htmlPath)).href });
  for (let i = 0; i < 100; i++) {
    if (await evaluate("document.readyState==='complete' && !!document.querySelector('#save')")) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const count = await evaluate("document.querySelectorAll('[data-case]').length");
  assert(count > 0);
  for (const width of [1280, 390]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 });
    assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Horizontal overflow at ${width}px`);
    const columns = await evaluate("getComputedStyle(document.querySelector('.columns')).gridTemplateColumns.split(' ').length");
    assert.equal(columns, width < 700 ? 1 : 2);
  }
  await evaluate("document.querySelector('#save').click()");
  assert((await evaluate("document.querySelector('#status').textContent")).includes("識別子"));
  await evaluate("document.querySelector('#reviewer').value='automated-ui-test-not-human'; document.querySelector('[data-label]').value='insufficient_evidence'; document.querySelector('[data-rationale]').value='UI動作検証のみ。意味の正解ラベルではない。'; document.querySelector('#save').click()");
  const filename = path.join(downloads, "semantic-first-pass-annotations.json");
  for (let i = 0; i < 100 && !existsSync(filename); i++) await new Promise((resolve) => setTimeout(resolve, 50));
  const output = JSON.parse(readFileSync(filename, "utf8"));
  assert.equal(output.annotated_case_count, 1); assert.equal(output.total_case_count, count);
  assert.equal(output.annotations[0].reviewer, "automated-ui-test-not-human");
  assert.equal(output.gold_labels, false); assert.equal(output.accuracy_claim, "not_evaluated");
  assert.equal(exceptions.length, 0);
  assert(!requests.some((url) => /^https?:/i.test(url)), "Page triggered external HTTP traffic");
  console.log(`Chrome review UI: ${count} cases; desktop/mobile columns; no overflow; validation and real JSON download passed; no page HTTP traffic. Annotation is test-only.`);
} finally { socket.close(); }
