PRAGMA foreign_keys = ON;

ALTER TABLE approval_requests
ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
