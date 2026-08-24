PRAGMA foreign_keys = ON;

-- Phase 13 intentionally constrained journal_vouchers.status to 'draft'.
-- Keep that legacy column unchanged for upgrade safety and introduce the
-- authoritative Phase 15 lifecycle state separately. Step 11 repositories
-- read/write lifecycle_status and keep the legacy Phase 13 persistence shape
-- compatible with existing databases.
ALTER TABLE journal_vouchers
ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'draft'
CHECK (lifecycle_status IN ('draft', 'pending_approval', 'approved', 'posted', 'reversed'));

CREATE INDEX ix_journal_vouchers_lifecycle_status
ON journal_vouchers(company_id, lifecycle_status, voucher_date DESC, id);

CREATE TABLE journal_voucher_approval_cycles (
    approval_request_id TEXT PRIMARY KEY NOT NULL,
    voucher_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    submitted_content_version INTEGER NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    closed_at TEXT,

    CONSTRAINT fk_journal_approval_cycle_voucher
        FOREIGN KEY (company_id, voucher_id)
        REFERENCES journal_vouchers(company_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_journal_approval_cycle_request
        FOREIGN KEY (approval_request_id)
        REFERENCES approval_requests(id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_journal_approval_cycle_version
        CHECK (submitted_content_version >= 1),
    CONSTRAINT ck_journal_approval_cycle_current
        CHECK (is_current IN (0, 1)),
    CONSTRAINT ck_journal_approval_cycle_closed
        CHECK (
            (is_current = 1 AND closed_at IS NULL)
            OR (is_current = 0 AND closed_at IS NOT NULL)
        )
);

CREATE UNIQUE INDEX uq_journal_approval_cycle_current
ON journal_voucher_approval_cycles(voucher_id)
WHERE is_current = 1;

CREATE INDEX ix_journal_approval_cycle_voucher_history
ON journal_voucher_approval_cycles(voucher_id, created_at DESC, approval_request_id);

CREATE TABLE journal_voucher_posting_evidence (
    voucher_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    approval_request_id TEXT NOT NULL,
    submitted_content_version INTEGER NOT NULL,
    posted_version INTEGER NOT NULL,
    posted_by TEXT NOT NULL,
    posted_at TEXT NOT NULL,
    posting_reference TEXT,

    CONSTRAINT fk_journal_posting_voucher
        FOREIGN KEY (company_id, voucher_id)
        REFERENCES journal_vouchers(company_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_journal_posting_approval
        FOREIGN KEY (approval_request_id)
        REFERENCES approval_requests(id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_journal_posting_versions
        CHECK (submitted_content_version >= 1 AND posted_version > submitted_content_version),
    CONSTRAINT ck_journal_posting_actor
        CHECK (length(trim(posted_by)) BETWEEN 1 AND 128 AND posted_by = trim(posted_by)),
    CONSTRAINT ck_journal_posting_reference
        CHECK (
            posting_reference IS NULL
            OR (
                length(trim(posting_reference)) BETWEEN 1 AND 128
                AND posting_reference = trim(posting_reference)
            )
        )
);

CREATE INDEX ix_journal_posting_approval
ON journal_voucher_posting_evidence(approval_request_id, voucher_id);

CREATE INDEX ix_journal_posting_actor_time
ON journal_voucher_posting_evidence(company_id, posted_by, posted_at DESC, voucher_id);

CREATE TABLE journal_voucher_amendment_evidence (
    voucher_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    approval_request_id TEXT NOT NULL,
    previous_version INTEGER NOT NULL,
    reopened_version INTEGER NOT NULL,
    reopened_by TEXT NOT NULL,
    reopened_at TEXT NOT NULL,
    reason TEXT NOT NULL,

    PRIMARY KEY (voucher_id, reopened_version),

    CONSTRAINT fk_journal_amendment_voucher
        FOREIGN KEY (company_id, voucher_id)
        REFERENCES journal_vouchers(company_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_journal_amendment_approval
        FOREIGN KEY (approval_request_id)
        REFERENCES approval_requests(id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_journal_amendment_versions
        CHECK (previous_version >= 1 AND reopened_version = previous_version + 1),
    CONSTRAINT ck_journal_amendment_actor
        CHECK (length(trim(reopened_by)) BETWEEN 1 AND 128 AND reopened_by = trim(reopened_by)),
    CONSTRAINT ck_journal_amendment_reason
        CHECK (length(trim(reason)) BETWEEN 1 AND 500 AND reason = trim(reason))
);

CREATE INDEX ix_journal_amendment_latest
ON journal_voucher_amendment_evidence(voucher_id, reopened_version DESC);

CREATE TABLE journal_voucher_reversal_lineage (
    original_voucher_id TEXT PRIMARY KEY NOT NULL,
    reversal_voucher_id TEXT NOT NULL UNIQUE,
    replacement_voucher_id TEXT,
    company_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    reversed_by TEXT NOT NULL,
    reversed_at TEXT NOT NULL,
    reason TEXT NOT NULL,

    CONSTRAINT fk_journal_reversal_original
        FOREIGN KEY (company_id, original_voucher_id)
        REFERENCES journal_vouchers(company_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_journal_reversal_reversal
        FOREIGN KEY (company_id, reversal_voucher_id)
        REFERENCES journal_vouchers(company_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_journal_reversal_replacement
        FOREIGN KEY (company_id, replacement_voucher_id)
        REFERENCES journal_vouchers(company_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_journal_reversal_distinct
        CHECK (
            original_voucher_id <> reversal_voucher_id
            AND (replacement_voucher_id IS NULL OR replacement_voucher_id <> original_voucher_id)
        ),
    CONSTRAINT ck_journal_reversal_request
        CHECK (length(trim(request_id)) BETWEEN 1 AND 128 AND request_id = trim(request_id)),
    CONSTRAINT ck_journal_reversal_actor
        CHECK (length(trim(reversed_by)) BETWEEN 1 AND 128 AND reversed_by = trim(reversed_by)),
    CONSTRAINT ck_journal_reversal_reason
        CHECK (length(trim(reason)) BETWEEN 1 AND 500 AND reason = trim(reason))
);

CREATE UNIQUE INDEX uq_journal_reversal_company_request
ON journal_voucher_reversal_lineage(company_id, request_id);

CREATE INDEX ix_journal_reversal_replacement
ON journal_voucher_reversal_lineage(company_id, replacement_voucher_id)
WHERE replacement_voucher_id IS NOT NULL;
