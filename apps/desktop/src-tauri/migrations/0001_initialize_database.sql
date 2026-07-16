CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO app_metadata (
    key,
    value,
    updated_at
)
VALUES (
    'database.provider',
    'sqlite',
    CURRENT_TIMESTAMP
)
ON CONFLICT(key) DO NOTHING;

INSERT INTO app_metadata (
    key,
    value,
    updated_at
)
VALUES (
    'database.created_by',
    'ArginAccounting',
    CURRENT_TIMESTAMP
)
ON CONFLICT(key) DO NOTHING;

INSERT INTO app_metadata (
    key,
    value,
    updated_at
)
VALUES (
    'database.currency',
    'IRR',
    CURRENT_TIMESTAMP
)
ON CONFLICT(key) DO NOTHING;

INSERT INTO app_metadata (
    key,
    value,
    updated_at
)
VALUES (
    'database.calendar.presentation',
    'jalali',
    CURRENT_TIMESTAMP
)
ON CONFLICT(key) DO NOTHING;
