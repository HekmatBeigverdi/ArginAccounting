PRAGMA foreign_keys = OFF;

CREATE TABLE journal_vouchers_lifecycle_new (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT,
    voucher_number TEXT NOT NULL,
    reference TEXT,
    voucher_date TEXT NOT NULL,
    fiscal_year_id TEXT NOT NULL,
    fiscal_period_id TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    currency_code TEXT NOT NULL DEFAULT 'IRR',
    source_type TEXT NOT NULL DEFAULT 'manual',
    source_id TEXT,
    request_id TEXT,
    correlation_id TEXT,
    causation_id TEXT,
    total_debit INTEGER NOT NULL,
    total_credit INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_journal_vouchers_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    CONSTRAINT fk_journal_vouchers_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_journal_vouchers_fiscal_year
        FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE RESTRICT,
    CONSTRAINT fk_journal_vouchers_fiscal_period
        FOREIGN KEY (fiscal_period_id) REFERENCES fiscal_periods(id) ON DELETE RESTRICT,
    CONSTRAINT uq_journal_vouchers_number_scope
        UNIQUE (company_id, fiscal_year_id, branch_id, voucher_number),
    CONSTRAINT uq_journal_vouchers_company_id
        UNIQUE (company_id, id),
    CONSTRAINT ck_journal_vouchers_number
        CHECK (length(trim(voucher_number)) BETWEEN 1 AND 50 AND voucher_number = trim(voucher_number)),
    CONSTRAINT ck_journal_vouchers_reference
        CHECK (reference IS NULL OR (length(trim(reference)) BETWEEN 1 AND 100 AND reference = trim(reference))),
    CONSTRAINT ck_journal_vouchers_request_id
        CHECK (request_id IS NULL OR (length(trim(request_id)) BETWEEN 1 AND 128 AND request_id = trim(request_id))),
    CONSTRAINT ck_journal_vouchers_date
        CHECK (voucher_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(voucher_date) = voucher_date),
    CONSTRAINT ck_journal_vouchers_status
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'reversed')),
    CONSTRAINT ck_journal_vouchers_currency
        CHECK (length(currency_code) = 3 AND currency_code = upper(currency_code) AND currency_code NOT GLOB '*[^A-Z]*'),
    CONSTRAINT ck_journal_vouchers_source
        CHECK (source_type IN ('manual', 'opening_balance', 'migration', 'integration', 'system', 'source_document')),
    CONSTRAINT ck_journal_vouchers_amounts
        CHECK (total_debit >= 0 AND total_credit >= 0 AND total_debit = total_credit),
    CONSTRAINT ck_journal_vouchers_version
        CHECK (version >= 1)
);

INSERT INTO journal_vouchers_lifecycle_new (
    id, company_id, branch_id, voucher_number, reference, voucher_date,
    fiscal_year_id, fiscal_period_id, description, status, currency_code,
    source_type, source_id, request_id, correlation_id, causation_id,
    total_debit, total_credit, created_at, updated_at, version
)
SELECT
    id, company_id, branch_id, voucher_number, reference, voucher_date,
    fiscal_year_id, fiscal_period_id, description, status, currency_code,
    source_type, source_id, request_id, correlation_id, causation_id,
    total_debit, total_credit, created_at, updated_at, version
FROM journal_vouchers;

DROP TABLE journal_vouchers;
ALTER TABLE journal_vouchers_lifecycle_new RENAME TO journal_vouchers;

CREATE UNIQUE INDEX uq_journal_vouchers_number_scope_normalized
ON journal_vouchers(company_id, fiscal_year_id, COALESCE(branch_id, ''), voucher_number);

CREATE UNIQUE INDEX uq_journal_vouchers_company_request
ON journal_vouchers(company_id, request_id)
WHERE request_id IS NOT NULL;

CREATE INDEX ix_journal_vouchers_company_date
ON journal_vouchers(company_id, voucher_date DESC, id);
CREATE INDEX ix_journal_vouchers_branch_date
ON journal_vouchers(company_id, branch_id, voucher_date DESC, id);
CREATE INDEX ix_journal_vouchers_fiscal
ON journal_vouchers(company_id, fiscal_year_id, fiscal_period_id, voucher_date, id);
CREATE INDEX ix_journal_vouchers_reference
ON journal_vouchers(company_id, reference);
CREATE INDEX ix_journal_vouchers_source
ON journal_vouchers(company_id, source_type, source_id, request_id);
CREATE INDEX ix_journal_vouchers_correlation
ON journal_vouchers(correlation_id, causation_id);
CREATE INDEX ix_journal_vouchers_status
ON journal_vouchers(company_id, status, voucher_date DESC, id);

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
        CHECK ((is_current = 1 AND closed_at IS NULL) OR is_current = 0)
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
        CHECK (posting_reference IS NULL OR (length(trim(posting_reference)) BETWEEN 1 AND 128 AND posting_reference = trim(posting_reference)))
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
        CHECK (original_voucher_id <> reversal_voucher_id AND (replacement_voucher_id IS NULL OR replacement_voucher_id <> original_voucher_id)),
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

PRAGMA foreign_keys = ON;
