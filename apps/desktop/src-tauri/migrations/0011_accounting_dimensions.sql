PRAGMA foreign_keys = ON;

CREATE TABLE accounting_dimension_types (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,

    code TEXT COLLATE NOCASE NOT NULL,
    name TEXT NOT NULL,
    english_name TEXT,

    hierarchical INTEGER NOT NULL DEFAULT 0,
    allow_multiple_members INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    display_order INTEGER NOT NULL DEFAULT 0,

    source TEXT NOT NULL DEFAULT 'manual',
    source_reference_id TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_accounting_dimension_types_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_accounting_dimension_types_company_code
        UNIQUE (company_id, code),

    CONSTRAINT uq_accounting_dimension_types_company_id
        UNIQUE (company_id, id),

    CONSTRAINT ck_accounting_dimension_types_code
        CHECK (
            length(code) BETWEEN 1 AND 50
            AND substr(code, 1, 1) GLOB '[A-Z]'
            AND code NOT GLOB '*[^A-Z0-9_-]*'
        ),

    CONSTRAINT ck_accounting_dimension_types_name
        CHECK (
            length(trim(name)) BETWEEN 1 AND 200
            AND name = trim(name)
        ),

    CONSTRAINT ck_accounting_dimension_types_english_name
        CHECK (
            english_name IS NULL
            OR (
                length(trim(english_name)) BETWEEN 1 AND 200
                AND english_name = trim(english_name)
            )
        ),

    CONSTRAINT ck_accounting_dimension_types_flags
        CHECK (
            hierarchical IN (0, 1)
            AND allow_multiple_members IN (0, 1)
        ),

    CONSTRAINT ck_accounting_dimension_types_status
        CHECK (status IN ('active', 'inactive')),

    CONSTRAINT ck_accounting_dimension_types_display_order
        CHECK (display_order >= 0),

    CONSTRAINT ck_accounting_dimension_types_source
        CHECK (
            source IN ('manual', 'system', 'module')
            AND (
                source = 'manual'
                OR (
                    source_reference_id IS NOT NULL
                    AND length(trim(source_reference_id)) > 0
                    AND source_reference_id = trim(source_reference_id)
                )
            )
        ),

    CONSTRAINT ck_accounting_dimension_types_version
        CHECK (version >= 1)
);

CREATE TABLE accounting_dimension_members (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    dimension_type_id TEXT NOT NULL,

    code TEXT COLLATE NOCASE NOT NULL,
    name TEXT NOT NULL,
    english_name TEXT,
    parent_id TEXT,

    status TEXT NOT NULL DEFAULT 'active',
    valid_from TEXT,
    valid_to TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,

    source TEXT NOT NULL DEFAULT 'manual',
    source_reference_id TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_accounting_dimension_members_type_same_company
        FOREIGN KEY (company_id, dimension_type_id)
        REFERENCES accounting_dimension_types(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_accounting_dimension_members_parent_same_type
        FOREIGN KEY (company_id, dimension_type_id, parent_id)
        REFERENCES accounting_dimension_members(
            company_id,
            dimension_type_id,
            id
        )
        ON DELETE RESTRICT,

    CONSTRAINT uq_accounting_dimension_members_type_code
        UNIQUE (company_id, dimension_type_id, code),

    CONSTRAINT uq_accounting_dimension_members_scope_id
        UNIQUE (company_id, dimension_type_id, id),

    CONSTRAINT ck_accounting_dimension_members_code
        CHECK (
            length(code) BETWEEN 1 AND 50
            AND substr(code, 1, 1) GLOB '[A-Z0-9]'
            AND code NOT GLOB '*[^A-Z0-9_.-]*'
        ),

    CONSTRAINT ck_accounting_dimension_members_name
        CHECK (
            length(trim(name)) BETWEEN 1 AND 200
            AND name = trim(name)
        ),

    CONSTRAINT ck_accounting_dimension_members_english_name
        CHECK (
            english_name IS NULL
            OR (
                length(trim(english_name)) BETWEEN 1 AND 200
                AND english_name = trim(english_name)
            )
        ),

    CONSTRAINT ck_accounting_dimension_members_parent
        CHECK (parent_id IS NULL OR parent_id <> id),

    CONSTRAINT ck_accounting_dimension_members_status
        CHECK (status IN ('active', 'inactive')),

    CONSTRAINT ck_accounting_dimension_members_validity
        CHECK (
            (
                valid_from IS NULL
                OR (
                    valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
                    AND date(valid_from) = valid_from
                )
            )
            AND (
                valid_to IS NULL
                OR (
                    valid_to GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
                    AND date(valid_to) = valid_to
                )
            )
            AND (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
        ),

    CONSTRAINT ck_accounting_dimension_members_display_order
        CHECK (display_order >= 0),

    CONSTRAINT ck_accounting_dimension_members_source
        CHECK (
            source IN ('manual', 'system', 'module')
            AND (
                source = 'manual'
                OR (
                    source_reference_id IS NOT NULL
                    AND length(trim(source_reference_id)) > 0
                    AND source_reference_id = trim(source_reference_id)
                )
            )
        ),

    CONSTRAINT ck_accounting_dimension_members_version
        CHECK (version >= 1)
);

CREATE TABLE account_dimension_policies (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    dimension_type_id TEXT NOT NULL,

    requirement TEXT NOT NULL,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_account_dimension_policies_account_same_company
        FOREIGN KEY (company_id, account_id)
        REFERENCES accounts(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_account_dimension_policies_type_same_company
        FOREIGN KEY (company_id, dimension_type_id)
        REFERENCES accounting_dimension_types(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_account_dimension_policies_account_type
        UNIQUE (company_id, account_id, dimension_type_id),

    CONSTRAINT ck_account_dimension_policies_requirement
        CHECK (requirement IN ('required', 'optional', 'forbidden')),

    CONSTRAINT ck_account_dimension_policies_version
        CHECK (version >= 1)
);

CREATE INDEX ix_accounting_dimension_types_company_status
ON accounting_dimension_types(company_id, status, display_order, code);

CREATE INDEX ix_accounting_dimension_types_company_name
ON accounting_dimension_types(company_id, name);

CREATE INDEX ix_accounting_dimension_types_source
ON accounting_dimension_types(company_id, source, source_reference_id);

CREATE INDEX ix_accounting_dimension_members_type_parent
ON accounting_dimension_members(
    company_id,
    dimension_type_id,
    parent_id,
    display_order,
    code
);

CREATE INDEX ix_accounting_dimension_members_type_status
ON accounting_dimension_members(
    company_id,
    dimension_type_id,
    status,
    display_order,
    code
);

CREATE INDEX ix_accounting_dimension_members_validity
ON accounting_dimension_members(
    company_id,
    dimension_type_id,
    valid_from,
    valid_to
);

CREATE INDEX ix_accounting_dimension_members_name
ON accounting_dimension_members(company_id, dimension_type_id, name);

CREATE INDEX ix_account_dimension_policies_account
ON account_dimension_policies(company_id, account_id, requirement);

CREATE INDEX ix_account_dimension_policies_type
ON account_dimension_policies(company_id, dimension_type_id, requirement);
