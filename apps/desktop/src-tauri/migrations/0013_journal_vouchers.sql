PRAGMA foreign_keys = ON;

CREATE TABLE journal_vouchers (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT,
    voucher_number TEXT NOT NULL,
    reference TEXT,
    voucher_date TEXT NOT NULL,
    fiscal_year_id TEXT NOT NULL,
    fiscal_period_id TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    currency_code TEXT NOT NULL DEFAULT 'IRR',
    source_type TEXT NOT NULL DEFAULT 'manual',
    source_id TEXT,
    request_id TEXT,
    correlation_id TEXT,
    causation_id TEXT,
    total_debit INTEGER NOT NULL,
    total_credit INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_journal_vouchers_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_journal_vouchers_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_journal_vouchers_fiscal_year
        FOREIGN KEY (fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_journal_vouchers_fiscal_period
        FOREIGN KEY (fiscal_period_id)
        REFERENCES fiscal_periods(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_journal_vouchers_number_scope
        UNIQUE (company_id, fiscal_year_id, branch_id, voucher_number),

    CONSTRAINT uq_journal_vouchers_company_id
        UNIQUE (company_id, id),

    CONSTRAINT ck_journal_vouchers_number
        CHECK (
            length(trim(voucher_number)) BETWEEN 1 AND 50
            AND voucher_number = trim(voucher_number)
        ),

    CONSTRAINT ck_journal_vouchers_reference
        CHECK (
            reference IS NULL
            OR (
                length(trim(reference)) BETWEEN 1 AND 100
                AND reference = trim(reference)
            )
        ),

    CONSTRAINT ck_journal_vouchers_date
        CHECK (
            voucher_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND date(voucher_date) = voucher_date
        ),

    CONSTRAINT ck_journal_vouchers_status
        CHECK (status = 'draft'),

    CONSTRAINT ck_journal_vouchers_currency
        CHECK (
            length(currency_code) = 3
            AND currency_code = upper(currency_code)
            AND currency_code NOT GLOB '*[^A-Z]*'
        ),

    CONSTRAINT ck_journal_vouchers_source
        CHECK (
            source_type IN (
                'manual',
                'opening_balance',
                'migration',
                'integration',
                'system',
                'source_document'
            )
        ),

    CONSTRAINT ck_journal_vouchers_amounts
        CHECK (
            total_debit >= 0
            AND total_credit >= 0
            AND total_debit = total_credit
        ),

    CONSTRAINT ck_journal_vouchers_version
        CHECK (version >= 1)
);

CREATE TABLE journal_lines (
    id TEXT PRIMARY KEY NOT NULL,
    voucher_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    line_order INTEGER NOT NULL,
    account_id TEXT NOT NULL,
    description TEXT,
    debit_amount INTEGER NOT NULL DEFAULT 0,
    credit_amount INTEGER NOT NULL DEFAULT 0,
    currency_code TEXT NOT NULL,

    CONSTRAINT fk_journal_lines_voucher_same_company
        FOREIGN KEY (company_id, voucher_id)
        REFERENCES journal_vouchers(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_journal_lines_account_same_company
        FOREIGN KEY (company_id, account_id)
        REFERENCES accounts(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_journal_lines_voucher_order
        UNIQUE (voucher_id, line_order),

    CONSTRAINT uq_journal_lines_voucher_id
        UNIQUE (voucher_id, id),

    CONSTRAINT ck_journal_lines_order
        CHECK (line_order >= 1),

    CONSTRAINT ck_journal_lines_side
        CHECK (
            debit_amount >= 0
            AND credit_amount >= 0
            AND (
                (debit_amount > 0 AND credit_amount = 0)
                OR (credit_amount > 0 AND debit_amount = 0)
            )
        ),

    CONSTRAINT ck_journal_lines_currency
        CHECK (
            length(currency_code) = 3
            AND currency_code = upper(currency_code)
            AND currency_code NOT GLOB '*[^A-Z]*'
        )
);

CREATE TABLE journal_line_dimension_assignments (
    voucher_id TEXT NOT NULL,
    line_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    dimension_type_id TEXT NOT NULL,
    member_id TEXT NOT NULL,

    PRIMARY KEY (line_id, dimension_type_id, member_id),

    CONSTRAINT fk_journal_line_dimensions_line
        FOREIGN KEY (voucher_id, line_id)
        REFERENCES journal_lines(voucher_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_journal_line_dimensions_type_same_company
        FOREIGN KEY (company_id, dimension_type_id)
        REFERENCES accounting_dimension_types(company_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_journal_line_dimensions_member_same_type
        FOREIGN KEY (company_id, dimension_type_id, member_id)
        REFERENCES accounting_dimension_members(company_id, dimension_type_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX ix_journal_vouchers_company_date
ON journal_vouchers(company_id, voucher_date DESC, id);

CREATE INDEX ix_journal_vouchers_branch_date
ON journal_vouchers(company_id, branch_id, voucher_date DESC, id);

CREATE INDEX ix_journal_vouchers_fiscal
ON journal_vouchers(company_id, fiscal_year_id, fiscal_period_id, voucher_date, id);

CREATE INDEX ix_journal_vouchers_reference
ON journal_vouchers(company_id, reference);

CREATE INDEX ix_journal_vouchers_source
ON journal_vouchers(company_id, source_type, source_id, request_id);

CREATE INDEX ix_journal_vouchers_correlation
ON journal_vouchers(correlation_id, causation_id);

CREATE INDEX ix_journal_lines_account
ON journal_lines(company_id, account_id, voucher_id, line_order);

CREATE INDEX ix_journal_lines_voucher
ON journal_lines(voucher_id, line_order);

CREATE INDEX ix_journal_line_dimensions_type
ON journal_line_dimension_assignments(company_id, dimension_type_id, voucher_id, line_id);

CREATE INDEX ix_journal_line_dimensions_member
ON journal_line_dimension_assignments(company_id, member_id, voucher_id, line_id);
