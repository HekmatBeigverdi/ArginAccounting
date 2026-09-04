PRAGMA foreign_keys = ON;

ALTER TABLE warehouses
ADD COLUMN deleted_at TEXT;

ALTER TABLE warehouses
ADD COLUMN origin_system TEXT NOT NULL DEFAULT 'argin-desktop';

ALTER TABLE warehouses
ADD COLUMN origin_instance_id TEXT;

ALTER TABLE warehouses
ADD COLUMN server_revision INTEGER;

CREATE TABLE warehouse_sync_external_references (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    source_system TEXT NOT NULL COLLATE NOCASE,
    external_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_warehouse_sync_external_reference_same_company
        FOREIGN KEY (company_id, warehouse_id)
        REFERENCES warehouses(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_warehouse_sync_external_reference_source
        UNIQUE (company_id, source_system, external_id),

    CONSTRAINT uq_warehouse_sync_external_reference_warehouse
        UNIQUE (warehouse_id, source_system, external_id),

    CONSTRAINT ck_warehouse_sync_external_reference_source
        CHECK (
            length(trim(source_system)) BETWEEN 1 AND 100
            AND source_system = trim(source_system)
        ),

    CONSTRAINT ck_warehouse_sync_external_reference_id
        CHECK (
            length(trim(external_id)) BETWEEN 1 AND 200
            AND external_id = trim(external_id)
        ),

    CONSTRAINT ck_warehouse_sync_external_reference_timestamp_order
        CHECK (updated_at >= created_at)
);

CREATE INDEX ix_warehouses_sync_changes
ON warehouses(company_id, updated_at, version, id);

CREATE INDEX ix_warehouses_tombstones
ON warehouses(company_id, deleted_at, id)
WHERE deleted_at IS NOT NULL;

CREATE INDEX ix_warehouses_server_revision
ON warehouses(company_id, server_revision, id)
WHERE server_revision IS NOT NULL;

CREATE INDEX ix_warehouse_sync_external_references_warehouse
ON warehouse_sync_external_references(company_id, warehouse_id, source_system, external_id);
