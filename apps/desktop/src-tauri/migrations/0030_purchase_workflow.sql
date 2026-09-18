PRAGMA foreign_keys = ON;

-- Phase 22 Purchase Workflow persistence foundation.
-- Purchase owns supplier commercial facts; Inventory owns quantity movements; Valuation owns FIFO/MWA.

CREATE TABLE purchase_documents (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    document_number TEXT,
    business_date TEXT NOT NULL,
    description TEXT,
    fiscal_year_id TEXT NOT NULL,
    fiscal_period_id TEXT NOT NULL,
    supplier_snapshot_json TEXT NOT NULL,
    source_system TEXT,
    source_document_id TEXT,
    source_line_id TEXT,
    correction_reference_document_id TEXT,
    correction_reason TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_origin TEXT NOT NULL DEFAULT 'local',
    server_revision INTEGER,
    sync_changed_at TEXT,

    CONSTRAINT fk_purchase_documents_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_documents_branch_same_company
        FOREIGN KEY (company_id, branch_id) REFERENCES branches(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_documents_supplier_same_company
        FOREIGN KEY (company_id, supplier_id) REFERENCES parties(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_documents_fiscal_year
        FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_documents_fiscal_period
        FOREIGN KEY (fiscal_period_id) REFERENCES fiscal_periods(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_documents_correction_reference_same_company
        FOREIGN KEY (company_id, correction_reference_document_id)
        REFERENCES purchase_documents(company_id, id) ON DELETE RESTRICT,

    CONSTRAINT uq_purchase_documents_company_id UNIQUE (company_id, id),
    CONSTRAINT ck_purchase_documents_type
        CHECK (document_type IN ('purchase-order','supplier-invoice','purchase-return','purchase-correction')),
    CONSTRAINT ck_purchase_documents_status
        CHECK (status IN ('draft','submitted','approved','confirmed','cancelled','returned','corrected')),
    CONSTRAINT ck_purchase_documents_number
        CHECK (document_number IS NULL OR (length(trim(document_number)) >= 1 AND document_number = trim(document_number))),
    CONSTRAINT ck_purchase_documents_description
        CHECK (description IS NULL OR (length(trim(description)) >= 1 AND description = trim(description))),
    CONSTRAINT ck_purchase_documents_supplier_snapshot
        CHECK (length(trim(supplier_snapshot_json)) >= 2),
    CONSTRAINT ck_purchase_documents_source_shape
        CHECK (
            (source_system IS NULL AND source_document_id IS NULL AND source_line_id IS NULL)
            OR
            (source_system IS NOT NULL AND source_document_id IS NOT NULL
             AND length(trim(source_system)) >= 1 AND length(trim(source_document_id)) >= 1)
        ),
    CONSTRAINT ck_purchase_documents_correction_shape
        CHECK (
            (correction_reference_document_id IS NULL AND correction_reason IS NULL)
            OR
            (correction_reference_document_id IS NOT NULL AND correction_reason IS NOT NULL
             AND document_type IN ('purchase-return','purchase-correction')
             AND correction_reference_document_id <> id
             AND length(trim(correction_reason)) >= 1 AND correction_reason = trim(correction_reason))
        ),
    CONSTRAINT ck_purchase_documents_version CHECK (version >= 1),
    CONSTRAINT ck_purchase_documents_sync_origin CHECK (length(trim(sync_origin)) >= 1 AND sync_origin = trim(sync_origin)),
    CONSTRAINT ck_purchase_documents_server_revision CHECK (server_revision IS NULL OR server_revision >= 0)
);

CREATE UNIQUE INDEX uq_purchase_documents_number_scope
ON purchase_documents(company_id, fiscal_year_id, branch_id, document_type, document_number)
WHERE document_number IS NOT NULL;

CREATE INDEX ix_purchase_documents_list
ON purchase_documents(company_id, status, business_date DESC, id);
CREATE INDEX ix_purchase_documents_supplier
ON purchase_documents(company_id, supplier_id, business_date DESC, id);
CREATE INDEX ix_purchase_documents_type_date
ON purchase_documents(company_id, document_type, business_date DESC, id);
CREATE INDEX ix_purchase_documents_branch_date
ON purchase_documents(company_id, branch_id, business_date DESC, id);
CREATE INDEX ix_purchase_documents_fiscal
ON purchase_documents(company_id, fiscal_year_id, fiscal_period_id, business_date DESC, id);
CREATE INDEX ix_purchase_documents_correction_reference
ON purchase_documents(company_id, correction_reference_document_id, id)
WHERE correction_reference_document_id IS NOT NULL;
CREATE INDEX ix_purchase_documents_sync_changes
ON purchase_documents(company_id, sync_changed_at, id)
WHERE sync_changed_at IS NOT NULL;

CREATE TABLE purchase_document_lines (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    line_kind TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_snapshot_json TEXT NOT NULL,
    description TEXT,
    source_system TEXT,
    source_document_id TEXT,
    source_line_id TEXT,

    CONSTRAINT fk_purchase_document_lines_document_same_company
        FOREIGN KEY (company_id, document_id) REFERENCES purchase_documents(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_document_lines_item_same_company
        FOREIGN KEY (company_id, item_id) REFERENCES products(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_purchase_document_lines_company_document_id UNIQUE (company_id, document_id, id),
    CONSTRAINT uq_purchase_document_lines_position UNIQUE (document_id, position),
    CONSTRAINT ck_purchase_document_lines_position CHECK (position > 0),
    CONSTRAINT ck_purchase_document_lines_kind CHECK (line_kind IN ('stock-product','non-stock-product','service')),
    CONSTRAINT ck_purchase_document_lines_item_type CHECK (item_type IN ('product','service')),
    CONSTRAINT ck_purchase_document_lines_classification
        CHECK ((line_kind = 'service' AND item_type = 'service') OR (line_kind <> 'service' AND item_type = 'product')),
    CONSTRAINT ck_purchase_document_lines_snapshot CHECK (length(trim(item_snapshot_json)) >= 2),
    CONSTRAINT ck_purchase_document_lines_description
        CHECK (description IS NULL OR (length(trim(description)) >= 1 AND description = trim(description))),
    CONSTRAINT ck_purchase_document_lines_source_shape
        CHECK (
            (source_system IS NULL AND source_document_id IS NULL AND source_line_id IS NULL)
            OR
            (source_system IS NOT NULL AND source_document_id IS NOT NULL
             AND length(trim(source_system)) >= 1 AND length(trim(source_document_id)) >= 1)
        )
);

CREATE INDEX ix_purchase_document_lines_document
ON purchase_document_lines(company_id, document_id, position, id);
CREATE INDEX ix_purchase_document_lines_item
ON purchase_document_lines(company_id, item_id, document_id, id);
CREATE INDEX ix_purchase_document_lines_kind
ON purchase_document_lines(company_id, line_kind, item_id, document_id, id);

CREATE TABLE purchase_document_lifecycle (
    document_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    reason TEXT,
    related_document_id TEXT,

    PRIMARY KEY (document_id, sequence),
    CONSTRAINT fk_purchase_document_lifecycle_document_same_company
        FOREIGN KEY (company_id, document_id) REFERENCES purchase_documents(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_document_lifecycle_related_same_company
        FOREIGN KEY (company_id, related_document_id) REFERENCES purchase_documents(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_document_lifecycle_sequence CHECK (sequence > 0),
    CONSTRAINT ck_purchase_document_lifecycle_from_status
        CHECK (from_status IN ('draft','submitted','approved','confirmed','cancelled','returned','corrected')),
    CONSTRAINT ck_purchase_document_lifecycle_to_status
        CHECK (to_status IN ('draft','submitted','approved','confirmed','cancelled','returned','corrected')),
    CONSTRAINT ck_purchase_document_lifecycle_actor
        CHECK (length(trim(actor_user_id)) >= 1 AND actor_user_id = trim(actor_user_id)),
    CONSTRAINT ck_purchase_document_lifecycle_reason
        CHECK (reason IS NULL OR (length(trim(reason)) >= 1 AND reason = trim(reason))),
    CONSTRAINT ck_purchase_document_lifecycle_related_shape
        CHECK (
            (to_status IN ('returned','corrected') AND related_document_id IS NOT NULL AND reason IS NOT NULL)
            OR
            (to_status NOT IN ('returned','corrected') AND related_document_id IS NULL)
        )
);

CREATE INDEX ix_purchase_document_lifecycle_company_time
ON purchase_document_lifecycle(company_id, occurred_at, document_id, sequence);

CREATE TRIGGER tr_purchase_document_lifecycle_no_update
BEFORE UPDATE ON purchase_document_lifecycle
BEGIN
    SELECT RAISE(ABORT, 'purchase_document_lifecycle is append-only');
END;
CREATE TRIGGER tr_purchase_document_lifecycle_no_delete
BEFORE DELETE ON purchase_document_lifecycle
BEGIN
    SELECT RAISE(ABORT, 'purchase_document_lifecycle is append-only');
END;

CREATE TABLE purchase_commercial_facts (
    company_id TEXT NOT NULL,
    purchase_document_id TEXT NOT NULL,
    purchase_line_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    commercial_terms_json TEXT NOT NULL,
    entered_quantity TEXT NOT NULL,
    base_quantity TEXT NOT NULL,
    entered_unit_id TEXT NOT NULL,
    base_unit_id TEXT NOT NULL,
    unit_price_amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    tax_treatment TEXT NOT NULL,
    tax_rate_basis_points INTEGER,
    updated_at TEXT NOT NULL,
    sync_origin TEXT NOT NULL DEFAULT 'local',
    server_revision INTEGER,
    sync_changed_at TEXT,

    PRIMARY KEY (purchase_document_id, purchase_line_id),
    CONSTRAINT fk_purchase_commercial_facts_line_same_document
        FOREIGN KEY (company_id, purchase_document_id, purchase_line_id)
        REFERENCES purchase_document_lines(company_id, document_id, id) ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_commercial_facts_revision CHECK (revision > 0),
    CONSTRAINT ck_purchase_commercial_facts_terms CHECK (length(trim(commercial_terms_json)) >= 2),
    CONSTRAINT ck_purchase_commercial_facts_quantities
        CHECK (length(trim(entered_quantity)) >= 1 AND entered_quantity = trim(entered_quantity)
           AND length(trim(base_quantity)) >= 1 AND base_quantity = trim(base_quantity)
           AND entered_quantity NOT IN ('0','0.0') AND base_quantity NOT IN ('0','0.0')),
    CONSTRAINT ck_purchase_commercial_facts_units
        CHECK (length(trim(entered_unit_id)) >= 1 AND length(trim(base_unit_id)) >= 1),
    CONSTRAINT ck_purchase_commercial_facts_unit_price CHECK (unit_price_amount BETWEEN 0 AND 9007199254740991),
    CONSTRAINT ck_purchase_commercial_facts_currency
        CHECK (length(currency) = 3 AND currency = upper(currency)),
    CONSTRAINT ck_purchase_commercial_facts_tax
        CHECK (
            (tax_treatment = 'taxable' AND tax_rate_basis_points BETWEEN 0 AND 10000)
            OR
            (tax_treatment IN ('unspecified','exempt','not-subject') AND tax_rate_basis_points IS NULL)
        ),
    CONSTRAINT ck_purchase_commercial_facts_sync_origin CHECK (length(trim(sync_origin)) >= 1 AND sync_origin = trim(sync_origin)),
    CONSTRAINT ck_purchase_commercial_facts_server_revision CHECK (server_revision IS NULL OR server_revision >= 0)
);

CREATE INDEX ix_purchase_commercial_facts_document
ON purchase_commercial_facts(company_id, purchase_document_id, purchase_line_id);
CREATE INDEX ix_purchase_commercial_facts_sync_changes
ON purchase_commercial_facts(company_id, sync_changed_at, purchase_document_id, purchase_line_id)
WHERE sync_changed_at IS NOT NULL;

CREATE TABLE purchase_receipt_invoice_matches (
    match_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    invoice_document_id TEXT NOT NULL,
    invoice_line_id TEXT NOT NULL,
    receipt_document_id TEXT NOT NULL,
    receipt_line_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    matched_base_quantity TEXT NOT NULL,
    created_at TEXT NOT NULL,
    sync_origin TEXT NOT NULL DEFAULT 'local',
    server_revision INTEGER,
    sync_changed_at TEXT,

    CONSTRAINT fk_purchase_matches_invoice_line_same_company
        FOREIGN KEY (company_id, invoice_document_id, invoice_line_id)
        REFERENCES purchase_document_lines(company_id, document_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_matches_receipt_line_same_company
        FOREIGN KEY (company_id, receipt_document_id, receipt_line_id)
        REFERENCES inventory_document_lines(company_id, document_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_matches_product_same_company
        FOREIGN KEY (company_id, product_id) REFERENCES products(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_purchase_matches_company_id UNIQUE (company_id, match_id),
    CONSTRAINT ck_purchase_matches_quantity
        CHECK (length(trim(matched_base_quantity)) >= 1 AND matched_base_quantity = trim(matched_base_quantity)
           AND matched_base_quantity NOT IN ('0','0.0')),
    CONSTRAINT ck_purchase_matches_sync_origin CHECK (length(trim(sync_origin)) >= 1 AND sync_origin = trim(sync_origin)),
    CONSTRAINT ck_purchase_matches_server_revision CHECK (server_revision IS NULL OR server_revision >= 0)
);

CREATE UNIQUE INDEX uq_purchase_receipt_invoice_match_pair
ON purchase_receipt_invoice_matches(company_id, invoice_document_id, invoice_line_id, receipt_document_id, receipt_line_id);
CREATE INDEX ix_purchase_matches_invoice_line
ON purchase_receipt_invoice_matches(company_id, invoice_document_id, invoice_line_id, match_id);
CREATE INDEX ix_purchase_matches_receipt_line
ON purchase_receipt_invoice_matches(company_id, receipt_document_id, receipt_line_id, match_id);
CREATE INDEX ix_purchase_matches_product
ON purchase_receipt_invoice_matches(company_id, product_id, match_id);
CREATE INDEX ix_purchase_matches_sync_changes
ON purchase_receipt_invoice_matches(company_id, sync_changed_at, match_id)
WHERE sync_changed_at IS NOT NULL;

CREATE TRIGGER tr_purchase_receipt_invoice_matches_no_update
BEFORE UPDATE ON purchase_receipt_invoice_matches
BEGIN
    SELECT RAISE(ABORT, 'purchase_receipt_invoice_matches is append-only');
END;
CREATE TRIGGER tr_purchase_receipt_invoice_matches_no_delete
BEFORE DELETE ON purchase_receipt_invoice_matches
BEGIN
    SELECT RAISE(ABORT, 'purchase_receipt_invoice_matches is append-only');
END;

CREATE TABLE purchase_valuation_cost_inputs (
    cost_input_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    movement_id TEXT NOT NULL,
    receipt_document_id TEXT NOT NULL,
    receipt_line_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    basis_line_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    currency TEXT NOT NULL,
    base_cost INTEGER NOT NULL,
    landed_cost INTEGER NOT NULL,
    total_cost INTEGER NOT NULL,
    unit_cost TEXT NOT NULL,
    sources_json TEXT NOT NULL,
    basis_json TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_origin TEXT NOT NULL DEFAULT 'local',
    server_revision INTEGER,
    sync_changed_at TEXT,

    CONSTRAINT fk_purchase_cost_inputs_movement
        FOREIGN KEY (movement_id) REFERENCES inventory_stock_movements(movement_id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_cost_inputs_receipt_line_same_company
        FOREIGN KEY (company_id, receipt_document_id, receipt_line_id)
        REFERENCES inventory_document_lines(company_id, document_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_cost_inputs_product_same_company
        FOREIGN KEY (company_id, product_id) REFERENCES products(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_cost_inputs_warehouse_same_company
        FOREIGN KEY (company_id, warehouse_id) REFERENCES warehouses(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_purchase_cost_inputs_company_id UNIQUE (company_id, cost_input_id),
    CONSTRAINT uq_purchase_cost_inputs_company_movement UNIQUE (company_id, movement_id),
    CONSTRAINT ck_purchase_cost_inputs_quantity
        CHECK (length(trim(quantity)) >= 1 AND quantity = trim(quantity) AND quantity NOT IN ('0','0.0')),
    CONSTRAINT ck_purchase_cost_inputs_currency CHECK (length(currency) = 3 AND currency = upper(currency)),
    CONSTRAINT ck_purchase_cost_inputs_amounts
        CHECK (base_cost BETWEEN 0 AND 9007199254740991 AND landed_cost BETWEEN 0 AND 9007199254740991
           AND total_cost BETWEEN 0 AND 9007199254740991 AND total_cost = base_cost + landed_cost),
    CONSTRAINT ck_purchase_cost_inputs_unit_cost CHECK (length(trim(unit_cost)) >= 1 AND unit_cost = trim(unit_cost)),
    CONSTRAINT ck_purchase_cost_inputs_sources CHECK (length(trim(sources_json)) >= 2),
    CONSTRAINT ck_purchase_cost_inputs_basis CHECK (length(trim(basis_json)) >= 2),
    CONSTRAINT ck_purchase_cost_inputs_revision CHECK (revision > 0),
    CONSTRAINT ck_purchase_cost_inputs_sync_origin CHECK (length(trim(sync_origin)) >= 1 AND sync_origin = trim(sync_origin)),
    CONSTRAINT ck_purchase_cost_inputs_server_revision CHECK (server_revision IS NULL OR server_revision >= 0)
);

CREATE INDEX ix_purchase_cost_inputs_movement
ON purchase_valuation_cost_inputs(company_id, movement_id, cost_input_id);
CREATE INDEX ix_purchase_cost_inputs_receipt_line
ON purchase_valuation_cost_inputs(company_id, receipt_document_id, receipt_line_id, cost_input_id);
CREATE INDEX ix_purchase_cost_inputs_product
ON purchase_valuation_cost_inputs(company_id, product_id, movement_id);
CREATE INDEX ix_purchase_cost_inputs_sync_changes
ON purchase_valuation_cost_inputs(company_id, sync_changed_at, cost_input_id)
WHERE sync_changed_at IS NOT NULL;

CREATE TABLE purchase_idempotency (
    company_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_fingerprint TEXT NOT NULL,
    outcome_kind TEXT NOT NULL,
    outcome_id TEXT NOT NULL,
    outcome_version INTEGER,
    outcome_status TEXT,
    recorded_at TEXT NOT NULL,

    PRIMARY KEY (company_id, request_id),
    UNIQUE (company_id, operation_id),
    CONSTRAINT fk_purchase_idempotency_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_idempotency_request_id CHECK (length(trim(request_id)) >= 1 AND request_id = trim(request_id)),
    CONSTRAINT ck_purchase_idempotency_operation_id CHECK (length(trim(operation_id)) >= 1 AND operation_id = trim(operation_id)),
    CONSTRAINT ck_purchase_idempotency_operation CHECK (length(trim(operation)) >= 1 AND operation = trim(operation)),
    CONSTRAINT ck_purchase_idempotency_fingerprint CHECK (length(trim(payload_fingerprint)) >= 1 AND payload_fingerprint = trim(payload_fingerprint)),
    CONSTRAINT ck_purchase_idempotency_outcome_kind
        CHECK (outcome_kind IN ('document','inventory-receipt','match','cost-resolution')),
    CONSTRAINT ck_purchase_idempotency_outcome_id CHECK (length(trim(outcome_id)) >= 1 AND outcome_id = trim(outcome_id)),
    CONSTRAINT ck_purchase_idempotency_outcome_version CHECK (outcome_version IS NULL OR outcome_version >= 1)
);

CREATE INDEX ix_purchase_idempotency_operation
ON purchase_idempotency(company_id, operation, recorded_at, request_id);
CREATE INDEX ix_purchase_idempotency_outcome
ON purchase_idempotency(company_id, outcome_kind, outcome_id, recorded_at);
