import type { DatabaseSession } from "@argin/database";
import {
  INVENTORY_NUMBER_SERIES_TYPES,
  type InventoryDocumentType,
} from "@argin/inventory";

/** Run inside the inventory write transaction so creation and reservation are atomic. */
export async function ensureInventoryNumberSeries(
  database: DatabaseSession,
  companyId: string,
  documentType: InventoryDocumentType,
): Promise<void> {
  const entityType = INVENTORY_NUMBER_SERIES_TYPES[documentType];
  const timestamp = new Date().toISOString();
  // Never replace configured series, including inactive or branch-specific series.
  await database.execute(
    `INSERT INTO number_series
      (id,company_id,branch_id,fiscal_year_id,entity_type,code,prefix,suffix,
       next_number,padding_length,reset_policy,is_active,version,created_at,updated_at)
     SELECT ?,?,NULL,NULL,?,?,'','',1,6,'never',1,1,?,?
     WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE company_id=? AND entity_type=?)`,
    [
      crypto.randomUUID(),
      companyId,
      entityType,
      entityType,
      timestamp,
      timestamp,
      companyId,
      entityType,
    ],
  );
}
