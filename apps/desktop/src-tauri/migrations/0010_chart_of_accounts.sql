PRAGMA foreign_keys = ON;

CREATE TABLE account_coding_settings (
    company_id TEXT PRIMARY KEY NOT NULL,
    group_code_length INTEGER NOT NULL DEFAULT 2,
    general_code_length INTEGER NOT NULL DEFAULT 4,
    subsidiary_code_length INTEGER NOT NULL DEFAULT 6,
    enforce_hierarchical_codes INTEGER NOT NULL DEFAULT 1,
    allow_code_change_after_use INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_account_coding_settings_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_account_coding_settings_lengths
        CHECK (
            group_code_length BETWEEN 1 AND 30
            AND general_code_length BETWEEN 1 AND 30
            AND subsidiary_code_length BETWEEN 1 AND 30
            AND (
                enforce_hierarchical_codes = 0
                OR (
                    group_code_length < general_code_length
                    AND general_code_length < subsidiary_code_length
                )
            )
        ),

    CONSTRAINT ck_account_coding_settings_hierarchical
        CHECK (enforce_hierarchical_codes IN (0, 1)),

    CONSTRAINT ck_account_coding_settings_code_change
        CHECK (allow_code_change_after_use IN (0, 1)),

    CONSTRAINT ck_account_coding_settings_version
        CHECK (version >= 1)
);

CREATE TABLE accounts (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    parent_id TEXT,

    level TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    english_name TEXT,

    nature TEXT NOT NULL,
    normal_balance TEXT NOT NULL,
    statement_type TEXT NOT NULL,

    balance_sheet_section TEXT,
    income_statement_section TEXT,
    cash_flow_category TEXT,
    is_cash_equivalent INTEGER NOT NULL DEFAULT 0,
    is_receivable INTEGER NOT NULL DEFAULT 0,
    is_payable INTEGER NOT NULL DEFAULT 0,

    posting_allowed INTEGER NOT NULL DEFAULT 0,
    currency_enabled INTEGER NOT NULL DEFAULT 0,
    revaluation_enabled INTEGER NOT NULL DEFAULT 0,
    tracking_enabled INTEGER NOT NULL DEFAULT 0,
    due_date_enabled INTEGER NOT NULL DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'active',
    display_order INTEGER NOT NULL DEFAULT 0,

    source_type TEXT NOT NULL DEFAULT 'manual',
    source_reference_id TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_accounts_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_accounts_parent_same_company
        FOREIGN KEY (company_id, parent_id)
        REFERENCES accounts(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_accounts_company_code
        UNIQUE (company_id, code),

    CONSTRAINT uq_accounts_company_id
        UNIQUE (company_id, id),

    CONSTRAINT ck_accounts_level
        CHECK (level IN ('group', 'general', 'subsidiary')),

    CONSTRAINT ck_accounts_parent_presence
        CHECK (
            (level = 'group' AND parent_id IS NULL)
            OR (level IN ('general', 'subsidiary') AND parent_id IS NOT NULL)
        ),

    CONSTRAINT ck_accounts_code
        CHECK (
            length(code) BETWEEN 1 AND 30
            AND code NOT GLOB '*[^0-9]*'
        ),

    CONSTRAINT ck_accounts_name
        CHECK (
            length(trim(name)) BETWEEN 1 AND 200
            AND name = trim(name)
        ),

    CONSTRAINT ck_accounts_english_name
        CHECK (
            english_name IS NULL
            OR (
                length(trim(english_name)) BETWEEN 1 AND 200
                AND english_name = trim(english_name)
            )
        ),

    CONSTRAINT ck_accounts_nature
        CHECK (
            nature IN (
                'uncontrolled',
                'debit',
                'credit',
                'strict_debit',
                'strict_credit'
            )
        ),

    CONSTRAINT ck_accounts_normal_balance
        CHECK (normal_balance IN ('debit', 'credit')),

    CONSTRAINT ck_accounts_statement_type
        CHECK (
            statement_type IN (
                'balance_sheet',
                'income_statement',
                'memorandum'
            )
        ),

    CONSTRAINT ck_accounts_balance_sheet_section
        CHECK (
            balance_sheet_section IS NULL
            OR (
                statement_type = 'balance_sheet'
                AND balance_sheet_section IN (
                    'assets',
                    'liabilities',
                    'equity'
                )
            )
        ),

    CONSTRAINT ck_accounts_income_statement_section
        CHECK (
            income_statement_section IS NULL
            OR (
                statement_type = 'income_statement'
                AND income_statement_section IN (
                    'revenue',
                    'cost_of_sales',
                    'operating_expenses',
                    'non_operating',
                    'finance_costs',
                    'income_tax'
                )
            )
        ),

    CONSTRAINT ck_accounts_cash_flow_category
        CHECK (
            cash_flow_category IS NULL
            OR cash_flow_category IN (
                'operating',
                'investing',
                'financing',
                'cash_and_cash_equivalents',
                'non_cash'
            )
        ),

    CONSTRAINT ck_accounts_boolean_flags
        CHECK (
            is_cash_equivalent IN (0, 1)
            AND is_receivable IN (0, 1)
            AND is_payable IN (0, 1)
            AND posting_allowed IN (0, 1)
            AND currency_enabled IN (0, 1)
            AND revaluation_enabled IN (0, 1)
            AND tracking_enabled IN (0, 1)
            AND due_date_enabled IN (0, 1)
        ),

    CONSTRAINT ck_accounts_financial_flags
        CHECK (
            NOT (is_receivable = 1 AND is_payable = 1)
            AND (
                statement_type <> 'memorandum'
                OR (
                    is_cash_equivalent = 0
                    AND is_receivable = 0
                    AND is_payable = 0
                )
            )
        ),

    CONSTRAINT ck_accounts_posting_level
        CHECK (
            level = 'subsidiary'
            OR posting_allowed = 0
        ),

    CONSTRAINT ck_accounts_revaluation
        CHECK (
            revaluation_enabled = 0
            OR currency_enabled = 1
        ),

    CONSTRAINT ck_accounts_status
        CHECK (status IN ('active', 'inactive')),

    CONSTRAINT ck_accounts_display_order
        CHECK (display_order >= 0),

    CONSTRAINT ck_accounts_source_type
        CHECK (
            source_type IN (
                'manual',
                'coding_template',
                'excel_import'
            )
        ),

    CONSTRAINT ck_accounts_version
        CHECK (version >= 1)
);

CREATE TABLE account_management_tags (
    account_id TEXT NOT NULL,
    tag TEXT COLLATE NOCASE NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT pk_account_management_tags
        PRIMARY KEY (account_id, tag),

    CONSTRAINT fk_account_management_tags_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_account_management_tags_value
        CHECK (
            length(trim(tag)) BETWEEN 1 AND 100
            AND tag = trim(tag)
        ),

    CONSTRAINT ck_account_management_tags_order
        CHECK (display_order >= 0)
);

CREATE INDEX ix_accounts_company_parent
ON accounts(company_id, parent_id);

CREATE INDEX ix_accounts_company_level_status
ON accounts(company_id, level, status);

CREATE INDEX ix_accounts_company_name
ON accounts(company_id, name);

CREATE INDEX ix_accounts_company_display_order
ON accounts(company_id, display_order, code);

CREATE INDEX ix_accounts_report_classification
ON accounts(
    company_id,
    statement_type,
    balance_sheet_section,
    income_statement_section
);

CREATE INDEX ix_accounts_cash_flow_category
ON accounts(company_id, cash_flow_category);

CREATE INDEX ix_account_management_tags_tag
ON account_management_tags(tag);
