PRAGMA foreign_keys = ON;

-- Step 13 correction: reversal effects carry their own effect-document identity while
-- retaining the durable source line identity from the original immutable movement.
-- Keep ordinary confirmation/transfer facts in inventory_stock_movements and store
-- compensation facts in this append-only physical partition. Application repositories
-- expose both partitions as one authoritative movement ledger.
CREATE TABLE inventory_stock_movement_compensations (
    movement_id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    effect_document_id TEXT NOT NULL,
    source_line_id TEXT NOT NULL,
    original_movement_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    zone_id TEXT,
    location_id TEXT,
    business_date TEXT NOT NULL,
    business_order INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    quantity_delta TEXT NOT NULL,

    CONSTRAINT fk_inventory_compensation_original
        FOREIGN KEY (original_movement_id)
        REFERENCES inventory_stock_movements(movement_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_compensation_source_line
        FOREIGN KEY (source_line_id)
        REFERENCES inventory_document_lines(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_compensation_product_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_compensation_warehouse_same_company
        FOREIGN KEY (company_id, warehouse_id)
        REFERENCES warehouses(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_compensation_zone_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id)
        REFERENCES warehouse_zones(company_id, warehouse_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_compensation_location_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id, location_id)
        REFERENCES warehouse_locations(company_id, warehouse_id, zone_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_inventory_compensation_original_once
        UNIQUE (original_movement_id),

    CONSTRAINT ck_inventory_compensation_effect_document
        CHECK (length(trim(effect_document_id)) >= 1 AND effect_document_id = trim(effect_document_id)),

    CONSTRAINT ck_inventory_compensation_business_order
        CHECK (business_order > 0),

    CONSTRAINT ck_inventory_compensation_quantity
        CHECK (length(trim(quantity_delta)) >= 1 AND quantity_delta = trim(quantity_delta)
               AND quantity_delta NOT IN ('0', '0.0', '-0', '-0.0')),

    CONSTRAINT ck_inventory_compensation_location_shape
        CHECK (location_id IS NULL OR zone_id IS NOT NULL)
);

CREATE INDEX ix_inventory_compensation_effect_document
ON inventory_stock_movement_compensations(company_id, effect_document_id, source_line_id, movement_id);

CREATE INDEX ix_inventory_compensation_stock_kardex
ON inventory_stock_movement_compensations(
    company_id, product_id, warehouse_id, zone_id, location_id,
    business_date, business_order, effect_document_id, source_line_id, movement_id
);

CREATE INDEX ix_inventory_compensation_recorded
ON inventory_stock_movement_compensations(company_id, recorded_at, movement_id);

CREATE TRIGGER tr_inventory_compensation_no_update
BEFORE UPDATE ON inventory_stock_movement_compensations
BEGIN
    SELECT RAISE(ABORT, 'inventory_stock_movement_compensations is append-only');
END;

CREATE TRIGGER tr_inventory_compensation_no_delete
BEFORE DELETE ON inventory_stock_movement_compensations
BEGIN
    SELECT RAISE(ABORT, 'inventory_stock_movement_compensations is append-only');
END;

CREATE VIEW inventory_all_stock_movements AS
SELECT
    movement_id,
    company_id,
    document_id,
    line_id,
    transfer_id,
    reversal_of_movement_id,
    product_id,
    warehouse_id,
    zone_id,
    location_id,
    business_date,
    business_order,
    recorded_at,
    quantity_delta
FROM inventory_stock_movements
UNION ALL
SELECT
    movement_id,
    company_id,
    effect_document_id AS document_id,
    source_line_id AS line_id,
    NULL AS transfer_id,
    original_movement_id AS reversal_of_movement_id,
    product_id,
    warehouse_id,
    zone_id,
    location_id,
    business_date,
    business_order,
    recorded_at,
    quantity_delta
FROM inventory_stock_movement_compensations;
