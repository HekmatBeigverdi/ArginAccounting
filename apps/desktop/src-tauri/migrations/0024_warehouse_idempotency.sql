PRAGMA foreign_keys = ON;

CREATE TABLE warehouse_idempotency (
    scope TEXT NOT NULL,
    request_id TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,

    PRIMARY KEY (scope, request_id),

    CONSTRAINT ck_warehouse_idempotency_scope
        CHECK (length(trim(scope)) >= 1 AND scope = trim(scope)),

    CONSTRAINT ck_warehouse_idempotency_request
        CHECK (length(trim(request_id)) >= 1 AND request_id = trim(request_id)),

    CONSTRAINT ck_warehouse_idempotency_status
        CHECK (status IN ('in-progress', 'completed')),

    CONSTRAINT ck_warehouse_idempotency_result
        CHECK (
            (status = 'in-progress' AND result_json IS NULL AND completed_at IS NULL)
            OR
            (status = 'completed' AND result_json IS NOT NULL AND completed_at IS NOT NULL)
        )
);

CREATE INDEX ix_warehouse_idempotency_created
ON warehouse_idempotency(created_at, scope, request_id);
