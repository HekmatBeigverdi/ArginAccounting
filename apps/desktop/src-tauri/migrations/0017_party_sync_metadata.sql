PRAGMA foreign_keys = ON;

ALTER TABLE parties
ADD COLUMN deleted_at TEXT;

CREATE TABLE party_external_references (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    party_id TEXT NOT NULL,
    source_system TEXT NOT NULL,
    external_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT fk_party_external_references_party_same_company
        FOREIGN KEY (company_id, party_id)
        REFERENCES parties(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_party_external_reference_source
        UNIQUE (company_id, source_system, external_id),

    CONSTRAINT uq_party_external_reference_party
        UNIQUE (party_id, source_system, external_id),

    CONSTRAINT ck_party_external_reference_source
        CHECK (
            length(trim(source_system)) BETWEEN 1 AND 100
            AND source_system = trim(source_system)
        ),

    CONSTRAINT ck_party_external_reference_id
        CHECK (
            length(trim(external_id)) BETWEEN 1 AND 200
            AND external_id = trim(external_id)
        )
);

CREATE INDEX ix_parties_sync_changes
ON parties(company_id, updated_at, version, id);

CREATE INDEX ix_parties_tombstones
ON parties(company_id, deleted_at, id)
WHERE deleted_at IS NOT NULL;

CREATE INDEX ix_party_external_references_party
ON party_external_references(company_id, party_id, source_system, external_id);
