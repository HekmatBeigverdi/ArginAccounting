PRAGMA foreign_keys = ON;

-- Phase 23 Step 27: one Purchase source may legitimately produce multiple
-- Inventory receipt documents (partial deliveries). The source reference
-- remains traceable but is no longer globally unique at document level.

DROP INDEX IF EXISTS uq_inventory_documents_source;

CREATE INDEX IF NOT EXISTS ix_inventory_documents_source
ON inventory_documents(
  company_id,
  source_system,
  source_document_type,
  source_document_id,
  created_at,
  id
)
WHERE source_system IS NOT NULL
  AND source_document_id IS NOT NULL
  AND deleted_at IS NULL;
