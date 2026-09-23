PRAGMA foreign_keys = ON;

-- Phase 23 Step 20: Purchase Posting persistence foundation.
-- Durable IDs are authoritative; SQLite row identity is intentionally absent.

CREATE TABLE purchase_postings (
    posting_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    journal_voucher_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_origin TEXT NOT NULL DEFAULT 'local',
    server_revision INTEGER,
    sync_changed_at TEXT,

    CONSTRAINT fk_purchase_postings_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_postings_branch_same_company
        FOREIGN KEY (company_id, branch_id) REFERENCES branches(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_postings_journal_same_company
        FOREIGN KEY (company_id, journal_voucher_id)
        REFERENCES journal_vouchers(company_id, id) ON DELETE RESTRICT,

    CONSTRAINT uq_purchase_postings_company_id UNIQUE (company_id, posting_id),
    CONSTRAINT ck_purchase_postings_status
        CHECK (status IN ('draft','prepared','posted','reversed')),
    CONSTRAINT ck_purchase_postings_journal_state
        CHECK (
            (status = 'draft' AND journal_voucher_id IS NULL)
            OR
            (status IN ('prepared','posted','reversed') AND journal_voucher_id IS NOT NULL)
        ),
    CONSTRAINT ck_purchase_postings_version CHECK (version >= 1),
    CONSTRAINT ck_purchase_postings_sync_origin
        CHECK (length(trim(sync_origin)) >= 1 AND sync_origin = trim(sync_origin)),
    CONSTRAINT ck_purchase_postings_server_revision
        CHECK (server_revision IS NULL OR server_revision >= 0)
);

CREATE UNIQUE INDEX uq_purchase_postings_journal
ON purchase_postings(company_id, journal_voucher_id)
WHERE journal_voucher_id IS NOT NULL;

CREATE INDEX ix_purchase_postings_status
ON purchase_postings(company_id, branch_id, status, updated_at DESC, posting_id);

CREATE INDEX ix_purchase_postings_sync_changes
ON purchase_postings(company_id, sync_changed_at, posting_id)
WHERE sync_changed_at IS NOT NULL;

CREATE TABLE purchase_posting_rules (
    rule_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT,
    event_kind TEXT,
    line_kind TEXT,
    account_role TEXT NOT NULL,
    account_id TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_origin TEXT NOT NULL DEFAULT 'local',
    server_revision INTEGER,
    sync_changed_at TEXT,

    CONSTRAINT fk_purchase_posting_rules_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_posting_rules_branch_same_company
        FOREIGN KEY (company_id, branch_id) REFERENCES branches(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_posting_rules_account_same_company
        FOREIGN KEY (company_id, account_id) REFERENCES accounts(company_id, id) ON DELETE RESTRICT,

    CONSTRAINT uq_purchase_posting_rules_company_id UNIQUE (company_id, rule_id),
    CONSTRAINT ck_purchase_posting_rules_event
        CHECK (
            event_kind IS NULL
            OR event_kind IN (
                'supplier-invoice-recognition',
                'purchase-return-recognition',
                'purchase-correction-recognition'
            )
        ),
    CONSTRAINT ck_purchase_posting_rules_line_kind
        CHECK (
            line_kind IS NULL
            OR line_kind IN ('stock-product','non-stock-product','service')
        ),
    CONSTRAINT ck_purchase_posting_rules_role
        CHECK (
            account_role IN (
                'inventory-asset',
                'purchase-expense',
                'accounts-payable',
                'input-vat-recoverable',
                'purchase-charge',
                'grni'
            )
        ),
    CONSTRAINT ck_purchase_posting_rules_priority
        CHECK (priority BETWEEN -2147483648 AND 2147483647),
    CONSTRAINT ck_purchase_posting_rules_active CHECK (active IN (0, 1)),
    CONSTRAINT ck_purchase_posting_rules_version CHECK (version >= 1),
    CONSTRAINT ck_purchase_posting_rules_sync_origin
        CHECK (length(trim(sync_origin)) >= 1 AND sync_origin = trim(sync_origin)),
    CONSTRAINT ck_purchase_posting_rules_server_revision
        CHECK (server_revision IS NULL OR server_revision >= 0)
);

CREATE INDEX ix_purchase_posting_rules_resolution
ON purchase_posting_rules(
    company_id,
    account_role,
    active,
    branch_id,
    event_kind,
    line_kind,
    priority DESC,
    rule_id
);

CREATE INDEX ix_purchase_posting_rules_account
ON purchase_posting_rules(company_id, account_id, active, rule_id);

CREATE INDEX ix_purchase_posting_rules_sync_changes
ON purchase_posting_rules(company_id, sync_changed_at, rule_id)
WHERE sync_changed_at IS NOT NULL;

CREATE TABLE purchase_posting_idempotency (
    idempotency_key TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    source_system TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_version INTEGER NOT NULL,
    source_revision INTEGER,
    posting_purpose TEXT NOT NULL,
    payload_fingerprint TEXT NOT NULL,
    posting_id TEXT NOT NULL,
    journal_voucher_id TEXT NOT NULL,
    committed_posting_version INTEGER NOT NULL,
    committed_at TEXT NOT NULL,

    CONSTRAINT fk_purchase_posting_idempotency_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_posting_idempotency_posting
        FOREIGN KEY (company_id, posting_id)
        REFERENCES purchase_postings(company_id, posting_id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_posting_idempotency_journal
        FOREIGN KEY (company_id, journal_voucher_id)
        REFERENCES journal_vouchers(company_id, id) ON DELETE RESTRICT,

    CONSTRAINT ck_purchase_posting_idempotency_key
        CHECK (length(trim(idempotency_key)) >= 1 AND idempotency_key = trim(idempotency_key)),
    CONSTRAINT ck_purchase_posting_idempotency_source_system
        CHECK (source_system = 'purchase'),
    CONSTRAINT ck_purchase_posting_idempotency_source_type
        CHECK (source_type IN ('purchase-order','supplier-invoice','purchase-return','purchase-correction')),
    CONSTRAINT ck_purchase_posting_idempotency_source_id
        CHECK (length(trim(source_id)) >= 1 AND source_id = trim(source_id)),
    CONSTRAINT ck_purchase_posting_idempotency_source_version
        CHECK (source_version >= 1),
    CONSTRAINT ck_purchase_posting_idempotency_source_revision
        CHECK (source_revision IS NULL OR source_revision >= 1),
    CONSTRAINT ck_purchase_posting_idempotency_purpose
        CHECK (posting_purpose = 'accounting-recognition'),
    CONSTRAINT ck_purchase_posting_idempotency_fingerprint
        CHECK (
            length(payload_fingerprint) = 64
            AND payload_fingerprint = lower(payload_fingerprint)
            AND payload_fingerprint NOT GLOB '*[^0-9a-f]*'
        ),
    CONSTRAINT ck_purchase_posting_idempotency_version
        CHECK (committed_posting_version >= 1)
);

CREATE UNIQUE INDEX uq_purchase_posting_idempotency_source
ON purchase_posting_idempotency(
    company_id,
    branch_id,
    source_system,
    source_type,
    source_id,
    source_version,
    COALESCE(source_revision, -1),
    posting_purpose
);

CREATE UNIQUE INDEX uq_purchase_posting_idempotency_posting
ON purchase_posting_idempotency(company_id, posting_id, posting_purpose);

CREATE INDEX ix_purchase_posting_idempotency_source_lookup
ON purchase_posting_idempotency(
    company_id,
    source_type,
    source_id,
    source_version,
    committed_at DESC
);

CREATE INDEX ix_purchase_posting_idempotency_journal
ON purchase_posting_idempotency(company_id, journal_voucher_id, committed_at DESC);

CREATE TRIGGER tr_purchase_posting_idempotency_no_update
BEFORE UPDATE ON purchase_posting_idempotency
BEGIN
    SELECT RAISE(ABORT, 'purchase_posting_idempotency is append-only');
END;

CREATE TRIGGER tr_purchase_posting_idempotency_no_delete
BEFORE DELETE ON purchase_posting_idempotency
BEGIN
    SELECT RAISE(ABORT, 'purchase_posting_idempotency is append-only');
END;

CREATE TABLE purchase_posting_reversals (
    posting_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    original_journal_voucher_id TEXT NOT NULL,
    reversal_journal_voucher_id TEXT NOT NULL UNIQUE,
    request_id TEXT NOT NULL,
    reversed_by TEXT NOT NULL,
    reversed_at TEXT NOT NULL,
    reason TEXT NOT NULL,
    committed_posting_version INTEGER NOT NULL,

    CONSTRAINT fk_purchase_posting_reversal_posting
        FOREIGN KEY (company_id, posting_id)
        REFERENCES purchase_postings(company_id, posting_id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_posting_reversal_original_journal
        FOREIGN KEY (company_id, original_journal_voucher_id)
        REFERENCES journal_vouchers(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_posting_reversal_reversal_journal
        FOREIGN KEY (company_id, reversal_journal_voucher_id)
        REFERENCES journal_vouchers(company_id, id) ON DELETE RESTRICT,

    CONSTRAINT ck_purchase_posting_reversal_distinct
        CHECK (original_journal_voucher_id <> reversal_journal_voucher_id),
    CONSTRAINT ck_purchase_posting_reversal_request
        CHECK (length(trim(request_id)) BETWEEN 1 AND 128 AND request_id = trim(request_id)),
    CONSTRAINT ck_purchase_posting_reversal_actor
        CHECK (length(trim(reversed_by)) BETWEEN 1 AND 128 AND reversed_by = trim(reversed_by)),
    CONSTRAINT ck_purchase_posting_reversal_reason
        CHECK (length(trim(reason)) BETWEEN 1 AND 500 AND reason = trim(reason)),
    CONSTRAINT ck_purchase_posting_reversal_version
        CHECK (committed_posting_version >= 2)
);

CREATE UNIQUE INDEX uq_purchase_posting_reversal_company_request
ON purchase_posting_reversals(company_id, request_id);

CREATE INDEX ix_purchase_posting_reversal_original_journal
ON purchase_posting_reversals(company_id, original_journal_voucher_id, reversed_at DESC);

CREATE TRIGGER tr_purchase_posting_reversals_no_update
BEFORE UPDATE ON purchase_posting_reversals
BEGIN
    SELECT RAISE(ABORT, 'purchase_posting_reversals is append-only');
END;

CREATE TRIGGER tr_purchase_posting_reversals_no_delete
BEFORE DELETE ON purchase_posting_reversals
BEGIN
    SELECT RAISE(ABORT, 'purchase_posting_reversals is append-only');
END;
