PRAGMA foreign_keys = ON;

CREATE INDEX ix_journal_vouchers_reporting_scope
ON journal_vouchers(company_id, currency_code, lifecycle_status, voucher_date, branch_id, fiscal_year_id, fiscal_period_id, id);

CREATE INDEX ix_journal_line_dimensions_reporting
ON journal_line_dimension_assignments(company_id, dimension_type_id, member_id, line_id, voucher_id);
