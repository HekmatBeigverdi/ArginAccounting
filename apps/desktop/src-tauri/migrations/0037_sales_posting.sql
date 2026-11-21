PRAGMA foreign_keys = ON;

-- Phase 25 Sales Posting durable desktop persistence.
CREATE TABLE sales_postings (
  posting_id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('sales-invoice','sales-return','sales-correction')),
  source_document_id TEXT NOT NULL,
  source_version INTEGER NOT NULL CHECK(source_version >= 1),
  journal_voucher_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','ready','committed','blocked')),
  pending_reason TEXT,
  last_error_code TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_origin TEXT NOT NULL DEFAULT 'local',
  sync_changed_at TEXT NOT NULL,
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,branch_id) REFERENCES branches(company_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(journal_voucher_id) REFERENCES journal_vouchers(id) ON DELETE RESTRICT,
  UNIQUE(company_id,source_type,source_document_id,source_version),
  UNIQUE(journal_voucher_id)
) STRICT;

CREATE INDEX ix_sales_postings_source
ON sales_postings(company_id,source_type,source_document_id,source_version DESC);

CREATE TABLE sales_posting_rules (
  rule_id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL,
  branch_id TEXT,
  account_role TEXT NOT NULL CHECK(account_role IN ('accounts-receivable','sales-revenue','output-vat','cogs','inventory-asset')),
  line_kind TEXT CHECK(line_kind IS NULL OR line_kind IN ('stock-product','non-stock-product','service')),
  tax_code TEXT,
  account_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100 CHECK(priority >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,account_id) REFERENCES accounts(company_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,branch_id) REFERENCES branches(company_id,id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX ix_sales_posting_rules_resolution
ON sales_posting_rules(company_id,account_role,active,branch_id,line_kind,tax_code,priority DESC);

CREATE TABLE sales_posting_idempotency (
  idempotency_key TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  source_version INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  payload_fingerprint TEXT NOT NULL,
  posting_id TEXT NOT NULL,
  journal_voucher_id TEXT NOT NULL,
  committed_posting_version INTEGER NOT NULL CHECK(committed_posting_version >= 1),
  committed_at_utc TEXT NOT NULL,
  FOREIGN KEY(posting_id) REFERENCES sales_postings(posting_id) ON DELETE RESTRICT,
  FOREIGN KEY(journal_voucher_id) REFERENCES journal_vouchers(id) ON DELETE RESTRICT,
  UNIQUE(company_id,source_type,source_document_id,source_version,purpose)
) STRICT;

CREATE TRIGGER tr_sales_posting_idempotency_no_update
BEFORE UPDATE ON sales_posting_idempotency
BEGIN SELECT RAISE(ABORT,'sales_posting_idempotency is append-only'); END;
CREATE TRIGGER tr_sales_posting_idempotency_no_delete
BEFORE DELETE ON sales_posting_idempotency
BEGIN SELECT RAISE(ABORT,'sales_posting_idempotency is append-only'); END;

CREATE TABLE sales_posting_journal_provenance (
  journal_voucher_id TEXT NOT NULL,
  journal_line_id TEXT NOT NULL,
  posting_id TEXT NOT NULL,
  component_id TEXT NOT NULL,
  role TEXT NOT NULL,
  provenance_json TEXT NOT NULL CHECK(json_valid(provenance_json)),
  created_at_utc TEXT NOT NULL,
  PRIMARY KEY(journal_voucher_id,journal_line_id),
  FOREIGN KEY(journal_voucher_id,journal_line_id) REFERENCES journal_lines(voucher_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(posting_id) REFERENCES sales_postings(posting_id) ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER tr_sales_posting_provenance_no_update
BEFORE UPDATE ON sales_posting_journal_provenance
BEGIN SELECT RAISE(ABORT,'sales_posting_journal_provenance is append-only'); END;
CREATE TRIGGER tr_sales_posting_provenance_no_delete
BEFORE DELETE ON sales_posting_journal_provenance
BEGIN SELECT RAISE(ABORT,'sales_posting_journal_provenance is append-only'); END;

CREATE TABLE sales_posting_outbox (
  event_id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL,
  posting_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  occurred_at_utc TEXT NOT NULL,
  delivered_at_utc TEXT,
  FOREIGN KEY(posting_id) REFERENCES sales_postings(posting_id) ON DELETE RESTRICT
) STRICT;
