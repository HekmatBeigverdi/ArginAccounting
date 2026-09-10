import type { DatabaseSession } from "@argin/database";
import {
  InventoryApplicationError,
  serializeInventoryOpeningBalanceKey,
  type InventoryOpeningBalanceKey,
  type InventoryOpeningBalanceRepository,
} from "@argin/inventory";

type OpeningMovementRow = {
  document_id: string;
  line_id: string;
  recorded_at: string;
};

export class SqliteInventoryOpeningBalanceRepository implements InventoryOpeningBalanceRepository {
  constructor(private readonly db: DatabaseSession) {}

  async exists(key: InventoryOpeningBalanceKey): Promise<boolean> {
    const row = await this.db.queryOne<{ opening_key: string }>(
      "SELECT opening_key FROM inventory_opening_balances WHERE opening_key=?",
      [serializeInventoryOpeningBalanceKey(key)],
    );
    return row !== null;
  }

  async addBatch(keys: readonly InventoryOpeningBalanceKey[]): Promise<void> {
    for (const key of keys) {
      const stock = key.stockKey;
      const movement = await this.db.queryOne<OpeningMovementRow>(
        `SELECT m.document_id,m.line_id,m.recorded_at
         FROM inventory_all_stock_movements m
         WHERE m.company_id=?
           AND m.document_id IN (
             SELECT d.id FROM inventory_documents d
             WHERE d.company_id=? AND d.document_type='opening' AND d.fiscal_year_id=? AND d.deleted_at IS NULL
           )
           AND m.product_id=? AND m.warehouse_id=?
           AND COALESCE(m.zone_id,'')=COALESCE(?, '')
           AND COALESCE(m.location_id,'')=COALESCE(?, '')
         ORDER BY m.recorded_at DESC,m.movement_id DESC LIMIT 1`,
        [key.companyId, key.companyId, key.fiscalYearId, stock.productId,
          stock.warehouseId, stock.zoneId, stock.locationId],
      );
      if (!movement) {
        throw new InventoryApplicationError("inventory.application.invalid-request", "openingKey");
      }
      try {
        await this.db.execute(
          `INSERT INTO inventory_opening_balances
           (opening_key,company_id,fiscal_year_id,document_id,line_id,product_id,warehouse_id,zone_id,location_id,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [serializeInventoryOpeningBalanceKey(key), key.companyId, key.fiscalYearId,
            movement.document_id, movement.line_id, stock.productId, stock.warehouseId,
            stock.zoneId, stock.locationId, movement.recorded_at],
        );
      } catch (error) {
        const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
        if (text.includes("opening") || text.includes("unique")) {
          throw new InventoryApplicationError("inventory.application.opening-duplicate", "openingKey");
        }
        throw error;
      }
    }
  }
}
