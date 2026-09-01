PRAGMA foreign_keys = ON;

ALTER TABLE products
ADD COLUMN deleted_at TEXT;

CREATE TABLE product_sync_external_references (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    source_system TEXT NOT NULL,
    external_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_product_sync_external_reference_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_product_sync_external_reference_source
        UNIQUE (company_id, source_system, external_id),

    CONSTRAINT uq_product_sync_external_reference_product
        UNIQUE (product_id, source_system, external_id),

    CONSTRAINT ck_product_sync_external_reference_source
        CHECK (
            length(trim(source_system)) BETWEEN 1 AND 100
            AND source_system = trim(source_system)
        ),

    CONSTRAINT ck_product_sync_external_reference_id
        CHECK (
            length(trim(external_id)) BETWEEN 1 AND 200
            AND external_id = trim(external_id)
        )
);

CREATE INDEX ix_products_sync_changes
ON products(company_id, updated_at, version, id);

CREATE INDEX ix_products_tombstones
ON products(company_id, deleted_at, id)
WHERE deleted_at IS NOT NULL;

CREATE INDEX ix_product_sync_external_references_product
ON product_sync_external_references(company_id, product_id, source_system, external_id);
