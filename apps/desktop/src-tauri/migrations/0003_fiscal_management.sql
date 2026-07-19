CREATE TABLE fiscal_years (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    is_current INTEGER NOT NULL DEFAULT 0,
    closed_at TEXT,
    closed_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_fiscal_years_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_fiscal_years_company_code
        UNIQUE (company_id, code),

    CONSTRAINT ck_fiscal_years_status
        CHECK (
            status IN (
                'draft',
                'open',
                'closing',
                'closed'
            )
        ),

    CONSTRAINT ck_fiscal_years_current
        CHECK (is_current IN (0, 1)),

    CONSTRAINT ck_fiscal_years_dates
        CHECK (start_date < end_date)
);

CREATE UNIQUE INDEX uq_fiscal_years_current_company
ON fiscal_years(company_id)
WHERE is_current = 1;

CREATE INDEX ix_fiscal_years_company
ON fiscal_years(company_id);

CREATE INDEX ix_fiscal_years_date_range
ON fiscal_years(company_id, start_date, end_date);

CREATE TABLE fiscal_periods (
    id TEXT PRIMARY KEY NOT NULL,
    fiscal_year_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    lock_reason TEXT,
    locked_at TEXT,
    locked_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_fiscal_periods_year
        FOREIGN KEY (fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_fiscal_periods_sequence
        UNIQUE (fiscal_year_id, sequence),

    CONSTRAINT uq_fiscal_periods_code
        UNIQUE (fiscal_year_id, code),

    CONSTRAINT ck_fiscal_periods_status
        CHECK (
            status IN (
                'open',
                'locked',
                'closed'
            )
        ),

    CONSTRAINT ck_fiscal_periods_dates
        CHECK (start_date <= end_date),

    CONSTRAINT ck_fiscal_periods_sequence
        CHECK (sequence > 0)
);

CREATE INDEX ix_fiscal_periods_year
ON fiscal_periods(fiscal_year_id);

CREATE INDEX ix_fiscal_periods_date_range
ON fiscal_periods(
    fiscal_year_id,
    start_date,
    end_date
);

CREATE TABLE historical_locks (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT,
    scope TEXT NOT NULL,
    locked_through_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL,
    released_by TEXT,
    released_at TEXT,

    CONSTRAINT fk_historical_locks_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_historical_locks_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_historical_locks_scope
        CHECK (
            scope IN (
                'all',
                'accounting',
                'sales',
                'purchases',
                'inventory',
                'treasury',
                'fixed-assets',
                'payroll',
                'manufacturing'
            )
        ),

    CONSTRAINT ck_historical_locks_active
        CHECK (is_active IN (0, 1))
);

CREATE INDEX ix_historical_locks_lookup
ON historical_locks(
    company_id,
    branch_id,
    scope,
    is_active,
    locked_through_date
);

CREATE TABLE number_series (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT,
    fiscal_year_id TEXT,
    entity_type TEXT NOT NULL,
    code TEXT NOT NULL,
    prefix TEXT NOT NULL DEFAULT '',
    suffix TEXT NOT NULL DEFAULT '',
    next_number INTEGER NOT NULL DEFAULT 1,
    padding_length INTEGER NOT NULL DEFAULT 6,
    reset_policy TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_number_series_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_number_series_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_number_series_fiscal_year
        FOREIGN KEY (fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_number_series_code
        UNIQUE (company_id, code),

    CONSTRAINT ck_number_series_next
        CHECK (next_number > 0),

    CONSTRAINT ck_number_series_padding
        CHECK (
            padding_length >= 1
            AND padding_length <= 20
        ),

    CONSTRAINT ck_number_series_reset
        CHECK (
            reset_policy IN (
                'never',
                'fiscal-year',
                'monthly'
            )
        ),

    CONSTRAINT ck_number_series_active
        CHECK (is_active IN (0, 1))
);

CREATE INDEX ix_number_series_lookup
ON number_series(
    company_id,
    branch_id,
    fiscal_year_id,
    entity_type,
    is_active
);
