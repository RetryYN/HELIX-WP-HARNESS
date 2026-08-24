export const DIRECT_BRANCH = "__direct__";

export function mermaidLabel(value) {
  return String(value ?? "").replace(/["<>()\[\]{}]/g, " ").replace(/\s+/g, " ").trim();
}

export function branchForRow(row) {
  const branchIndex = row.context_scope_id === "context:it" ? 2 : 1;
  return row.tree_path[branchIndex] ?? DIRECT_BRANCH;
}

export function rankedBranches(rows) {
  const branches = new Map();
  for (const row of rows) {
    const key = branchForRow(row);
    const current = branches.get(key) ?? { key, count: 0, volume: 0 };
    current.count += 1;
    current.volume += Number(row.search_volume ?? 0);
    branches.set(key, current);
  }
  return [...branches.values()].sort((left, right) => right.count - left.count || right.volume - left.volume || left.key.localeCompare(right.key, "ja"));
}

export function buildMindmapSource(rows, formatNumber = (value) => String(value)) {
  const nodes = new Map();
  for (const row of rows) {
    for (let length = 1; length <= row.tree_path.length; length += 1) {
      const path = row.tree_path.slice(0, length);
      const key = path.join("\0");
      if (!nodes.has(key)) nodes.set(key, { key, path, rows: [] });
      if (length === row.tree_path.length) nodes.get(key).rows.push(row);
    }
  }
  const ordered = [...nodes.values()].sort((left, right) => left.path.length - right.path.length || left.key.localeCompare(right.key, "ja"));
  const roots = ordered.filter((node) => node.path.length === 1);
  if (roots.length !== 1) throw new Error(`mindmap requires exactly one root: ${roots.length}`);
  const children = new Map();
  for (const node of ordered.filter((item) => item.path.length > 1)) {
    const parent = node.path.slice(0, -1).join("\0");
    const items = children.get(parent) ?? [];
    items.push(node);
    children.set(parent, items);
  }
  const ids = new Map(ordered.map((node, index) => [node.key, `mm${index}`]));
  const lines = ["mindmap"];
  function appendNode(node, depth) {
    const actual = node.rows;
    const volume = actual.reduce((sum, row) => sum + Number(row.search_volume ?? 0), 0);
    const label = `${actual.length ? "" : "◇ "}${mermaidLabel(node.path.at(-1))}${actual.length ? ` · ${formatNumber(volume)}` : " · 導出"}`;
    const shape = depth === 1 ? `((${label}))` : `[${label}]`;
    lines.push(`${"  ".repeat(depth)}${ids.get(node.key)}${shape}`);
    for (const child of (children.get(node.key) ?? []).sort((left, right) => left.key.localeCompare(right.key, "ja"))) appendNode(child, depth + 1);
  }
  appendNode(roots[0], 1);
  return { source: lines.join("\n"), nodes: ordered };
}
