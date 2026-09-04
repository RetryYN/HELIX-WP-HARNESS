import { existsSync, readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultRawRoots = [
  "keyword-workbook-100-live",
  "keyword-serp",
  "keyword-serp-intent-pair",
].map((dataset) => path.resolve(repoRoot, `artifacts/poc/${dataset}/raw`));
const stateKeys = ["nonempty", "empty", "null", "zero", "false"];
const newStateCounts = () =>
  Object.fromEntries(stateKeys.map((state) => [state, 0]));
const stateOf = (value) => {
  if (value === undefined) return null;
  if (value === null) return "null";
  if (value === "") return "empty";
  if (value === 0) return "zero";
  if (value === false) return "false";
  if (Array.isArray(value)) return value.length ? null : "empty";
  if (value && typeof value === "object")
    return Object.keys(value).length ? null : "empty";
  return "nonempty";
};
const exactStates = new Set([
  "exact_structured",
  "exact_json_column",
  "exact_feature_payload",
  "exact_inventory_projection",
  "exact_raw_snapshot_payload",
]);

const walkLeaves = (value, prefix, callback) => {
  const state = stateOf(value);
  if (state) callback(prefix, value, state);
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    for (const item of value)
      walkLeaves(item, `${prefix}[]`, callback);
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, item] of Object.entries(value))
    walkLeaves(item, `${prefix}.${key}`, callback);
};

const tableCount = (db, table) =>
  Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
const key = (...parts) => parts.map((part) => String(part ?? "")).join("\0");
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, item]) => [name, canonical(item)]),
    );
  return value;
};
const sameValue = (left, right) =>
  JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const rawEntries = (rawRoots) => {
  const roots = (Array.isArray(rawRoots) ? rawRoots : [rawRoots]).map((root) =>
    path.resolve(root),
  );
  return {
    roots,
    entries: roots.flatMap((root) => {
      if (!existsSync(root)) return [];
      return readdirSync(root)
        .filter((name) => name.endsWith(".json"))
        .sort()
        .map((name) => ({
          root,
          name,
          file: path.join(root, name),
          dataset: path.basename(path.dirname(root)),
        }));
    }),
  };
};

const connectedTaskFields = new Set([
  "task.id",
  "task.status_code",
  "task.status_message",
  "task.time",
  "task.cost",
  "task.result_count",
  "task.path",
  "task.data",
  "result.keyword",
  "result.type",
  "result.se_domain",
  "result.location_code",
  "result.language_code",
  "result.check_url",
  "result.datetime",
  "result.spell",
  "result.refinement_chips",
  "result.item_types",
  "result.se_results_count",
  "result.pages_count",
  "result.items_count",
]);
const connectedOrganicFields = new Set([
  "organic.type",
  "organic.rank_group",
  "organic.rank_absolute",
  "organic.page",
  "organic.position",
  "organic.xpath",
  "organic.domain",
  "organic.title",
  "organic.url",
  "organic.breadcrumb",
  "organic.website_name",
  "organic.description",
  "organic.pre_snippet",
  "organic.timestamp",
  "organic.is_image",
  "organic.is_video",
  "organic.is_featured_snippet",
  "organic.is_malicious",
  "organic.is_web_story",
  "organic.amp_version",
  "organic.checks",
  "organic.highlighted",
  "organic.links",
  "organic.rating",
  "organic.price",
]);
const unconnectedInventoryFields = new Set([
  "task.id",
  "task.cost",
  "task.data.keyword",
  "result.keyword",
  "result.datetime",
  "result.item_types",
]);
const unconnectedOrganicFields = new Set([
  "organic.rank_absolute",
  "organic.domain",
  "organic.title",
  "organic.url",
]);
const jsonColumnPrefix = (field, prefixes) =>
  prefixes.some((prefix) => field === prefix || field.startsWith(`${prefix}.`) || field.startsWith(`${prefix}[]`));

const rawFieldProjection = (field, scope, context, dbState) => {
  if (context.itemType && context.itemType !== "organic") {
    return dbState.featurePayloadKeys.has(
      key(context.taskId, context.featureOrder),
    )
      ? {
          retention_state: "exact_feature_payload",
          source_tables: ["raw_snapshot_feature_evidence"],
          storage_kind: "payload_json",
          reason: "non-organic item payload is retained verbatim in the raw feature evidence table",
        }
      : dbState.rawPayloadKeys.has(context.taskId)
        ? {
            retention_state: "exact_raw_snapshot_payload",
            source_tables: ["raw_snapshot_payloads"],
            storage_kind: "raw_json",
            reason: "non-organic item is retained in the verbatim raw snapshot payload",
          }
        : {
            retention_state: "projection_gap",
            source_tables: ["raw_snapshot_feature_evidence"],
            storage_kind: "missing_payload_row",
            reason: "raw non-organic item has no matching retained feature-evidence row",
          };
  }

  if (field.startsWith("organic.")) {
    const rowKey = key(context.taskId, context.rankAbsolute);
    if (scope === "connected") {
      if (!dbState.connectedOrganicKeys.has(rowKey))
        return {
          retention_state: "projection_gap",
          source_tables: ["serp_organic_results"],
          storage_kind: "missing_structured_row",
          reason: "connected organic result has no matching structured row",
        };
      const organicJsonField = jsonColumnPrefix(field, [
        "organic.highlighted",
        "organic.links",
        "organic.rating",
        "organic.price",
        "organic.checks",
      ]);
      if (connectedOrganicFields.has(field) || organicJsonField)
        return {
          retention_state: organicJsonField
            ? "exact_json_column"
            : "exact_structured",
          source_tables: ["serp_organic_results", "serp_organic_attributes"],
          storage_kind: "structured_columns_or_json_columns",
          reason: "connected organic result is represented by the SERP result and attribute rows",
        };
      return dbState.rawPayloadKeys.has(context.taskId)
        ? {
            retention_state: "exact_raw_snapshot_payload",
            source_tables: ["raw_snapshot_payloads"],
            storage_kind: "raw_json",
            reason: "connected organic field is retained in the verbatim raw snapshot payload",
          }
        : {
            retention_state: "not_retained",
            source_tables: ["serp_organic_results", "serp_organic_attributes"],
            storage_kind: "no_column",
            reason: "raw organic field has no corresponding connected-result column",
          };
    }
    if (unconnectedOrganicFields.has(field)) {
      if (!dbState.snapshotOrganicKeys.has(rowKey))
        return {
          retention_state: "projection_gap",
          source_tables: ["serp_snapshot_organic_observations"],
          storage_kind: "missing_snapshot_row",
          reason: "unconnected organic result has no matching retained snapshot row",
        };
      return {
        retention_state: "exact_inventory_projection",
        source_tables: ["serp_snapshot_organic_observations"],
        storage_kind: "snapshot_observation_columns",
        reason: "unconnected snapshots retain only rank, domain, title and URL for organic rows",
      };
    }
    if (field === "organic.type" && !dbState.rawPayloadKeys.has(context.taskId))
      return {
        retention_state: "implicit_context",
        source_tables: ["serp_snapshot_organic_observations"],
        storage_kind: "table_identity",
        reason: "snapshot table identity is organic, but the raw type value is not stored as a column",
      };
    return dbState.rawPayloadKeys.has(context.taskId)
      ? {
          retention_state: "exact_raw_snapshot_payload",
          source_tables: ["raw_snapshot_payloads"],
          storage_kind: "raw_json",
          reason: "unconnected organic field is retained in the verbatim raw snapshot payload",
        }
      : {
          retention_state: "not_retained",
          source_tables: ["serp_snapshot_organic_observations"],
          storage_kind: "limited_snapshot_projection",
          reason: "unconnected organic snapshot projection does not retain this field",
        };
  }

  if (field.startsWith("task.") || field.startsWith("result.")) {
    if (scope === "connected") {
      if (!dbState.connectedTaskIds.has(context.taskId))
        return {
          retention_state: "projection_gap",
          source_tables: ["serp_task_metadata"],
          storage_kind: "missing_metadata_row",
          reason: "connected task has no matching task metadata row",
        };
      if (
        field.startsWith("task.data.") ||
        field === "task.data" ||
        field === "task.path" ||
        field.startsWith("task.path[]") ||
        field.startsWith("result.spell") ||
        field.startsWith("result.refinement_chips") ||
        field === "result.item_types" ||
        field.startsWith("result.item_types[]")
      )
        return {
          retention_state: "exact_json_column",
          source_tables: ["serp_task_metadata"],
          storage_kind: "json_column",
          reason: "task/result JSON payload is retained in task metadata JSON columns",
        };
      if (connectedTaskFields.has(field))
        return {
          retention_state: "exact_structured",
          source_tables: ["data_provider_b_tasks", "serp_task_metadata"],
          storage_kind: "structured_columns",
          reason: "task/result scalar is retained in the connected task or metadata row",
        };
      return dbState.rawPayloadKeys.has(context.taskId)
        ? {
            retention_state: "exact_raw_snapshot_payload",
            source_tables: ["raw_snapshot_payloads"],
            storage_kind: "raw_json",
            reason: "connected task/result field is retained in the verbatim raw snapshot payload",
          }
        : {
            retention_state: "not_retained",
            source_tables: ["data_provider_b_tasks", "serp_task_metadata"],
            storage_kind: "no_column",
            reason: "connected task/result field has no corresponding scalar or JSON column",
          };
    }
    if (unconnectedInventoryFields.has(field))
      return {
        retention_state: "exact_inventory_projection",
        source_tables: ["raw_snapshot_inventory"],
        storage_kind: "inventory_columns",
        reason: "unconnected snapshots retain only task identity, keyword, time, cost and item-type inventory",
      };
    return dbState.rawPayloadKeys.has(context.taskId)
      ? {
          retention_state: "exact_raw_snapshot_payload",
          source_tables: ["raw_snapshot_payloads"],
          storage_kind: "raw_json",
          reason: "unconnected task/result field is retained in the verbatim raw snapshot payload",
        }
      : {
          retention_state: "not_retained",
          source_tables: ["raw_snapshot_inventory"],
          storage_kind: "no_metadata_row",
          reason: "unconnected snapshots do not receive the connected task metadata projection",
        };
  }

  return {
    retention_state: "not_retained",
    source_tables: [],
    storage_kind: "unmapped",
    reason: "raw field is outside the known SERP retention projections",
  };
};

export function auditSerpDbRetention({
  dbPath = path.resolve(process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite"),
  rawRoots = defaultRawRoots,
} = {}) {
  const { roots, entries } = rawEntries(rawRoots);
  if (!existsSync(dbPath))
    throw new Error(`dashboard DB is required for raw-to-DB retention audit: ${dbPath}`);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const inventoryRows = db.prepare("SELECT task_id,keyword,cost,observed_at,item_types_json FROM raw_snapshot_inventory").all();
    const connectedRows = db.prepare("SELECT task_id FROM data_provider_b_tasks").all();
    const metadataRows = db.prepare("SELECT task_id FROM serp_task_metadata").all();
    const connectedOrganicRows = db.prepare("SELECT task_id,rank_absolute FROM serp_organic_results").all();
    const connectedOrganicDataRows = db
      .prepare(
        "SELECT r.*,a.type AS attribute_type,a.xpath AS attribute_xpath,a.is_image,a.is_video,a.is_featured_snippet,a.is_malicious,a.is_web_story,a.amp_version,a.checks_json FROM serp_organic_results r JOIN serp_organic_attributes a USING(task_id,rank_absolute)",
      )
      .all();
    const snapshotOrganicRows = db.prepare("SELECT task_id,rank_absolute FROM serp_snapshot_organic_observations").all();
    const rawPayloadRows = db
      .prepare(
        "SELECT task_id,payload_json,payload_digest,payload_bytes,storage_policy FROM raw_snapshot_payloads",
      )
      .all();
    const featureRows = db
      .prepare(
        "SELECT task_id,occurrence_order,payload_json FROM raw_snapshot_feature_evidence",
      )
      .all();
    const dbState = {
      inventoryById: new Map(inventoryRows.map((row) => [row.task_id, row])),
      connectedTaskIds: new Set(connectedRows.map((row) => row.task_id)),
      connectedOrganicKeys: new Set(
        connectedOrganicRows.map((row) => key(row.task_id, row.rank_absolute)),
      ),
      snapshotOrganicKeys: new Set(
        snapshotOrganicRows.map((row) => key(row.task_id, row.rank_absolute)),
      ),
      featurePayloadKeys: new Set(
        featureRows.map((row) => key(row.task_id, row.occurrence_order)),
      ),
      rawPayloadKeys: new Set(rawPayloadRows.map((row) => row.task_id)),
      rawPayloadById: new Map(rawPayloadRows.map((row) => [row.task_id, row])),
      featurePayloadByKey: new Map(
        featureRows.map((row) => [
          key(row.task_id, row.occurrence_order),
          JSON.parse(row.payload_json),
        ]),
      ),
      connectedOrganicByKey: new Map(
        connectedOrganicDataRows.map((row) => [
          key(row.task_id, row.rank_absolute),
          row,
        ]),
      ),
      metadataTaskIds: new Set(metadataRows.map((row) => row.task_id)),
    };
    const taskScopes = new Map();
    const duplicateTaskIds = [];
    const taskRecords = new Map();
    let rawPayloadDigestMismatchCount = 0,
      rawPayloadBytesMismatchCount = 0,
      featurePayloadValueMismatchCount = 0,
      connectedOrganicValueMismatchCount = 0,
      unconnectedOrganicValueMismatchCount = 0;
    const datasetCounts = new Map();
    const fieldRows = new Map();
    const scopeSummary = new Map(
      ["connected", "unconnected"].map((scope) => [
        scope,
        {
          scope,
          task_ids: new Set(),
          fields: new Set(),
          raw_observation_count: 0,
          raw_nonempty_observation_count: 0,
          exact_retained_observation_count: 0,
          contextual_observation_count: 0,
          not_retained_observation_count: 0,
          not_retained_nonempty_observation_count: 0,
          projection_gap_observation_count: 0,
        },
      ]),
    );
    const addFieldObservation = (scope, field, state, projection, taskId) => {
      const rowKey = key(scope, field);
      const row =
        fieldRows.get(rowKey) ??
        {
          scope,
          field,
          raw_observation_count: 0,
          raw_nonempty_observation_count: 0,
          retained_observation_count: 0,
          retained_nonempty_observation_count: 0,
          contextual_observation_count: 0,
          not_retained_observation_count: 0,
          not_retained_nonempty_observation_count: 0,
          projection_gap_observation_count: 0,
          state_counts: newStateCounts(),
          retention_states: new Set(),
          source_tables: new Set(),
          storage_kinds: new Set(),
          reasons: new Set(),
          example_task_ids: new Set(),
        };
      row.raw_observation_count += 1;
      row.raw_nonempty_observation_count += Number(state === "nonempty");
      row.state_counts[state] += 1;
      row.retention_states.add(projection.retention_state);
      for (const table of projection.source_tables) row.source_tables.add(table);
      row.storage_kinds.add(projection.storage_kind);
      row.reasons.add(projection.reason);
      if (row.example_task_ids.size < 5) row.example_task_ids.add(taskId);
      if (exactStates.has(projection.retention_state)) {
        row.retained_observation_count += 1;
        row.retained_nonempty_observation_count += Number(state === "nonempty");
      } else if (projection.retention_state === "implicit_context") {
        row.contextual_observation_count += 1;
      } else if (projection.retention_state === "projection_gap") {
        row.projection_gap_observation_count += 1;
      } else {
        row.not_retained_observation_count += 1;
        row.not_retained_nonempty_observation_count += Number(state === "nonempty");
      }
      fieldRows.set(rowKey, row);
      const summary = scopeSummary.get(scope);
      summary.fields.add(field);
      summary.raw_observation_count += 1;
      summary.raw_nonempty_observation_count += Number(state === "nonempty");
      if (exactStates.has(projection.retention_state)) {
        summary.exact_retained_observation_count += 1;
      } else if (projection.retention_state === "implicit_context") {
        summary.contextual_observation_count += 1;
      } else if (projection.retention_state === "projection_gap") {
        summary.projection_gap_observation_count += 1;
      } else {
        summary.not_retained_observation_count += 1;
        summary.not_retained_nonempty_observation_count += Number(state === "nonempty");
      }
    };
    const parseRawTask = (entry) => {
      const body = JSON.parse(readFileSync(entry.file, "utf8"));
      const task = body.tasks?.[0];
      const result = task?.result?.[0];
      if (!task || !result || !task.id) return null;
      if (taskRecords.has(task.id)) {
        duplicateTaskIds.push(task.id);
        return null;
      }
      taskRecords.set(task.id, entry.file);
      const scope = dbState.connectedTaskIds.has(task.id)
        ? "connected"
        : "unconnected";
      const rawPayload = dbState.rawPayloadById.get(task.id);
      if (
        !rawPayload ||
        rawPayload.payload_digest !==
          createHash("sha256").update(readFileSync(entry.file)).digest("hex") ||
        rawPayload.payload_digest !==
          createHash("sha256").update(rawPayload.payload_json, "utf8").digest("hex")
      )
        rawPayloadDigestMismatchCount += 1;
      if (
        !rawPayload ||
        Number(rawPayload.payload_bytes) !==
          Buffer.byteLength(rawPayload.payload_json ?? "", "utf8")
      )
        rawPayloadBytesMismatchCount += 1;
      taskScopes.set(task.id, scope);
      scopeSummary.get(scope).task_ids.add(task.id);
      datasetCounts.set(entry.dataset, (datasetCounts.get(entry.dataset) ?? 0) + 1);
      let featureOrder = 0;
      for (const [name, value] of Object.entries(task)) {
        if (name === "result") continue;
        walkLeaves(value, `task.${name}`, (field, _value, state) => {
          const projection = rawFieldProjection(field, scope, { taskId: task.id }, dbState);
          addFieldObservation(scope, field, state, projection, task.id);
        });
      }
      for (const [name, value] of Object.entries(result)) {
        if (name === "items") continue;
        walkLeaves(value, `result.${name}`, (field, _value, state) => {
          const projection = rawFieldProjection(field, scope, { taskId: task.id }, dbState);
          addFieldObservation(scope, field, state, projection, task.id);
        });
      }
      for (const item of result.items ?? []) {
        const context = {
          taskId: task.id,
          itemType: item.type,
          featureOrder: item.type === "organic" ? null : featureOrder++,
          rankAbsolute: item.rank_absolute,
        };
        walkLeaves(item, item.type, (field, _value, state) => {
          const projection = rawFieldProjection(field, scope, context, dbState);
          addFieldObservation(scope, field, state, projection, task.id);
        });
        if (item.type !== "organic") {
          const retained = dbState.featurePayloadByKey.get(
            key(task.id, context.featureOrder),
          );
          if (retained !== undefined && !sameValue(item, retained))
            featurePayloadValueMismatchCount += 1;
        } else if (scope === "connected") {
          const retained = dbState.connectedOrganicByKey.get(
            key(task.id, item.rank_absolute),
          );
          if (retained) {
            const expected = {
              rank_group: item.rank_group,
              rank_absolute: item.rank_absolute,
              page: item.page,
              position: item.position ?? null,
              domain: item.domain,
              title: item.title,
              url: item.url,
              breadcrumb: item.breadcrumb ?? null,
              website_name: item.website_name ?? null,
              description: item.description ?? null,
              pre_snippet: item.pre_snippet ?? null,
              published_at: item.timestamp ?? null,
              highlighted: item.highlighted ?? [],
              links: item.links ?? [],
              rating: item.rating ?? null,
              price: item.price ?? null,
              attribute_type: item.type,
              attribute_xpath: item.xpath ?? null,
              is_image: Number(item.is_image ?? false),
              is_video: Number(item.is_video ?? false),
              is_featured_snippet: Number(item.is_featured_snippet ?? false),
              is_malicious: Number(item.is_malicious ?? false),
              is_web_story: Number(item.is_web_story ?? false),
              amp_version: item.amp_version ?? null,
              checks: item.checks ?? null,
            };
            let actual;
            try {
              actual = {
                rank_group: retained.rank_group,
                rank_absolute: retained.rank_absolute,
                page: retained.page,
                position: retained.position,
                domain: retained.domain,
                title: retained.title,
                url: retained.url,
                breadcrumb: retained.breadcrumb,
                website_name: retained.website_name,
                description: retained.description,
                pre_snippet: retained.pre_snippet,
                published_at: retained.published_at,
                highlighted: JSON.parse(retained.highlighted_json),
                links: JSON.parse(retained.links_json),
                rating:
                  retained.rating_json == null
                    ? null
                    : JSON.parse(retained.rating_json),
                price:
                  retained.price_json == null
                    ? null
                    : JSON.parse(retained.price_json),
                attribute_type: retained.attribute_type,
                attribute_xpath: retained.attribute_xpath,
                is_image: retained.is_image,
                is_video: retained.is_video,
                is_featured_snippet: retained.is_featured_snippet,
                is_malicious: retained.is_malicious,
                is_web_story: retained.is_web_story,
                amp_version:
                  retained.amp_version == null
                    ? null
                    : JSON.parse(retained.amp_version),
                checks:
                  retained.checks_json == null
                    ? null
                    : JSON.parse(retained.checks_json),
              };
            } catch {
              actual = null;
            }
            if (!actual || !sameValue(expected, actual))
              connectedOrganicValueMismatchCount += 1;
          }
        } else {
          const retained = dbState.snapshotOrganicKeys.has(
            key(task.id, item.rank_absolute),
          );
          if (!retained) unconnectedOrganicValueMismatchCount += 1;
        }
      }
      return { task, result, scope, entry };
    };
    const rawTasks = entries.map(parseRawTask).filter(Boolean);
    const inventoryTaskIds = new Set(inventoryRows.map((row) => row.task_id));
    const rawTaskIds = new Set(taskRecords.keys());
    const rawPayloadOrphanCount = rawPayloadRows.filter(
      (row) => !rawTaskIds.has(row.task_id),
    ).length;
    const missingInventoryTaskIds = [...rawTaskIds].filter(
      (taskId) => !inventoryTaskIds.has(taskId),
    );
    const missingConnectedMetadataTaskIds = [...dbState.connectedTaskIds].filter(
      (taskId) => !dbState.metadataTaskIds.has(taskId),
    );
    const expectedConnectedOrganic = rawTasks.reduce(
      (count, row) =>
        count +
        (row.scope === "connected"
          ? (row.result.items ?? []).filter((item) => item.type === "organic").length
          : 0),
      0,
    );
    const expectedUnconnectedOrganic = rawTasks.reduce(
      (count, row) =>
        count +
        (row.scope === "unconnected"
          ? (row.result.items ?? []).filter((item) => item.type === "organic").length
          : 0),
      0,
    );
    const expectedFeatureItems = rawTasks.reduce(
      (count, row) =>
        count + (row.result.items ?? []).filter((item) => item.type !== "organic").length,
      0,
    );
    const retainedUnconnectedOrganicRows = snapshotOrganicRows.filter(
      (row) => !dbState.connectedTaskIds.has(row.task_id),
    ).length;
    const scopeRows = [...scopeSummary.values()].map((row) => ({
      scope: row.scope,
      task_count: row.task_ids.size,
      field_count: row.fields.size,
      raw_observation_count: row.raw_observation_count,
      raw_nonempty_observation_count: row.raw_nonempty_observation_count,
      exact_retained_observation_count: row.exact_retained_observation_count,
      contextual_observation_count: row.contextual_observation_count,
      not_retained_observation_count: row.not_retained_observation_count,
      not_retained_nonempty_observation_count: row.not_retained_nonempty_observation_count,
      projection_gap_observation_count: row.projection_gap_observation_count,
      exact_retention_ratio:
        row.raw_observation_count > 0
          ? row.exact_retained_observation_count / row.raw_observation_count
          : null,
      nonempty_drop_ratio:
        row.raw_nonempty_observation_count > 0
          ? row.not_retained_nonempty_observation_count /
            row.raw_nonempty_observation_count
          : null,
    }));
    const rows = [...fieldRows.values()]
      .map((row) => {
        const retentionStates = [...row.retention_states];
        const severity =
          row.projection_gap_observation_count > 0
            ? "projection_gap"
            : row.not_retained_nonempty_observation_count > 0
              ? "dropped_nonempty"
              : row.not_retained_observation_count > 0
                ? "state_only_dropped"
                : row.contextual_observation_count > 0 && row.retained_observation_count === 0
                  ? "implicit_context_only"
                  : "retained";
        return {
          scope: row.scope,
          field: row.field,
          retention_state:
            retentionStates.length === 1 ? retentionStates[0] : "mixed",
          severity,
          raw_observation_count: row.raw_observation_count,
          raw_nonempty_observation_count: row.raw_nonempty_observation_count,
          retained_observation_count: row.retained_observation_count,
          retained_nonempty_observation_count: row.retained_nonempty_observation_count,
          contextual_observation_count: row.contextual_observation_count,
          not_retained_observation_count: row.not_retained_observation_count,
          not_retained_nonempty_observation_count: row.not_retained_nonempty_observation_count,
          projection_gap_observation_count: row.projection_gap_observation_count,
          state_counts: row.state_counts,
          source_tables: [...row.source_tables].sort(),
          storage_kinds: [...row.storage_kinds].sort(),
          reasons: [...row.reasons].sort(),
          example_task_ids: [...row.example_task_ids].sort(),
        };
      })
      .sort(
        (left, right) =>
          Number(right.not_retained_nonempty_observation_count > 0) -
            Number(left.not_retained_nonempty_observation_count > 0) ||
          Number(right.projection_gap_observation_count > 0) -
            Number(left.projection_gap_observation_count > 0) ||
          left.scope.localeCompare(right.scope) ||
          left.field.localeCompare(right.field, "ja-JP"),
      );
    const allSummary = scopeRows.reduce(
      (total, row) => {
        for (const field of [
          "task_count",
          "raw_observation_count",
          "raw_nonempty_observation_count",
          "exact_retained_observation_count",
          "contextual_observation_count",
          "not_retained_observation_count",
          "not_retained_nonempty_observation_count",
          "projection_gap_observation_count",
        ])
          total[field] += row[field];
        return total;
      },
      {
        scope: "all",
        task_count: 0,
        field_count: 0,
        raw_observation_count: 0,
        raw_nonempty_observation_count: 0,
        exact_retained_observation_count: 0,
        contextual_observation_count: 0,
        not_retained_observation_count: 0,
        not_retained_nonempty_observation_count: 0,
        projection_gap_observation_count: 0,
      },
    );
    allSummary.field_count = new Set(rows.map((row) => row.field)).size;
    allSummary.exact_retention_ratio =
      allSummary.raw_observation_count > 0
        ? allSummary.exact_retained_observation_count /
          allSummary.raw_observation_count
        : null;
    allSummary.nonempty_drop_ratio =
      allSummary.raw_nonempty_observation_count > 0
        ? allSummary.not_retained_nonempty_observation_count /
          allSummary.raw_nonempty_observation_count
        : null;
    const databaseCounts = Object.fromEntries(
      [
        "raw_snapshot_inventory",
        "raw_snapshot_feature_evidence",
        "raw_snapshot_payloads",
        "raw_snapshot_demand_observations",
        "serp_snapshot_organic_observations",
        "data_provider_b_tasks",
        "serp_task_metadata",
        "serp_organic_results",
        "serp_organic_attributes",
        "serp_feature_occurrences",
        "serp_ai_overviews",
      ].map((table) => [table, tableCount(db, table)]),
    );
    const audit = {
      schema_version: "serp-db-retention-audit.v1",
      raw_files: entries.length,
      raw_tasks: rawTaskIds.size,
      duplicate_task_ids: duplicateTaskIds,
      raw_dataset_summary: roots.map((root) => ({
        dataset: path.basename(path.dirname(root)),
        root: path.relative(repoRoot, root),
        file_count: entries.filter((entry) => entry.root === root).length,
      })),
      database_counts: databaseCounts,
      scope_summary: [allSummary, ...scopeRows],
      field_rows: rows,
      dropped_field_rows: rows.filter(
        (row) =>
          row.not_retained_observation_count > 0 ||
          row.projection_gap_observation_count > 0,
      ),
      integrity: {
        inventory_task_count: inventoryTaskIds.size,
        connected_task_count: dbState.connectedTaskIds.size,
        unconnected_task_count: inventoryRows.filter(
          (row) => !dbState.connectedTaskIds.has(row.task_id),
        ).length,
        missing_inventory_task_ids: missingInventoryTaskIds,
        missing_connected_metadata_task_ids: missingConnectedMetadataTaskIds,
        expected_connected_organic_rows: expectedConnectedOrganic,
        retained_connected_organic_rows: connectedOrganicRows.length,
        expected_unconnected_organic_rows: expectedUnconnectedOrganic,
        retained_unconnected_organic_rows: retainedUnconnectedOrganicRows,
        expected_feature_payload_rows: expectedFeatureItems,
        retained_feature_payload_rows: featureRows.length,
        expected_raw_payload_rows: rawTaskIds.size,
        retained_raw_payload_rows: rawPayloadRows.length,
        raw_payload_row_gap_count: rawTaskIds.size - rawPayloadRows.length,
        raw_payload_orphan_count: rawPayloadOrphanCount,
        raw_payload_digest_mismatch_count: rawPayloadDigestMismatchCount,
        raw_payload_bytes_mismatch_count: rawPayloadBytesMismatchCount,
        organic_row_gap_count:
          expectedConnectedOrganic + expectedUnconnectedOrganic -
          connectedOrganicRows.length - retainedUnconnectedOrganicRows,
        feature_payload_row_gap_count: expectedFeatureItems - featureRows.length,
        feature_payload_value_mismatch_count: featurePayloadValueMismatchCount,
        connected_organic_value_mismatch_count: connectedOrganicValueMismatchCount,
        unconnected_organic_value_mismatch_count: unconnectedOrganicValueMismatchCount,
        task_identity_match: missingInventoryTaskIds.length === 0,
        connected_metadata_match: missingConnectedMetadataTaskIds.length === 0,
        organic_row_match:
          expectedConnectedOrganic + expectedUnconnectedOrganic ===
          connectedOrganicRows.length + retainedUnconnectedOrganicRows,
        feature_payload_match: expectedFeatureItems === featureRows.length,
        raw_payload_match:
          rawTaskIds.size === rawPayloadRows.length &&
          rawPayloadOrphanCount === 0 &&
          rawPayloadDigestMismatchCount === 0 &&
          rawPayloadBytesMismatchCount === 0,
        feature_payload_value_match: featurePayloadValueMismatchCount === 0,
        connected_organic_value_match: connectedOrganicValueMismatchCount === 0,
        unconnected_organic_value_match: unconnectedOrganicValueMismatchCount === 0,
      },
      retention_policy: {
        exact_definition:
          "A primitive raw observation is exact-retained when the corresponding SQLite row/column or verbatim JSON payload represents the same value/state; documented scalar normalization (for example task.time seconds and boolean 0/1) is accepted.",
        implicit_context_definition:
          "The table identity supplies context (for example, an organic snapshot row) but the raw primitive itself is not stored as a value.",
        not_retained_definition:
          "The raw primitive was observed in a snapshot but has no represented value in the DB projection; this is not evidence that the provider failed to return it.",
        projection_gap_definition:
          "A retention row was expected by the projection contract but the corresponding DB row is missing.",
        absent_field_semantics:
          "A field absent from a payload is not counted; this audit only classifies observed primitive states.",
        full_payload_policy:
          "Every raw snapshot task is retained verbatim in raw_snapshot_payloads.payload_json with a file-matching SHA-256 digest; non-organic SERP item payloads additionally use raw_snapshot_feature_evidence.payload_json, while connected task metadata and organic rows use structured/JSON columns.",
      },
      coverage_notes: [
        "The ten unconnected snapshots use limited structured columns for inventory and organic rank/domain/title/URL reuse, while the complete raw response remains available through raw_snapshot_payloads without current-group assignment.",
        "Full raw snapshot files remain the source of truth for any primitive classified as not_retained; no raw file is deleted by this audit.",
        "Null/false/zero rows can be state-only drops even when no non-empty value was lost; inspect state_counts before treating them as actionable gaps.",
      ],
    };
    const digestInput = JSON.stringify(audit);
    audit.audit_digest = createHash("sha256").update(digestInput).digest("hex");
    return audit;
  } finally {
    db.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(
    JSON.stringify(
      auditSerpDbRetention({
        dbPath: path.resolve(process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite"),
        rawRoots: process.env.SERP_RAW_ROOT
          ? [path.resolve(process.env.SERP_RAW_ROOT)]
          : defaultRawRoots,
      }),
      null,
      2,
    ),
  );
}
