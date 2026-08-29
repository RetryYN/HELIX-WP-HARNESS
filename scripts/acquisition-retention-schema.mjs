export const acquisitionRetentionSchemaVersion="acquisition-retention.v1";

export const acquisitionRetentionSql=`
  DROP TABLE IF EXISTS acquisition_semantic_projections;
  DROP TABLE IF EXISTS appearance_history_observations;
  DROP TABLE IF EXISTS traffic_metric_observations;
  DROP TABLE IF EXISTS acquisition_field_occurrences;
  DROP TABLE IF EXISTS acquisition_operation_entries;
  DROP TABLE IF EXISTS acquisition_raw_payloads;
  DROP TABLE IF EXISTS acquisition_operation_runs;
  CREATE TABLE acquisition_operation_runs (
    run_id TEXT PRIMARY KEY CHECK(length(run_id)=64), operation_id TEXT NOT NULL, site_id TEXT REFERENCES sites(site_id),
    lifecycle_state TEXT NOT NULL CHECK(lifecycle_state IN ('planned','submitted','polling','completed','failed','cancelled')),
    provider_request_id TEXT, requested_at TEXT NOT NULL, completed_at TEXT, credit_unit TEXT NOT NULL DEFAULT 'provider_credit_not_usd',
    consumed_credit REAL, cost_usd REAL, request_digest TEXT NOT NULL CHECK(length(request_digest)=64), response_digest TEXT CHECK(response_digest IS NULL OR length(response_digest)=64),
    credentials_retained INTEGER NOT NULL DEFAULT 0 CHECK(credentials_retained=0)
  );
  CREATE TABLE acquisition_raw_payloads (
    payload_id TEXT PRIMARY KEY CHECK(length(payload_id)=64), run_id TEXT NOT NULL REFERENCES acquisition_operation_runs(run_id),
    direction TEXT NOT NULL CHECK(direction IN ('request','response')), media_type TEXT NOT NULL, payload_json TEXT NOT NULL,
    payload_digest TEXT NOT NULL CHECK(length(payload_digest)=64), retained_losslessly INTEGER NOT NULL DEFAULT 1 CHECK(retained_losslessly=1),
    UNIQUE(run_id,direction,payload_digest)
  );
  CREATE TABLE acquisition_operation_entries (
    run_id TEXT NOT NULL REFERENCES acquisition_operation_runs(run_id), entry_no INTEGER NOT NULL, provider_request_id TEXT,
    source_field_id TEXT CHECK(source_field_id IS NULL OR length(source_field_id)=64), PRIMARY KEY(run_id,entry_no)
  );
  CREATE TABLE acquisition_field_occurrences (
    occurrence_id TEXT PRIMARY KEY CHECK(length(occurrence_id)=64), payload_id TEXT NOT NULL REFERENCES acquisition_raw_payloads(payload_id),
    field_id TEXT CHECK(field_id IS NULL OR length(field_id)=64), schema_name TEXT, field_path TEXT NOT NULL, occurrence_index INTEGER NOT NULL,
    json_type TEXT NOT NULL CHECK(json_type IN ('null','boolean','number','string','array','object')), value_json TEXT NOT NULL,
    UNIQUE(payload_id,field_path,occurrence_index)
  );
  CREATE TABLE traffic_metric_observations (
    observation_id TEXT PRIMARY KEY CHECK(length(observation_id)=64), run_id TEXT NOT NULL REFERENCES acquisition_operation_runs(run_id),
    occurrence_id TEXT NOT NULL REFERENCES acquisition_field_occurrences(occurrence_id), entity_type TEXT NOT NULL, entity_key TEXT NOT NULL,
    metric_kind TEXT NOT NULL CHECK(metric_kind IN ('estimated_traffic','traffic_value','keyword_count','ranking_keyword_count')),
    metric_value REAL NOT NULL, currency TEXT, observed_at TEXT NOT NULL, UNIQUE(occurrence_id,metric_kind)
  );
  CREATE TABLE appearance_history_observations (
    observation_id TEXT PRIMARY KEY CHECK(length(observation_id)=64), run_id TEXT NOT NULL REFERENCES acquisition_operation_runs(run_id),
    occurrence_id TEXT NOT NULL UNIQUE REFERENCES acquisition_field_occurrences(occurrence_id), entity_type TEXT NOT NULL, entity_key TEXT NOT NULL,
    first_seen_range_json TEXT NOT NULL, observed_at TEXT NOT NULL
  );
  CREATE TABLE acquisition_semantic_projections (
    occurrence_id TEXT NOT NULL REFERENCES acquisition_field_occurrences(occurrence_id), target_table TEXT NOT NULL, target_column TEXT NOT NULL,
    projection_state TEXT NOT NULL CHECK(projection_state IN ('projected','not_applicable','pending_mapping','rejected')),
    reason TEXT NOT NULL, evidence_digest TEXT NOT NULL CHECK(length(evidence_digest)=64), PRIMARY KEY(occurrence_id,target_table,target_column)
  );
`;

