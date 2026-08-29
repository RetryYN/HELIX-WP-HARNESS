import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.data-provider-b.example/v3";
const outputDir = path.resolve("artifacts/poc/keyword-serp-intent-pair");
const login = process.env.DATA_PROVIDER_B_LOGIN;
const password = process.env.DATA_PROVIDER_B_PASSWORD;
if (!login || !password) throw new Error("DATA_PROVIDER_B_LOGIN and DATA_PROVIDER_B_PASSWORD are required");
const input = [
  { keyword: "it 就活サイト おすすめ", tag: "probe:it-job-site:recommended" },
  { keyword: "it 就活サイト 比較", tag: "probe:it-job-site:comparison" },
];
const auth = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
async function request(endpoint, init = {}) {
  const response = await fetch(`${API}${endpoint}`, { ...init, headers: { Authorization: auth, "Content-Type": "application/json" } });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.status_code !== 20000) throw new Error(`${endpoint}: API ${body.status_code} ${body.status_message}`);
  return body;
}
await mkdir(path.join(outputDir, "raw"), { recursive: true });
const posted = await request("/serp/google/organic/task_post", { method: "POST", body: JSON.stringify(input.map((row) => ({ keyword: row.keyword, tag: row.tag, location_code: 2392, language_code: "ja", device: "desktop", os: "windows", depth: 10 }))) });
const ids = posted.tasks.map((task) => task.id);
const done = new Set();
const deadline = Date.now() + 240_000;
while (done.size < ids.length && Date.now() < deadline) {
  for (const id of ids) {
    if (done.has(id)) continue;
    const body = await request(`/serp/google/organic/task_get/advanced/${id}`);
    if (!body.tasks?.[0]?.result) continue;
    await writeFile(path.join(outputDir, "raw", `${id}.json`), `${JSON.stringify(body, null, 2)}\n`);
    done.add(id);
  }
  if (done.size < ids.length) await new Promise((resolve) => setTimeout(resolve, 5000));
}
if (done.size !== ids.length) throw new Error(`timeout: ${done.size}/${ids.length}`);
console.log(JSON.stringify({ outputDir, tasks: done.size }, null, 2));
