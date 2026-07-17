CREATE TABLE companies (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    national_id TEXT,
    registration_number TEXT,
    base_currency TEXT NOT NULL DEFAULT 'IRR',
    locale TEXT NOT NULL DEFAULT 'fa-IR',
    calendar TEXT NOT NULL DEFAULT 'jalali',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT uq_companies_code UNIQUE (code),
    CONSTRAINT ck_companies_currency
        CHECK (base_currency = 'IRR'),
    CONSTRAINT ck_companies_locale
        CHECK (locale = 'fa-IR'),
    CONSTRAINT ck_companies_calendar
        CHECK (calendar = 'jalali'),
    CONSTRAINT ck_companies_status
        CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE branches (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_head_office INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_branches_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_branches_company_code
        UNIQUE (company_id, code),

    CONSTRAINT ck_branches_head_office
        CHECK (is_head_office IN (0, 1)),

    CONSTRAINT ck_branches_status
        CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX uq_branches_one_head_office
ON branches(company_id)
WHERE is_head_office = 1;

CREATE TABLE addresses (
    id TEXT PRIMARY KEY NOT NULL,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    address_type TEXT NOT NULL,
    province TEXT,
    city TEXT,
    address_line TEXT NOT NULL,
    postal_code TEXT,
    phone TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT ck_addresses_owner_type
        CHECK (owner_type IN ('company', 'branch')),

    CONSTRAINT ck_addresses_type
        CHECK (
            address_type IN (
                'registered',
                'operational',
                'postal',
                'other'
            )
        ),

    CONSTRAINT ck_addresses_primary
        CHECK (is_primary IN (0, 1))
);

CREATE INDEX ix_addresses_owner
ON addresses(owner_type, owner_id);

CREATE UNIQUE INDEX uq_addresses_primary_owner
ON addresses(owner_type, owner_id)
WHERE is_primary = 1;

CREATE TABLE company_tax_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    economic_code TEXT,
    fiscal_id TEXT,
    seller_branch_code TEXT,
    taxpayer_type TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_company_tax_profiles_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_company_tax_profiles_company
        UNIQUE (company_id),

    CONSTRAINT ck_company_taxpayer_type
        CHECK (
            taxpayer_type IN (
                'legal',
                'individual',
                'civil-partnership',
                'foreign'
            )
        ),

    CONSTRAINT ck_company_tax_profiles_enabled
        CHECK (is_enabled IN (0, 1))
);

CREATE INDEX ix_companies_legal_name
ON companies(legal_name);

CREATE INDEX ix_branches_company
ON branches(company_id);
