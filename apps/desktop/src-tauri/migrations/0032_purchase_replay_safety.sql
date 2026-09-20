PRAGMA foreign_keys = ON;

-- Phase 22 Step 17: exact replay result and append-only Purchase idempotency evidence.
ALTER TABLE purchase_idempotency ADD COLUMN result_json TEXT;

CREATE TRIGGER tr_purchase_idempotency_result_required
BEFORE INSERT ON purchase_idempotency
WHEN NEW.result_json IS NULL OR length(trim(NEW.result_json)) < 2
BEGIN
  SELECT RAISE(ABORT, 'purchase idempotency result is required');
END;

CREATE TRIGGER tr_purchase_idempotency_no_update
BEFORE UPDATE ON purchase_idempotency
BEGIN
  SELECT RAISE(ABORT, 'purchase_idempotency is append-only');
END;

CREATE TRIGGER tr_purchase_idempotency_no_delete
BEFORE DELETE ON purchase_idempotency
BEGIN
  SELECT RAISE(ABORT, 'purchase_idempotency is append-only');
END;
