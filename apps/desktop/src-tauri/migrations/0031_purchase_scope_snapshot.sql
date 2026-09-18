PRAGMA foreign_keys = ON;

-- Phase 22 Step 16 prerequisite: persist the complete historical Purchase Fiscal scope snapshot.
ALTER TABLE purchase_documents ADD COLUMN fiscal_year_start_date TEXT;
ALTER TABLE purchase_documents ADD COLUMN fiscal_year_end_date TEXT;
ALTER TABLE purchase_documents ADD COLUMN fiscal_period_start_date TEXT;
ALTER TABLE purchase_documents ADD COLUMN fiscal_period_end_date TEXT;
ALTER TABLE purchase_documents ADD COLUMN fiscal_year_status TEXT;
ALTER TABLE purchase_documents ADD COLUMN fiscal_period_status TEXT;
ALTER TABLE purchase_documents ADD COLUMN locked_through_date TEXT;

CREATE TRIGGER tr_purchase_documents_scope_snapshot_required_insert
BEFORE INSERT ON purchase_documents
WHEN NEW.fiscal_year_start_date IS NULL
  OR NEW.fiscal_year_end_date IS NULL
  OR NEW.fiscal_period_start_date IS NULL
  OR NEW.fiscal_period_end_date IS NULL
  OR NEW.fiscal_year_status IS NULL
  OR NEW.fiscal_period_status IS NULL
BEGIN
  SELECT RAISE(ABORT, 'purchase fiscal scope snapshot is required');
END;

CREATE TRIGGER tr_purchase_documents_scope_snapshot_required_update
BEFORE UPDATE ON purchase_documents
WHEN NEW.fiscal_year_start_date IS NULL
  OR NEW.fiscal_year_end_date IS NULL
  OR NEW.fiscal_period_start_date IS NULL
  OR NEW.fiscal_period_end_date IS NULL
  OR NEW.fiscal_year_status IS NULL
  OR NEW.fiscal_period_status IS NULL
  OR NEW.fiscal_year_status NOT IN ('draft','open','closing','closed')
  OR NEW.fiscal_period_status NOT IN ('open','locked','closed')
  OR NEW.fiscal_year_start_date > NEW.fiscal_year_end_date
  OR NEW.fiscal_period_start_date > NEW.fiscal_period_end_date
  OR NEW.fiscal_period_start_date < NEW.fiscal_year_start_date
  OR NEW.fiscal_period_end_date > NEW.fiscal_year_end_date
BEGIN
  SELECT RAISE(ABORT, 'purchase fiscal scope snapshot is invalid');
END;
