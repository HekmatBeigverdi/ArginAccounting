PRAGMA foreign_keys = ON;

CREATE TABLE products (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    category_id TEXT,
    purchasable INTEGER NOT NULL DEFAULT 1,
    sellable INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_products_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_products_company_code
        UNIQUE (company_id, code),

    CONSTRAINT uq_products_company_id
        UNIQUE (company_id, id),

    CONSTRAINT ck_products_kind
        CHECK (kind IN ('product', 'service')),

    CONSTRAINT ck_products_status
        CHECK (status IN ('active', 'inactive')),

    CONSTRAINT ck_products_code
        CHECK (length(trim(code)) BETWEEN 1 AND 100 AND code = trim(code)),

    CONSTRAINT ck_products_title
        CHECK (length(trim(title)) >= 1 AND title = trim(title)),

    CONSTRAINT ck_products_capabilities
        CHECK (purchasable IN (0, 1) AND sellable IN (0, 1)),

    CONSTRAINT ck_products_version
        CHECK (version >= 1)
);

CREATE TABLE product_identifiers (
    company_id TEXT NOT NULL,
    product_id TEXT PRIMARY KEY NOT NULL,
    sku TEXT,
    reference_code TEXT,
    taxpayer_goods_service_id TEXT,

    CONSTRAINT fk_product_identifiers_product_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT ck_product_identifiers_sku
        CHECK (sku IS NULL OR (length(trim(sku)) >= 1 AND sku = trim(sku))),

    CONSTRAINT ck_product_identifiers_reference_code
        CHECK (
            reference_code IS NULL
            OR (length(trim(reference_code)) >= 1 AND reference_code = trim(reference_code))
        ),

    CONSTRAINT ck_product_identifiers_taxpayer_id
        CHECK (
            taxpayer_goods_service_id IS NULL
            OR (
                length(taxpayer_goods_service_id) = 13
                AND taxpayer_goods_service_id NOT GLOB '*[^0-9]*'
            )
        )
);

CREATE TABLE product_barcodes (
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    barcode TEXT NOT NULL,

    PRIMARY KEY (product_id, barcode),

    CONSTRAINT fk_product_barcodes_product_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT ck_product_barcodes_value
        CHECK (length(trim(barcode)) >= 1 AND barcode = trim(barcode))
);

CREATE TABLE product_external_identifiers (
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    scheme TEXT NOT NULL,
    value TEXT NOT NULL,

    PRIMARY KEY (product_id, scheme, value),

    CONSTRAINT fk_product_external_identifiers_product_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT ck_product_external_identifiers_scheme
        CHECK (length(trim(scheme)) >= 1 AND scheme = trim(scheme)),

    CONSTRAINT ck_product_external_identifiers_value
        CHECK (length(trim(value)) >= 1 AND value = trim(value))
);

CREATE TABLE product_units (
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    ratio_to_base REAL NOT NULL,
    precision INTEGER NOT NULL,
    rounding_mode TEXT NOT NULL,
    taxpayer_unit_code TEXT,
    is_base INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (product_id, unit_id),

    CONSTRAINT fk_product_units_product_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_product_units_taxpayer_unit
        FOREIGN KEY (taxpayer_unit_code)
        REFERENCES taxpayer_units(code)
        ON DELETE RESTRICT,

    CONSTRAINT uq_product_units_company_product_unit
        UNIQUE (company_id, product_id, unit_id),

    CONSTRAINT uq_product_units_product_code
        UNIQUE (product_id, code),

    CONSTRAINT ck_product_units_code
        CHECK (length(trim(code)) >= 1 AND code = trim(code)),

    CONSTRAINT ck_product_units_title
        CHECK (length(trim(title)) >= 1 AND title = trim(title)),

    CONSTRAINT ck_product_units_ratio
        CHECK (ratio_to_base > 0),

    CONSTRAINT ck_product_units_precision
        CHECK (precision BETWEEN 0 AND 6),

    CONSTRAINT ck_product_units_rounding
        CHECK (rounding_mode IN ('half-up', 'down', 'up')),

    CONSTRAINT ck_product_units_base
        CHECK (is_base IN (0, 1) AND (is_base = 0 OR ratio_to_base = 1))
);

CREATE TABLE product_master_data (
    company_id TEXT NOT NULL,
    product_id TEXT PRIMARY KEY NOT NULL,
    brand TEXT,
    model TEXT,
    purchase_description TEXT,
    sales_description TEXT,
    default_purchase_unit_id TEXT,
    default_sales_unit_id TEXT,
    tax_treatment TEXT NOT NULL DEFAULT 'unspecified',
    vat_rate_basis_points INTEGER,
    stock_tracking INTEGER NOT NULL DEFAULT 0,
    serial_tracking INTEGER NOT NULL DEFAULT 0,
    lot_tracking INTEGER NOT NULL DEFAULT 0,
    shelf_life_days INTEGER,

    CONSTRAINT fk_product_master_data_product_same_company
        FOREIGN KEY (company_id, product_id)
        REFERENCES products(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_product_master_data_purchase_unit
        FOREIGN KEY (company_id, product_id, default_purchase_unit_id)
        REFERENCES product_units(company_id, product_id, unit_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_master_data_sales_unit
        FOREIGN KEY (company_id, product_id, default_sales_unit_id)
        REFERENCES product_units(company_id, product_id, unit_id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_product_master_data_tax
        CHECK (
            (tax_treatment = 'taxable' AND vat_rate_basis_points BETWEEN 0 AND 10000)
            OR
            (tax_treatment IN ('unspecified', 'exempt', 'not-subject') AND vat_rate_basis_points IS NULL)
        ),

    CONSTRAINT ck_product_master_data_tracking
        CHECK (
            stock_tracking IN (0, 1)
            AND serial_tracking IN (0, 1)
            AND lot_tracking IN (0, 1)
            AND (serial_tracking = 0 OR stock_tracking = 1)
            AND (lot_tracking = 0 OR stock_tracking = 1)
            AND (
                shelf_life_days IS NULL
                OR (shelf_life_days > 0 AND stock_tracking = 1)
            )
        )
);

-- Hard duplicate boundaries are company-scoped and mirror Application policy.
CREATE UNIQUE INDEX uq_product_identifiers_company_sku
ON product_identifiers(company_id, sku)
WHERE sku IS NOT NULL;

CREATE UNIQUE INDEX uq_product_identifiers_company_reference_code
ON product_identifiers(company_id, reference_code)
WHERE reference_code IS NOT NULL;

CREATE UNIQUE INDEX uq_product_identifiers_company_taxpayer_id
ON product_identifiers(company_id, taxpayer_goods_service_id)
WHERE taxpayer_goods_service_id IS NOT NULL;

CREATE UNIQUE INDEX uq_product_barcodes_company_barcode
ON product_barcodes(company_id, barcode);

CREATE UNIQUE INDEX uq_product_external_identifiers_company_scheme_value
ON product_external_identifiers(company_id, scheme, value);

CREATE UNIQUE INDEX uq_product_units_one_base
ON product_units(product_id)
WHERE is_base = 1;

-- List, selector, lookup, and duplicate-candidate query paths.
CREATE INDEX ix_products_company_status_title
ON products(company_id, status, title, id);

CREATE INDEX ix_products_company_kind_status_title
ON products(company_id, kind, status, title, id);

CREATE INDEX ix_products_company_category_status_title
ON products(company_id, category_id, status, title, id)
WHERE category_id IS NOT NULL;

CREATE INDEX ix_products_company_capabilities_status
ON products(company_id, purchasable, sellable, status, title, id);

CREATE INDEX ix_products_company_updated
ON products(company_id, updated_at DESC, id);

CREATE INDEX ix_product_identifiers_company_lookup
ON product_identifiers(company_id, sku, reference_code, taxpayer_goods_service_id, product_id);

CREATE INDEX ix_product_barcodes_product
ON product_barcodes(company_id, product_id, barcode);

CREATE INDEX ix_product_external_identifiers_product
ON product_external_identifiers(company_id, product_id, scheme, value);

CREATE INDEX ix_product_units_product
ON product_units(company_id, product_id, is_base DESC, code, unit_id);

CREATE INDEX ix_product_units_taxpayer_code
ON product_units(taxpayer_unit_code, company_id, product_id)
WHERE taxpayer_unit_code IS NOT NULL;

CREATE INDEX ix_product_master_data_advisory_duplicate
ON product_master_data(company_id, brand, model, product_id)
WHERE brand IS NOT NULL OR model IS NOT NULL;
