PRAGMA foreign_keys = ON;

CREATE TABLE audit_entries
(
    id                  TEXT PRIMARY KEY,

    occurred_at         TEXT NOT NULL,

    action              TEXT NOT NULL,
    outcome             TEXT NOT NULL,
    source              TEXT NOT NULL,

    actor_type          TEXT NOT NULL,
    actor_id            TEXT,
    actor_display_name  TEXT NOT NULL,

    company_id          TEXT,
    branch_id           TEXT,
    fiscal_year_id      TEXT,

    entity_type         TEXT NOT NULL,
    entity_id           TEXT,
    entity_display_name TEXT,

    message             TEXT,
    reason              TEXT,

    before_json         TEXT,
    after_json          TEXT,

    correlation_id      TEXT,

    metadata_json       TEXT
);


CREATE TABLE approval_requests
(
    id                   TEXT PRIMARY KEY,

    request_type         TEXT NOT NULL,

    title                TEXT NOT NULL,

    description          TEXT,

    status               TEXT NOT NULL,

    entity_type          TEXT NOT NULL,

    entity_id            TEXT NOT NULL,

    entity_display_name  TEXT,

    company_id           TEXT,

    branch_id            TEXT,

    fiscal_year_id       TEXT,

    requested_by_type    TEXT NOT NULL,

    requested_by_id      TEXT,

    requested_by_name    TEXT NOT NULL,

    requested_at         TEXT,

    decided_by_type      TEXT,

    decided_by_id        TEXT,

    decided_by_name      TEXT,

    decided_at           TEXT,

    decision_comment     TEXT,

    created_at           TEXT NOT NULL,

    updated_at           TEXT NOT NULL
);

CREATE TABLE approval_history
(
    id                    TEXT PRIMARY KEY,

    approval_request_id   TEXT NOT NULL,

    action                TEXT NOT NULL,

    from_status           TEXT,

    to_status             TEXT NOT NULL,

    actor_type            TEXT NOT NULL,

    actor_id              TEXT,

    actor_display_name    TEXT NOT NULL,

    comment               TEXT,

    occurred_at           TEXT NOT NULL,

    FOREIGN KEY (approval_request_id)
        REFERENCES approval_requests(id)
        ON DELETE CASCADE
);

/********* Audit Index *********/

CREATE INDEX idx_audit_occurred_at
ON audit_entries(occurred_at DESC);

CREATE INDEX idx_audit_actor
ON audit_entries(actor_id);

CREATE INDEX idx_audit_entity
ON audit_entries(entity_type, entity_id);

CREATE INDEX idx_audit_company
ON audit_entries(company_id);

CREATE INDEX idx_audit_branch
ON audit_entries(branch_id);

CREATE INDEX idx_audit_fiscal
ON audit_entries(fiscal_year_id);

CREATE INDEX idx_audit_action
ON audit_entries(action);

CREATE INDEX idx_audit_outcome
ON audit_entries(outcome);

CREATE INDEX idx_audit_correlation
ON audit_entries(correlation_id);

/********* Approval Index *********/

CREATE INDEX idx_approval_status
ON approval_requests(status);

CREATE INDEX idx_approval_request_type
ON approval_requests(request_type);

CREATE INDEX idx_approval_entity
ON approval_requests(entity_type, entity_id);

CREATE INDEX idx_approval_requested_by
ON approval_requests(requested_by_id);

CREATE INDEX idx_approval_company
ON approval_requests(company_id);

CREATE INDEX idx_approval_branch
ON approval_requests(branch_id);

CREATE INDEX idx_approval_fiscal
ON approval_requests(fiscal_year_id);

CREATE INDEX idx_approval_created_at
ON approval_requests(created_at DESC);

/********* History Index *********/

CREATE INDEX idx_approval_history_request
ON approval_history(
    approval_request_id,
    occurred_at DESC
);

