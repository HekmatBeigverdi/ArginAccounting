PRAGMA foreign_keys = ON;

CREATE TABLE inventory_valuation_idempotency (
    company_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_fingerprint TEXT NOT NULL,
    outcome_kind TEXT NOT NULL CHECK (outcome_kind IN ('policy','valuation','recalculation')),
    outcome_id TEXT NOT NULL,
    outcome_revision INTEGER NULL CHECK (outcome_revision IS NULL OR outcome_revision >= 0),
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (company_id, request_id)
);

CREATE INDEX idx_inventory_valuation_idempotency_operation
    ON inventory_valuation_idempotency(company_id, operation, recorded_at);

CREATE TABLE inventory_valuation_stream_versions (
    company_id TEXT NOT NULL,
    stream_key TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    PRIMARY KEY (company_id, stream_key)
);

CREATE INDEX idx_inventory_valuation_stream_versions_company
    ON inventory_valuation_stream_versions(company_id, stream_key, revision);
