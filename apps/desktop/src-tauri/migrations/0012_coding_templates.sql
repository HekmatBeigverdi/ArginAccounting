PRAGMA foreign_keys = ON;

ALTER TABLE companies ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (activity_type IN ('service', 'trading', 'manufacturing', 'custom'));

CREATE TABLE coding_templates (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT COLLATE NOCASE NOT NULL UNIQUE,
    persian_name TEXT NOT NULL,
    english_name TEXT,
    activity_type TEXT NOT NULL,
    ownership TEXT NOT NULL,
    lifecycle TEXT NOT NULL DEFAULT 'draft',
    latest_published_version INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_coding_templates_id_code UNIQUE (id, code),
    CONSTRAINT ck_coding_templates_code CHECK (
        length(code) BETWEEN 1 AND 50 AND code = upper(code)
        AND substr(code, 1, 1) GLOB '[A-Z]'
        AND code NOT GLOB '*[^A-Z0-9_-]*'
    ),
    CONSTRAINT ck_coding_templates_names CHECK (
        length(trim(persian_name)) BETWEEN 1 AND 200
        AND persian_name = trim(persian_name)
        AND (english_name IS NULL OR (length(trim(english_name)) BETWEEN 1 AND 200 AND english_name = trim(english_name)))
    ),
    CONSTRAINT ck_coding_templates_activity CHECK (activity_type IN ('service', 'trading', 'manufacturing', 'custom')),
    CONSTRAINT ck_coding_templates_ownership CHECK (ownership IN ('built_in', 'custom')),
    CONSTRAINT ck_coding_templates_lifecycle CHECK (lifecycle IN ('draft', 'published', 'retired')),
    CONSTRAINT ck_coding_templates_published_version CHECK (
        (lifecycle = 'draft' AND latest_published_version IS NULL)
        OR (lifecycle IN ('published', 'retired') AND latest_published_version IS NOT NULL AND latest_published_version >= 1)
    ),
    CONSTRAINT ck_coding_templates_version CHECK (version >= 1)
);

CREATE TABLE coding_template_versions (
    id TEXT PRIMARY KEY NOT NULL,
    template_id TEXT NOT NULL,
    template_code TEXT COLLATE NOCASE NOT NULL,
    version_number INTEGER NOT NULL,
    persian_name TEXT NOT NULL,
    english_name TEXT,
    activity_type TEXT NOT NULL,
    ownership TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_reference TEXT,
    contract_version TEXT NOT NULL,
    content_fingerprint TEXT NOT NULL,
    published_at TEXT NOT NULL,
    published_by TEXT NOT NULL,
    CONSTRAINT fk_coding_template_versions_template FOREIGN KEY (template_id, template_code)
        REFERENCES coding_templates(id, code) ON DELETE RESTRICT,
    CONSTRAINT uq_coding_template_versions_number UNIQUE (template_id, version_number),
    CONSTRAINT uq_coding_template_versions_scope UNIQUE (template_id, id),
    CONSTRAINT ck_coding_template_versions_number CHECK (version_number >= 1),
    CONSTRAINT ck_coding_template_versions_activity CHECK (activity_type IN ('service', 'trading', 'manufacturing', 'custom')),
    CONSTRAINT ck_coding_template_versions_ownership CHECK (ownership IN ('built_in', 'custom')),
    CONSTRAINT ck_coding_template_versions_source CHECK (source_type IN ('catalog', 'excel', 'manual')),
    CONSTRAINT ck_coding_template_versions_contract CHECK (length(trim(contract_version)) > 0 AND contract_version = trim(contract_version)),
    CONSTRAINT ck_coding_template_versions_fingerprint CHECK (
        length(content_fingerprint) = 64 AND content_fingerprint = lower(content_fingerprint)
        AND content_fingerprint NOT GLOB '*[^0-9a-f]*'
    ),
    CONSTRAINT ck_coding_template_versions_publisher CHECK (length(trim(published_by)) > 0 AND published_by = trim(published_by))
);

CREATE TABLE coding_template_accounts (
    template_version_id TEXT NOT NULL,
    logical_key TEXT NOT NULL,
    parent_logical_key TEXT,
    level TEXT NOT NULL,
    code TEXT NOT NULL,
    persian_name TEXT NOT NULL,
    english_name TEXT,
    nature TEXT NOT NULL,
    normal_balance TEXT NOT NULL,
    statement_type TEXT NOT NULL,
    report_classification_json TEXT NOT NULL CHECK (json_valid(report_classification_json)),
    posting_allowed INTEGER NOT NULL,
    currency_enabled INTEGER NOT NULL,
    revaluation_enabled INTEGER NOT NULL,
    tracking_enabled INTEGER NOT NULL,
    due_date_enabled INTEGER NOT NULL,
    active_by_default INTEGER NOT NULL,
    display_order INTEGER NOT NULL,
    PRIMARY KEY (template_version_id, logical_key),
    FOREIGN KEY (template_version_id) REFERENCES coding_template_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (template_version_id, parent_logical_key)
        REFERENCES coding_template_accounts(template_version_id, logical_key) ON DELETE RESTRICT,
    CHECK (level IN ('group', 'general', 'subsidiary')),
    CHECK ((level = 'group' AND parent_logical_key IS NULL) OR (level <> 'group' AND parent_logical_key IS NOT NULL)),
    CHECK (nature IN ('uncontrolled', 'debit', 'credit', 'strict_debit', 'strict_credit')),
    CHECK (normal_balance IN ('debit', 'credit')),
    CHECK (statement_type IN ('balance_sheet', 'income_statement', 'memorandum')),
    CHECK (posting_allowed IN (0,1) AND currency_enabled IN (0,1) AND revaluation_enabled IN (0,1)
        AND tracking_enabled IN (0,1) AND due_date_enabled IN (0,1) AND active_by_default IN (0,1)),
    CHECK (display_order >= 0)
);

CREATE TABLE coding_template_dimension_types (
    template_version_id TEXT NOT NULL,
    logical_key TEXT NOT NULL,
    code TEXT NOT NULL,
    persian_name TEXT NOT NULL,
    english_name TEXT,
    hierarchical INTEGER NOT NULL,
    allow_multiple_members INTEGER NOT NULL,
    active_by_default INTEGER NOT NULL,
    display_order INTEGER NOT NULL,
    PRIMARY KEY (template_version_id, logical_key),
    UNIQUE (template_version_id, code),
    FOREIGN KEY (template_version_id) REFERENCES coding_template_versions(id) ON DELETE CASCADE,
    CHECK (hierarchical IN (0,1) AND allow_multiple_members IN (0,1) AND active_by_default IN (0,1)),
    CHECK (display_order >= 0)
);

CREATE TABLE coding_template_dimension_members (
    template_version_id TEXT NOT NULL,
    logical_key TEXT NOT NULL,
    dimension_type_logical_key TEXT NOT NULL,
    parent_logical_key TEXT,
    code TEXT NOT NULL,
    persian_name TEXT NOT NULL,
    english_name TEXT,
    active_by_default INTEGER NOT NULL,
    display_order INTEGER NOT NULL,
    PRIMARY KEY (template_version_id, logical_key),
    UNIQUE (template_version_id, dimension_type_logical_key, code),
    FOREIGN KEY (template_version_id, dimension_type_logical_key)
        REFERENCES coding_template_dimension_types(template_version_id, logical_key) ON DELETE CASCADE,
    FOREIGN KEY (template_version_id, parent_logical_key)
        REFERENCES coding_template_dimension_members(template_version_id, logical_key) ON DELETE RESTRICT,
    CHECK (active_by_default IN (0,1)),
    CHECK (display_order >= 0)
);

CREATE TABLE coding_template_account_dimension_policies (
    template_version_id TEXT NOT NULL,
    account_logical_key TEXT NOT NULL,
    dimension_type_logical_key TEXT NOT NULL,
    requirement TEXT NOT NULL,
    PRIMARY KEY (template_version_id, account_logical_key, dimension_type_logical_key),
    FOREIGN KEY (template_version_id, account_logical_key)
        REFERENCES coding_template_accounts(template_version_id, logical_key) ON DELETE CASCADE,
    FOREIGN KEY (template_version_id, dimension_type_logical_key)
        REFERENCES coding_template_dimension_types(template_version_id, logical_key) ON DELETE CASCADE,
    CHECK (requirement IN ('required', 'optional', 'forbidden'))
);

CREATE TABLE coding_template_applications (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    template_version_id TEXT NOT NULL,
    request_key TEXT NOT NULL,
    status TEXT NOT NULL,
    baseline_fingerprint TEXT NOT NULL,
    applied_at TEXT,
    actor_id TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (company_id, request_key),
    UNIQUE (company_id, id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    FOREIGN KEY (template_id, template_version_id)
        REFERENCES coding_template_versions(template_id, id) ON DELETE RESTRICT,
    CHECK (status IN ('previewed', 'applied', 'rejected')),
    CHECK ((status = 'applied' AND applied_at IS NOT NULL) OR (status <> 'applied' AND applied_at IS NULL)),
    CHECK (length(baseline_fingerprint) = 64 AND baseline_fingerprint NOT GLOB '*[^0-9a-f]*')
);

CREATE TABLE coding_template_application_items (
    application_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    template_version_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    logical_key TEXT NOT NULL,
    operational_id TEXT NOT NULL,
    action TEXT NOT NULL,
    PRIMARY KEY (application_id, item_type, logical_key),
    FOREIGN KEY (company_id, application_id)
        REFERENCES coding_template_applications(company_id, id) ON DELETE CASCADE,
    FOREIGN KEY (template_version_id) REFERENCES coding_template_versions(id) ON DELETE RESTRICT,
    CHECK (item_type IN ('account', 'dimension_type', 'dimension_member', 'account_dimension_policy')),
    CHECK (action IN ('created', 'matched'))
);

CREATE TABLE coding_template_imports (
    id TEXT PRIMARY KEY NOT NULL,
    import_key TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_fingerprint TEXT NOT NULL,
    contract_version TEXT NOT NULL,
    status TEXT NOT NULL,
    template_id TEXT,
    template_version_id TEXT,
    actor_id TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (template_id, template_version_id)
        REFERENCES coding_template_versions(template_id, id) ON DELETE RESTRICT,
    CHECK (length(trim(file_name)) > 0 AND file_name = trim(file_name)),
    CHECK (length(file_fingerprint) = 64 AND file_fingerprint = lower(file_fingerprint)
        AND file_fingerprint NOT GLOB '*[^0-9a-f]*'),
    CHECK (length(trim(contract_version)) > 0 AND contract_version = trim(contract_version)),
    CHECK (status IN ('received', 'validated', 'rejected', 'published')),
    CHECK ((status = 'published' AND template_id IS NOT NULL AND template_version_id IS NOT NULL AND completed_at IS NOT NULL)
        OR (status <> 'published' AND template_id IS NULL AND template_version_id IS NULL))
);

CREATE INDEX ix_coding_templates_catalog ON coding_templates(activity_type, ownership, lifecycle, code);
CREATE INDEX ix_coding_templates_updated ON coding_templates(updated_at, id);
CREATE INDEX ix_coding_template_versions_template ON coding_template_versions(template_id, version_number DESC);
CREATE INDEX ix_coding_template_versions_fingerprint ON coding_template_versions(content_fingerprint);
CREATE INDEX ix_coding_template_accounts_order ON coding_template_accounts(template_version_id, display_order, code);
CREATE INDEX ix_coding_template_dimension_types_order ON coding_template_dimension_types(template_version_id, display_order, code);
CREATE INDEX ix_coding_template_dimension_members_order ON coding_template_dimension_members(template_version_id, dimension_type_logical_key, display_order, code);
CREATE INDEX ix_coding_template_applications_company ON coding_template_applications(company_id, created_at DESC, id);
CREATE INDEX ix_coding_template_applications_version ON coding_template_applications(template_id, template_version_id, status);
CREATE INDEX ix_coding_template_application_items_operational ON coding_template_application_items(company_id, item_type, operational_id);
CREATE INDEX ix_coding_template_imports_status ON coding_template_imports(status, created_at DESC, id);
CREATE INDEX ix_coding_template_imports_fingerprint ON coding_template_imports(file_fingerprint);
