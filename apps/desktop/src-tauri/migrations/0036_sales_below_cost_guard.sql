CREATE TABLE IF NOT EXISTS sales_below_cost_policies (
  policy_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  effective_from TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('allow','warn','require-approval','block')),
  minimum_margin_basis_points INTEGER NOT NULL CHECK (minimum_margin_basis_points BETWEEN 0 AND 10000),
  actor_id TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  PRIMARY KEY (company_id, policy_id),
  UNIQUE (company_id, revision),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_below_cost_policy_effective
ON sales_below_cost_policies(company_id, effective_from DESC, revision DESC);

CREATE TABLE IF NOT EXISTS sales_below_cost_decisions (
  decision_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_revision INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('not-applicable','allowed','warning','approval-required','blocked','cost-unavailable')),
  selling_unit_price INTEGER NOT NULL,
  quoted_unit_cost TEXT NULL,
  margin_amount INTEGER NULL,
  margin_basis_points INTEGER NULL,
  quote_id TEXT NULL,
  valuation_basis_revision TEXT NULL,
  warehouse_id TEXT NULL,
  approved_by TEXT NULL,
  approval_reason TEXT NULL,
  decided_at TEXT NOT NULL,
  PRIMARY KEY (company_id, decision_id),
  FOREIGN KEY (company_id, document_id) REFERENCES sales_documents(company_id, id)
);

CREATE INDEX IF NOT EXISTS idx_sales_below_cost_decisions_document
ON sales_below_cost_decisions(company_id, document_id, line_id, decided_at);
