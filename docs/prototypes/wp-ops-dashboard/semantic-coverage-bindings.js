// app.js is a generated bundle whose semantic-coverage handlers use these
// element bindings. Keep the bridge explicit so a missing legacy binding does
// not abort the rest of the dashboard during startup.
for (const [name, id] of [
  ["semanticCoverageGroup", "semantic-coverage-group"],
  ["semanticCoverageView", "semantic-coverage-view"],
  ["semanticCoverageType", "semantic-coverage-type"],
  ["semanticCoverageState", "semantic-coverage-state"],
]) {
  globalThis[name] = document.querySelector(`#${id}`);
}

// The rank-monitor preview renderer in the generated bundle also reads these
// optional metadata values. Resolve them from the controls while keeping the
// catalog check fail-closed, so the preview cannot claim a mapping that has
// not been verified.
const valueOf = (id) => document.querySelector(`#${id}`)?.value.trim() ?? "";
Object.defineProperties(globalThis, {
  previewLocationName: {
    configurable: true,
    get: () => valueOf("rank-monitor-location-name"),
  },
  previewLanguageName: {
    configurable: true,
    get: () => valueOf("rank-monitor-language-name"),
  },
});
globalThis.metadataValid = false;
