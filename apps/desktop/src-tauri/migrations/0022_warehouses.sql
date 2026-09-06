PRAGMA foreign_keys = ON;

-- Composite Branch key is required so Warehouse branch scope can enforce Company ownership.
CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_company_id
ON branches(company_id, id);

CREATE TABLE warehouses (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    code TEXT NOT NULL COLLATE NOCASE,
    title TEXT NOT NULL,
    description TEXT,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    organizational_scope TEXT NOT NULL,
    branch_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_warehouses_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_warehouses_branch_same_company
        FOREIGN KEY (company_id, branch_id)
        REFERENCES branches(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_warehouses_company_code
        UNIQUE (company_id, code),

    CONSTRAINT uq_warehouses_company_id
        UNIQUE (company_id, id),

    CONSTRAINT ck_warehouses_kind
        CHECK (
            kind IN (
                'general',
                'raw-material',
                'finished-goods',
                'consumables',
                'spare-parts',
                'wip',
                'transit',
                'consignment',
                'other'
            )
        ),

    CONSTRAINT ck_warehouses_status
        CHECK (status IN ('active', 'inactive', 'archived')),

    CONSTRAINT ck_warehouses_scope
        CHECK (
            (organizational_scope = 'company' AND branch_id IS NULL)
            OR
            (organizational_scope = 'branch' AND branch_id IS NOT NULL)
        ),

    CONSTRAINT ck_warehouses_code
        CHECK (length(trim(code)) BETWEEN 1 AND 100 AND code = trim(code)),

    CONSTRAINT ck_warehouses_title
        CHECK (length(trim(title)) >= 1 AND title = trim(title)),

    CONSTRAINT ck_warehouses_description
        CHECK (description IS NULL OR (length(trim(description)) >= 1 AND description = trim(description))),

    CONSTRAINT ck_warehouses_version
        CHECK (version >= 1),

    CONSTRAINT ck_warehouses_timestamp_order
        CHECK (updated_at >= created_at)
);

CREATE TABLE warehouse_external_identifiers (
    company_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    namespace TEXT NOT NULL COLLATE NOCASE,
    value TEXT NOT NULL,

    PRIMARY KEY (warehouse_id, namespace, value),

    CONSTRAINT fk_warehouse_external_identifiers_same_company
        FOREIGN KEY (company_id, warehouse_id)
        REFERENCES warehouses(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT ck_warehouse_external_identifiers_namespace
        CHECK (length(trim(namespace)) >= 1 AND namespace = trim(namespace)),

    CONSTRAINT ck_warehouse_external_identifiers_value
        CHECK (length(trim(value)) >= 1 AND value = trim(value))
);

CREATE UNIQUE INDEX uq_warehouse_external_identifiers_company_namespace_value
ON warehouse_external_identifiers(company_id, namespace, value);

CREATE TABLE warehouse_zones (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    code TEXT NOT NULL COLLATE NOCASE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_warehouse_zones_same_company
        FOREIGN KEY (company_id, warehouse_id)
        REFERENCES warehouses(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_warehouse_zones_company_warehouse_id
        UNIQUE (company_id, warehouse_id, id),

    CONSTRAINT uq_warehouse_zones_warehouse_code
        UNIQUE (company_id, warehouse_id, code),

    CONSTRAINT ck_warehouse_zones_status
        CHECK (status IN ('active', 'inactive')),

    CONSTRAINT ck_warehouse_zones_code
        CHECK (length(trim(code)) >= 1 AND code = trim(code)),

    CONSTRAINT ck_warehouse_zones_title
        CHECK (length(trim(title)) >= 1 AND title = trim(title)),

    CONSTRAINT ck_warehouse_zones_description
        CHECK (description IS NULL OR (length(trim(description)) >= 1 AND description = trim(description))),

    CONSTRAINT ck_warehouse_zones_timestamp_order
        CHECK (updated_at >= created_at)
);

CREATE TABLE warehouse_locations (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    zone_id TEXT NOT NULL,
    parent_location_id TEXT,
    code TEXT NOT NULL COLLATE NOCASE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_warehouse_locations_zone_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id)
        REFERENCES warehouse_zones(company_id, warehouse_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_warehouse_locations_parent_same_scope
        FOREIGN KEY (company_id, warehouse_id, zone_id, parent_location_id)
        REFERENCES warehouse_locations(company_id, warehouse_id, zone_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_warehouse_locations_scope_id
        UNIQUE (company_id, warehouse_id, zone_id, id),

    CONSTRAINT uq_warehouse_locations_zone_code
        UNIQUE (company_id, warehouse_id, zone_id, code),

    CONSTRAINT ck_warehouse_locations_parent
        CHECK (parent_location_id IS NULL OR parent_location_id <> id),

    CONSTRAINT ck_warehouse_locations_kind
        CHECK (
            kind IN (
                'bin',
                'rack',
                'shelf',
                'staging',
                'receiving',
                'dispatch',
                'other'
            )
        ),

    CONSTRAINT ck_warehouse_locations_status
        CHECK (status IN ('active', 'inactive')),

    CONSTRAINT ck_warehouse_locations_code
        CHECK (length(trim(code)) >= 1 AND code = trim(code)),

    CONSTRAINT ck_warehouse_locations_title
        CHECK (length(trim(title)) >= 1 AND title = trim(title)),

    CONSTRAINT ck_warehouse_locations_description
        CHECK (description IS NULL OR (length(trim(description)) >= 1 AND description = trim(description))),

    CONSTRAINT ck_warehouse_locations_timestamp_order
        CHECK (updated_at >= created_at)
);

-- Master-data lookup, list, selector, organization-scope and future consumer paths.
CREATE INDEX ix_warehouses_company_status_title
ON warehouses(company_id, status, title, id);

CREATE INDEX ix_warehouses_company_kind_status_title
ON warehouses(company_id, kind, status, title, id);

CREATE INDEX ix_warehouses_company_scope_branch_status
ON warehouses(company_id, organizational_scope, branch_id, status, title, id);

CREATE INDEX ix_warehouses_company_updated
ON warehouses(company_id, updated_at DESC, id);

CREATE INDEX ix_warehouse_external_identifiers_warehouse
ON warehouse_external_identifiers(company_id, warehouse_id, namespace, value);

CREATE INDEX ix_warehouse_zones_warehouse_status_code
ON warehouse_zones(company_id, warehouse_id, status, code, id);

CREATE INDEX ix_warehouse_locations_warehouse_zone_status_code
ON warehouse_locations(company_id, warehouse_id, zone_id, status, code, id);

CREATE INDEX ix_warehouse_locations_parent
ON warehouse_locations(company_id, warehouse_id, zone_id, parent_location_id, id)
WHERE parent_location_id IS NOT NULL;
