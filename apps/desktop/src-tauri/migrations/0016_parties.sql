PRAGMA foreign_keys = ON;

CREATE TABLE parties (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    code TEXT NOT NULL,
    classification TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    first_name TEXT,
    last_name TEXT,
    legal_name TEXT,
    trade_name TEXT,
    display_name TEXT NOT NULL,
    national_code TEXT,
    national_id TEXT,
    registration_number TEXT,
    economic_number TEXT,
    legacy_economic_code TEXT,
    tax_file_number TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_parties_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_parties_company_code
        UNIQUE (company_id, code),

    CONSTRAINT uq_parties_company_id
        UNIQUE (company_id, id),

    CONSTRAINT ck_parties_classification
        CHECK (classification IN ('natural-person', 'legal-entity')),

    CONSTRAINT ck_parties_status
        CHECK (status IN ('active', 'inactive')),

    CONSTRAINT ck_parties_code
        CHECK (
            length(trim(code)) BETWEEN 1 AND 100
            AND code = trim(code)
        ),

    CONSTRAINT ck_parties_display_name
        CHECK (
            length(trim(display_name)) >= 1
            AND display_name = trim(display_name)
        ),

    CONSTRAINT ck_parties_classification_names
        CHECK (
            (
                classification = 'natural-person'
                AND first_name IS NOT NULL
                AND length(trim(first_name)) >= 1
                AND last_name IS NOT NULL
                AND length(trim(last_name)) >= 1
                AND legal_name IS NULL
                AND trade_name IS NULL
            )
            OR
            (
                classification = 'legal-entity'
                AND first_name IS NULL
                AND last_name IS NULL
                AND legal_name IS NOT NULL
                AND length(trim(legal_name)) >= 1
            )
        ),

    CONSTRAINT ck_parties_national_code
        CHECK (
            national_code IS NULL
            OR (
                classification = 'natural-person'
                AND length(national_code) = 10
                AND national_code NOT GLOB '*[^0-9]*'
            )
        ),

    CONSTRAINT ck_parties_national_id
        CHECK (
            national_id IS NULL
            OR (
                classification = 'legal-entity'
                AND length(national_id) = 11
                AND national_id NOT GLOB '*[^0-9]*'
            )
        ),

    CONSTRAINT ck_parties_registration_number
        CHECK (
            registration_number IS NULL
            OR (
                classification = 'legal-entity'
                AND length(registration_number) BETWEEN 1 AND 20
                AND registration_number NOT GLOB '*[^0-9]*'
            )
        ),

    CONSTRAINT ck_parties_economic_number
        CHECK (
            economic_number IS NULL
            OR (
                classification = 'natural-person'
                AND length(economic_number) = 14
                AND economic_number NOT GLOB '*[^0-9]*'
                AND (national_code IS NULL OR substr(economic_number, 1, 10) = national_code)
            )
            OR (
                classification = 'legal-entity'
                AND length(economic_number) = 11
                AND economic_number NOT GLOB '*[^0-9]*'
                AND (national_id IS NULL OR economic_number = national_id)
            )
        ),

    CONSTRAINT ck_parties_legacy_economic_code
        CHECK (
            legacy_economic_code IS NULL
            OR (
                classification = 'legal-entity'
                AND length(legacy_economic_code) = 12
                AND legacy_economic_code NOT GLOB '*[^0-9]*'
            )
        ),

    CONSTRAINT ck_parties_tax_file_number
        CHECK (
            tax_file_number IS NULL
            OR (
                length(tax_file_number) BETWEEN 1 AND 30
                AND tax_file_number NOT GLOB '*[^0-9]*'
            )
        ),

    CONSTRAINT ck_parties_version
        CHECK (version >= 1)
);

CREATE TABLE party_roles (
    company_id TEXT NOT NULL,
    party_id TEXT NOT NULL,
    role TEXT NOT NULL,

    PRIMARY KEY (party_id, role),

    CONSTRAINT fk_party_roles_party_same_company
        FOREIGN KEY (company_id, party_id)
        REFERENCES parties(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT ck_party_roles_role
        CHECK (role IN ('customer', 'supplier'))
);

CREATE TABLE party_contacts (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    party_id TEXT NOT NULL,
    contact_type TEXT NOT NULL,
    value TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'general',
    is_primary INTEGER NOT NULL DEFAULT 0,
    contact_person TEXT,
    title TEXT,

    CONSTRAINT fk_party_contacts_party_same_company
        FOREIGN KEY (company_id, party_id)
        REFERENCES parties(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_party_contacts_party_id
        UNIQUE (party_id, id),

    CONSTRAINT ck_party_contacts_type
        CHECK (contact_type IN ('phone', 'mobile', 'email', 'website')),

    CONSTRAINT ck_party_contacts_purpose
        CHECK (purpose IN ('general', 'sales', 'purchasing', 'accounting', 'management', 'other')),

    CONSTRAINT ck_party_contacts_value
        CHECK (length(trim(value)) >= 1 AND value = trim(value)),

    CONSTRAINT ck_party_contacts_primary
        CHECK (is_primary IN (0, 1))
);

CREATE TABLE party_addresses (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    party_id TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'other',
    country_code TEXT NOT NULL DEFAULT 'IR',
    province TEXT,
    city TEXT,
    district TEXT,
    address_line TEXT NOT NULL,
    postal_code TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT fk_party_addresses_party_same_company
        FOREIGN KEY (company_id, party_id)
        REFERENCES parties(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_party_addresses_party_id
        UNIQUE (party_id, id),

    CONSTRAINT ck_party_addresses_purpose
        CHECK (purpose IN ('registered', 'billing', 'shipping', 'operational', 'postal', 'other')),

    CONSTRAINT ck_party_addresses_country
        CHECK (country_code = 'IR'),

    CONSTRAINT ck_party_addresses_line
        CHECK (length(trim(address_line)) >= 1 AND address_line = trim(address_line)),

    CONSTRAINT ck_party_addresses_postal_code
        CHECK (
            postal_code IS NULL
            OR (
                length(postal_code) = 10
                AND postal_code NOT GLOB '*[^0-9]*'
            )
        ),

    CONSTRAINT ck_party_addresses_primary
        CHECK (is_primary IN (0, 1))
);

-- Hard duplicate boundaries established by Step 7 are company-scoped.
CREATE UNIQUE INDEX uq_parties_company_national_code
ON parties(company_id, national_code)
WHERE national_code IS NOT NULL;

CREATE UNIQUE INDEX uq_parties_company_national_id
ON parties(company_id, national_id)
WHERE national_id IS NOT NULL;

CREATE UNIQUE INDEX uq_parties_company_economic_number
ON parties(company_id, economic_number)
WHERE economic_number IS NOT NULL;

-- Primary child invariants mirror the Domain aggregate rules.
CREATE UNIQUE INDEX uq_party_contacts_primary_type_purpose
ON party_contacts(party_id, contact_type, purpose)
WHERE is_primary = 1;

CREATE UNIQUE INDEX uq_party_addresses_primary_purpose
ON party_addresses(party_id, purpose)
WHERE is_primary = 1;

-- Reader/selector and duplicate-detection query paths.
CREATE INDEX ix_parties_company_status_name
ON parties(company_id, status, display_name, id);

CREATE INDEX ix_parties_company_classification_name
ON parties(company_id, classification, display_name, id);

CREATE INDEX ix_parties_company_updated
ON parties(company_id, updated_at DESC, id);

CREATE INDEX ix_party_roles_company_role_party
ON party_roles(company_id, role, party_id);

CREATE INDEX ix_party_contacts_party
ON party_contacts(company_id, party_id, contact_type, purpose, id);

CREATE INDEX ix_party_contacts_lookup
ON party_contacts(company_id, contact_type, value, party_id);

CREATE INDEX ix_party_addresses_party
ON party_addresses(company_id, party_id, purpose, id);

CREATE INDEX ix_party_addresses_postal
ON party_addresses(company_id, postal_code, party_id)
WHERE postal_code IS NOT NULL;
