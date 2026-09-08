PRAGMA foreign_keys = ON;

-- Phase 20 Inventory Documents persistence foundation.
-- Immutable movement facts are authoritative; inventory_stock_balances is a rebuildable projection.

CREATE TABLE inventory_documents (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    document_number TEXT,
    business_date TEXT NOT NULL,
    description TEXT,
    origin_branch_id TEXT,
    destination_branch_id TEXT,
    fiscal_year_id TEXT NOT NULL,
    fiscal_period_id TEXT NOT NULL,
    source_system TEXT,
    source_document_type TEXT,
    source_document_id TEXT,
    source_line_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    sync_origin TEXT NOT NULL DEFAULT 'local',
    server_revision INTEGER,
    sync_changed_at TEXT,

    CONSTRAINT fk_inventory_documents_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_documents_origin_branch_same_company
        FOREIGN KEY (company_id, origin_branch_id)
        REFERENCES branches(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_documents_destination_branch_same_company
        FOREIGN KEY (company_id, destination_branch_id)
        REFERENCES branches(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_documents_fiscal_year
        FOREIGN KEY (fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_documents_fiscal_period
        FOREIGN KEY (fiscal_period_id)
        REFERENCES fiscal_periods(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_inventory_documents_company_id
        UNIQUE (company_id, id),

    CONSTRAINT ck_inventory_documents_type
        CHECK (document_type IN ('receipt', 'issue', 'opening', 'transfer', 'adjustment')),

    CONSTRAINT ck_inventory_documents_status
        CHECK (status IN ('draft', 'submitted', 'approved', 'confirmed', 'cancelled', 'reversed')),

    CONSTRAINT ck_inventory_documents_number
        CHECK (document_number IS NULL OR (length(trim(document_number)) >= 1 AND document_number = trim(document_number))),

    CONSTRAINT ck_inventory_documents_description
        CHECK (description IS NULL OR (length(trim(description)) >= 1 AND description = trim(description))),

    CONSTRAINT ck_inventory_documents_source_shape
        CHECK (
            (source_system IS NULL AND source_document_type IS NULL AND source_document_id IS NULL AND source_line_id IS NULL)
            OR
            (
                source_system IS NOT NULL
                AND source_document_type IS NOT NULL
                AND source_document_id IS NOT NULL
                AND length(trim(source_system)) >= 1
                AND length(trim(source_document_type)) >= 1
                AND length(trim(source_document_id)) >= 1
            )
        ),

    CONSTRAINT ck_inventory_documents_version
        CHECK (version >= 1),

    CONSTRAINT ck_inventory_documents_timestamp_order
        CHECK (updated_at >= created_at),

    CONSTRAINT ck_inventory_documents_tombstone
        CHECK (deleted_at IS NULL OR status = 'draft'),

    CONSTRAINT ck_inventory_documents_sync_origin
        CHECK (length(trim(sync_origin)) >= 1 AND sync_origin = trim(sync_origin)),

    CONSTRAINT ck_inventory_documents_server_revision
        CHECK (server_revision IS NULL OR server_revision >= 0)
);

CREATE UNIQUE INDEX uq_inventory_documents_number_scope
ON inventory_documents(
    company_id,
    fiscal_year_id,
    COALESCE(origin_branch_id, ''),
    document_type,
    document_number
)
WHERE document_number IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_inventory_documents_source
ON inventory_documents(company_id, source_system, source_document_type, source_document_id)
WHERE source_system IS NOT NULL AND source_document_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX ix_inventory_documents_list
ON inventory_documents(company_id, status, business_date DESC, id)
WHERE deleted_at IS NULL;

CREATE INDEX ix_inventory_documents_type_date
ON inventory_documents(company_id, document_type, business_date DESC, id)
WHERE deleted_at IS NULL;

CREATE INDEX ix_inventory_documents_branch_date
ON inventory_documents(company_id, origin_branch_id, business_date DESC, id)
WHERE deleted_at IS NULL;

CREATE INDEX ix_inventory_documents_fiscal
ON inventory_documents(company_id, fiscal_year_id, fiscal_period_id, business_date, id)
WHERE deleted_at IS NULL;

CREATE INDEX ix_inventory_documents_tombstones
ON inventory_documents(company_id, deleted_at, id)
WHERE deleted_at IS NOT NULL;

CREATE INDEX ix_inventory_documents_sync_changes
ON inventory_documents(company_id, sync_changed_at, id)
WHERE sync_changed_at IS NOT NULL;

CREATE TABLE inventory_document_lines (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    description TEXT,
    source_system TEXT,
    source_document_type TEXT,
    source_document_id TEXT,
    source_line_id TEXT,
    entered_quantity TEXT,
    base_quantity TEXT,
    entered_unit_id TEXT,
    base_unit_id TEXT,
    quantity_snapshot TEXT,
    warehouse_id TEXT,
    zone_id TEXT,
    location_id TEXT,
    destination_warehouse_id TEXT,
    destination_zone_id TEXT,
    destination_location_id TEXT,

    CONSTRAINT fk_inventory_document_lines_document_same_company
        FOREIGN KEY (company_id, document_id)
        REFERENCES inventory_documents(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_document_lines_product_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_document_lines_warehouse_same_company
        FOREIGN KEY (company_id, warehouse_id)
        REFERENCES warehouses(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_document_lines_zone_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id)
        REFERENCES warehouse_zones(company_id, warehouse_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_document_lines_location_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id, location_id)
        REFERENCES warehouse_locations(company_id, warehouse_id, zone_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_document_lines_destination_warehouse_same_company
        FOREIGN KEY (company_id, destination_warehouse_id)
        REFERENCES warehouses(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_document_lines_destination_zone_same_scope
        FOREIGN KEY (company_id, destination_warehouse_id, destination_zone_id)
        REFERENCES warehouse_zones(company_id, warehouse_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_document_lines_destination_location_same_scope
        FOREIGN KEY (company_id, destination_warehouse_id, destination_zone_id, destination_location_id)
        REFERENCES warehouse_locations(company_id, warehouse_id, zone_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_inventory_document_lines_company_document_id
        UNIQUE (company_id, document_id, id),

    CONSTRAINT uq_inventory_document_lines_position
        UNIQUE (document_id, position),

    CONSTRAINT ck_inventory_document_lines_position
        CHECK (position > 0),

    CONSTRAINT ck_inventory_document_lines_description
        CHECK (description IS NULL OR (length(trim(description)) >= 1 AND description = trim(description))),

    CONSTRAINT ck_inventory_document_lines_source_shape
        CHECK (
            (source_system IS NULL AND source_document_type IS NULL AND source_document_id IS NULL AND source_line_id IS NULL)
            OR
            (
                source_system IS NOT NULL
                AND source_document_type IS NOT NULL
                AND source_document_id IS NOT NULL
                AND length(trim(source_system)) >= 1
                AND length(trim(source_document_type)) >= 1
                AND length(trim(source_document_id)) >= 1
            )
        ),

    CONSTRAINT ck_inventory_document_lines_operation_shape
        CHECK (
            (
                entered_quantity IS NULL AND base_quantity IS NULL
                AND entered_unit_id IS NULL AND base_unit_id IS NULL
                AND quantity_snapshot IS NULL
                AND warehouse_id IS NULL AND zone_id IS NULL AND location_id IS NULL
                AND destination_warehouse_id IS NULL AND destination_zone_id IS NULL AND destination_location_id IS NULL
            )
            OR
            (
                entered_quantity IS NOT NULL AND length(trim(entered_quantity)) >= 1 AND entered_quantity = trim(entered_quantity)
                AND base_quantity IS NOT NULL AND length(trim(base_quantity)) >= 1 AND base_quantity = trim(base_quantity)
                AND entered_unit_id IS NOT NULL AND length(trim(entered_unit_id)) >= 1
                AND base_unit_id IS NOT NULL AND length(trim(base_unit_id)) >= 1
                AND quantity_snapshot IS NOT NULL AND length(quantity_snapshot) >= 2
                AND warehouse_id IS NOT NULL
                AND (location_id IS NULL OR zone_id IS NOT NULL)
                AND (destination_location_id IS NULL OR destination_zone_id IS NOT NULL)
                AND (destination_zone_id IS NULL OR destination_warehouse_id IS NOT NULL)
            )
        )
);

CREATE INDEX ix_inventory_document_lines_document
ON inventory_document_lines(company_id, document_id, position, id);

CREATE INDEX ix_inventory_document_lines_product
ON inventory_document_lines(company_id, product_id, document_id, id);

CREATE INDEX ix_inventory_document_lines_warehouse
ON inventory_document_lines(company_id, warehouse_id, product_id, document_id, id)
WHERE warehouse_id IS NOT NULL;

CREATE INDEX ix_inventory_document_lines_destination_warehouse
ON inventory_document_lines(company_id, destination_warehouse_id, product_id, document_id, id)
WHERE destination_warehouse_id IS NOT NULL;

CREATE TABLE inventory_document_lifecycle (
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

    CONSTRAINT fk_inventory_document_lifecycle_document_same_company
        FOREIGN KEY (company_id, document_id)
        REFERENCES inventory_documents(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_inventory_document_lifecycle_sequence
        CHECK (sequence > 0),

    CONSTRAINT ck_inventory_document_lifecycle_from_status
        CHECK (from_status IN ('draft', 'submitted', 'approved', 'confirmed', 'cancelled', 'reversed')),

    CONSTRAINT ck_inventory_document_lifecycle_to_status
        CHECK (to_status IN ('draft', 'submitted', 'approved', 'confirmed', 'cancelled', 'reversed')),

    CONSTRAINT ck_inventory_document_lifecycle_actor
        CHECK (length(trim(actor_user_id)) >= 1 AND actor_user_id = trim(actor_user_id)),

    CONSTRAINT ck_inventory_document_lifecycle_reason
        CHECK (reason IS NULL OR (length(trim(reason)) >= 1 AND reason = trim(reason))),

    CONSTRAINT ck_inventory_document_lifecycle_reversal_link
        CHECK (
            (to_status = 'reversed' AND related_document_id IS NOT NULL)
            OR
            (to_status <> 'reversed' AND related_document_id IS NULL)
        )
);

CREATE INDEX ix_inventory_document_lifecycle_company_time
ON inventory_document_lifecycle(company_id, occurred_at, document_id, sequence);

CREATE TRIGGER tr_inventory_document_lifecycle_no_update
BEFORE UPDATE ON inventory_document_lifecycle
BEGIN
    SELECT RAISE(ABORT, 'inventory_document_lifecycle is append-only');
END;

CREATE TRIGGER tr_inventory_document_lifecycle_no_delete
BEFORE DELETE ON inventory_document_lifecycle
BEGIN
    SELECT RAISE(ABORT, 'inventory_document_lifecycle is append-only');
END;

CREATE TABLE inventory_stock_movements (
    movement_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    line_id TEXT NOT NULL,
    transfer_id TEXT,
    reversal_of_movement_id TEXT,
    product_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    zone_id TEXT,
    location_id TEXT,
    business_date TEXT NOT NULL,
    business_order INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    quantity_delta TEXT NOT NULL,

    CONSTRAINT fk_inventory_stock_movements_document_same_company
        FOREIGN KEY (company_id, document_id)
        REFERENCES inventory_documents(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_stock_movements_line_same_document
        FOREIGN KEY (company_id, document_id, line_id)
        REFERENCES inventory_document_lines(company_id, document_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_stock_movements_product_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_stock_movements_warehouse_same_company
        FOREIGN KEY (company_id, warehouse_id)
        REFERENCES warehouses(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_stock_movements_zone_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id)
        REFERENCES warehouse_zones(company_id, warehouse_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_stock_movements_location_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id, location_id)
        REFERENCES warehouse_locations(company_id, warehouse_id, zone_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_stock_movements_reversal
        FOREIGN KEY (reversal_of_movement_id)
        REFERENCES inventory_stock_movements(movement_id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_inventory_stock_movements_business_order
        CHECK (business_order > 0),

    CONSTRAINT ck_inventory_stock_movements_quantity
        CHECK (
            length(trim(quantity_delta)) >= 1
            AND quantity_delta = trim(quantity_delta)
            AND quantity_delta NOT IN ('0', '0.0', '-0', '-0.0')
        ),

    CONSTRAINT ck_inventory_stock_movements_location_shape
        CHECK (location_id IS NULL OR zone_id IS NOT NULL),

    CONSTRAINT ck_inventory_stock_movements_reversal_identity
        CHECK (reversal_of_movement_id IS NULL OR reversal_of_movement_id <> movement_id)
);

CREATE UNIQUE INDEX uq_inventory_stock_movements_source_stock_key
ON inventory_stock_movements(
    company_id,
    document_id,
    line_id,
    warehouse_id,
    COALESCE(zone_id, ''),
    COALESCE(location_id, '')
);

CREATE UNIQUE INDEX uq_inventory_stock_movements_reversal_once
ON inventory_stock_movements(reversal_of_movement_id)
WHERE reversal_of_movement_id IS NOT NULL;

CREATE INDEX ix_inventory_stock_movements_document
ON inventory_stock_movements(company_id, document_id, line_id, movement_id);

CREATE INDEX ix_inventory_stock_movements_transfer
ON inventory_stock_movements(company_id, transfer_id, document_id, line_id, movement_id)
WHERE transfer_id IS NOT NULL;

CREATE INDEX ix_inventory_stock_movements_stock_kardex
ON inventory_stock_movements(
    company_id,
    product_id,
    warehouse_id,
    zone_id,
    location_id,
    business_date,
    business_order,
    document_id,
    line_id,
    movement_id
);

CREATE INDEX ix_inventory_stock_movements_product_date
ON inventory_stock_movements(company_id, product_id, business_date, business_order, movement_id);

CREATE INDEX ix_inventory_stock_movements_recorded
ON inventory_stock_movements(company_id, recorded_at, movement_id);

CREATE TRIGGER tr_inventory_stock_movements_no_update
BEFORE UPDATE ON inventory_stock_movements
BEGIN
    SELECT RAISE(ABORT, 'inventory_stock_movements is append-only');
END;

CREATE TRIGGER tr_inventory_stock_movements_no_delete
BEFORE DELETE ON inventory_stock_movements
BEGIN
    SELECT RAISE(ABORT, 'inventory_stock_movements is append-only');
END;

CREATE TABLE inventory_opening_balances (
    opening_key TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    fiscal_year_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    line_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    zone_id TEXT,
    location_id TEXT,
    created_at TEXT NOT NULL,

    CONSTRAINT fk_inventory_opening_balances_document_same_company
        FOREIGN KEY (company_id, document_id)
        REFERENCES inventory_documents(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_opening_balances_line_same_document
        FOREIGN KEY (company_id, document_id, line_id)
        REFERENCES inventory_document_lines(company_id, document_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_opening_balances_fiscal_year
        FOREIGN KEY (fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_opening_balances_product_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_opening_balances_warehouse_same_company
        FOREIGN KEY (company_id, warehouse_id)
        REFERENCES warehouses(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_opening_balances_zone_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id)
        REFERENCES warehouse_zones(company_id, warehouse_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_opening_balances_location_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id, location_id)
        REFERENCES warehouse_locations(company_id, warehouse_id, zone_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_inventory_opening_balances_location_shape
        CHECK (location_id IS NULL OR zone_id IS NOT NULL)
);

CREATE UNIQUE INDEX uq_inventory_opening_balances_fiscal_stock_key
ON inventory_opening_balances(
    company_id,
    fiscal_year_id,
    product_id,
    warehouse_id,
    COALESCE(zone_id, ''),
    COALESCE(location_id, '')
);

CREATE INDEX ix_inventory_opening_balances_document
ON inventory_opening_balances(company_id, document_id, line_id);

CREATE TRIGGER tr_inventory_opening_balances_no_update
BEFORE UPDATE ON inventory_opening_balances
BEGIN
    SELECT RAISE(ABORT, 'inventory_opening_balances is append-only');
END;

CREATE TRIGGER tr_inventory_opening_balances_no_delete
BEFORE DELETE ON inventory_opening_balances
BEGIN
    SELECT RAISE(ABORT, 'inventory_opening_balances is append-only');
END;

CREATE TABLE inventory_stock_balances (
    stock_key TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    zone_id TEXT,
    location_id TEXT,
    quantity TEXT NOT NULL,
    last_business_date TEXT,
    last_business_order INTEGER,
    last_movement_id TEXT,
    rebuilt_at TEXT NOT NULL,

    CONSTRAINT fk_inventory_stock_balances_product_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_stock_balances_warehouse_same_company
        FOREIGN KEY (company_id, warehouse_id)
        REFERENCES warehouses(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_stock_balances_zone_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id)
        REFERENCES warehouse_zones(company_id, warehouse_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_stock_balances_location_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id, location_id)
        REFERENCES warehouse_locations(company_id, warehouse_id, zone_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_stock_balances_last_movement
        FOREIGN KEY (last_movement_id)
        REFERENCES inventory_stock_movements(movement_id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_inventory_stock_balances_quantity
        CHECK (length(trim(quantity)) >= 1 AND quantity = trim(quantity)),

    CONSTRAINT ck_inventory_stock_balances_location_shape
        CHECK (location_id IS NULL OR zone_id IS NOT NULL),

    CONSTRAINT ck_inventory_stock_balances_last_order
        CHECK (
            (last_business_date IS NULL AND last_business_order IS NULL AND last_movement_id IS NULL)
            OR
            (last_business_date IS NOT NULL AND last_business_order > 0 AND last_movement_id IS NOT NULL)
        )
);

CREATE UNIQUE INDEX uq_inventory_stock_balances_stock_key
ON inventory_stock_balances(
    company_id,
    product_id,
    warehouse_id,
    COALESCE(zone_id, ''),
    COALESCE(location_id, '')
);

CREATE INDEX ix_inventory_stock_balances_company_warehouse
ON inventory_stock_balances(company_id, warehouse_id, product_id, stock_key);

CREATE INDEX ix_inventory_stock_balances_company_product
ON inventory_stock_balances(company_id, product_id, warehouse_id, stock_key);

CREATE TABLE inventory_business_orders (
    company_id TEXT NOT NULL,
    business_date TEXT NOT NULL,
    last_order INTEGER NOT NULL,

    PRIMARY KEY (company_id, business_date),

    CONSTRAINT fk_inventory_business_orders_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_inventory_business_orders_value
        CHECK (last_order > 0)
);

CREATE TABLE inventory_idempotency (
    company_id TEXT NOT NULL,
    request_key TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_fingerprint TEXT NOT NULL,
    outcome_kind TEXT NOT NULL,
    document_id TEXT NOT NULL,
    document_version INTEGER,
    document_status TEXT NOT NULL,
    recorded_at TEXT NOT NULL,

    PRIMARY KEY (company_id, request_key),

    CONSTRAINT fk_inventory_idempotency_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_idempotency_document_same_company
        FOREIGN KEY (company_id, document_id)
        REFERENCES inventory_documents(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_inventory_idempotency_request_key
        CHECK (length(trim(request_key)) >= 1 AND request_key = trim(request_key)),

    CONSTRAINT ck_inventory_idempotency_operation
        CHECK (length(trim(operation)) >= 1 AND operation = trim(operation)),

    CONSTRAINT ck_inventory_idempotency_fingerprint
        CHECK (length(trim(payload_fingerprint)) >= 1 AND payload_fingerprint = trim(payload_fingerprint)),

    CONSTRAINT ck_inventory_idempotency_outcome
        CHECK (outcome_kind IN ('document', 'confirmation', 'reversal', 'deletion')),

    CONSTRAINT ck_inventory_idempotency_document_version
        CHECK (document_version IS NULL OR document_version >= 1),

    CONSTRAINT ck_inventory_idempotency_document_status
        CHECK (document_status IN ('draft', 'submitted', 'approved', 'confirmed', 'cancelled', 'reversed'))
);

CREATE INDEX ix_inventory_idempotency_document
ON inventory_idempotency(company_id, document_id, recorded_at, request_key);
