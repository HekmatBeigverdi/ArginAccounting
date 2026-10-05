CREATE TABLE sales_documents (
  id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  fiscal_year_id TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('sales-order','sales-invoice','sales-return','sales-correction')),
  customer_id TEXT NOT NULL,
  document_number TEXT,
  business_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','approved','finalized','cancelled')),
  document_json TEXT NOT NULL CHECK (json_valid(document_json)),
  version INTEGER NOT NULL CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_origin TEXT NOT NULL DEFAULT 'local',
  sync_changed_at TEXT NOT NULL,
  PRIMARY KEY (company_id,id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) STRICT;

CREATE UNIQUE INDEX ux_sales_documents_number
ON sales_documents(company_id,fiscal_year_id,branch_id,document_type,document_number)
WHERE document_number IS NOT NULL;
CREATE INDEX ix_sales_documents_customer_date ON sales_documents(company_id,customer_id,business_date DESC);
CREATE INDEX ix_sales_documents_status ON sales_documents(company_id,document_type,status,business_date DESC);

CREATE TABLE sales_document_lifecycle (
  company_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  transition_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  reason TEXT,
  PRIMARY KEY (company_id,document_id,sequence),
  UNIQUE (company_id,transition_id),
  FOREIGN KEY (company_id,document_id) REFERENCES sales_documents(company_id,id) ON DELETE CASCADE
) STRICT;

CREATE TABLE sales_idempotency (
  company_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_fingerprint TEXT NOT NULL,
  outcome_kind TEXT NOT NULL,
  outcome_id TEXT NOT NULL,
  outcome_version INTEGER,
  outcome_status TEXT,
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (company_id,request_id),
  UNIQUE (company_id,operation_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX ix_sales_idempotency_outcome ON sales_idempotency(company_id,outcome_kind,outcome_id);
