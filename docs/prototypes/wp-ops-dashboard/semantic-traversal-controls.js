const strategyControl = document.querySelector("#semantic-strategy");
const status = document.querySelector("#semantic-strategy-status");
const labels = {
  breadth_first: "幅優先（既定）",
  depth_first: "深さ優先（比較）",
};
const normalizeStrategy = (value) =>
  value === "depth_first" ? "depth_first" : "breadth_first";

const updateStatus = () => {
  const strategy = normalizeStrategy(strategyControl?.value);
  if (strategyControl) strategyControl.value = strategy;
  if (status) status.textContent = `探索方式: ${labels[strategy]}`;
  return strategy;
};

if (strategyControl) {
  updateStatus();
  strategyControl.addEventListener("change", () => {
    updateStatus();
    document
      .querySelector("#lexical-search")
      ?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const requestUrl = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
    location.origin,
  );
  if (requestUrl.pathname !== "/api/v1/public-semantic-graph")
    return nativeFetch(input, init);
  requestUrl.searchParams.set(
    "strategy",
    normalizeStrategy(strategyControl?.value),
  );
  return nativeFetch(requestUrl, init);
};
