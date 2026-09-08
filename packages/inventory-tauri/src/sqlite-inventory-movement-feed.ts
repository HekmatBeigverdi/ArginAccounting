import type { DatabaseExecutor } from "@argin/database";
import type {
  InventoryMovementFeedEntry,
  InventoryMovementFeedPage,
  InventoryMovementFeedReader,
  InventoryMovementFeedRequest,
} from "@argin/inventory";

const MAX_LIMIT = 500;

type MovementRow = {
  movement_id: string;
  company_id: string;
  document_id: string;
  line_id: string;
  transfer_id: string | null;
  reversal_of_movement_id: string | null;
  product_id: string;
  warehouse_id: string;
  zone_id: string | null;
  location_id: string | null;
  business_date: string;
  business_order: number;
  recorded_at: string;
  quantity_delta: string;
};

type CursorRow = Pick<MovementRow, "business_date" | "business_order" | "document_id" | "line_id" | "movement_id">;

const selectColumns = `movement_id,company_id,document_id,line_id,transfer_id,reversal_of_movement_id,
 product_id,warehouse_id,zone_id,location_id,business_date,business_order,recorded_at,quantity_delta`;

const mapEntry = (row: MovementRow): InventoryMovementFeedEntry => Object.freeze({
  movementId: row.movement_id,
  companyId: row.company_id,
  documentId: row.document_id,
  lineId: row.line_id,
  transferId: row.transfer_id,
  reversalOfMovementId: row.reversal_of_movement_id,
  productId: row.product_id,
  warehouse: Object.freeze({
    warehouseId: row.warehouse_id,
    ...(row.zone_id !== null ? { zoneId: row.zone_id } : {}),
    ...(row.location_id !== null ? { locationId: row.location_id } : {}),
  }),
  businessDate: row.business_date,
  businessOrder: row.business_order,
  recordedAt: row.recorded_at,
  quantityDelta: row.quantity_delta,
});

export class SqliteInventoryMovementFeedReader implements InventoryMovementFeedReader {
  constructor(private readonly database: DatabaseExecutor) {}

  async read(request: InventoryMovementFeedRequest): Promise<InventoryMovementFeedPage> {
    const companyId = request.companyId.trim();
    if (!companyId) throw new Error("inventory.movement-feed.company-required");
    if (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > MAX_LIMIT) {
      throw new Error("inventory.movement-feed.limit-invalid");
    }

    let cursor: CursorRow | null = null;
    const afterMovementId = request.afterMovementId?.trim() || null;
    if (afterMovementId !== null) {
      cursor = await this.database.queryOne<CursorRow>(
        `SELECT business_date,business_order,document_id,line_id,movement_id
         FROM inventory_all_stock_movements
         WHERE company_id=? AND movement_id=?`,
        [companyId, afterMovementId],
      );
      if (cursor === null) throw new Error("inventory.movement-feed.cursor-not-found");
    }

    const rows = cursor === null
      ? await this.database.query<MovementRow>(
          `SELECT ${selectColumns}
           FROM inventory_all_stock_movements
           WHERE company_id=?
           ORDER BY business_date,business_order,document_id,line_id,movement_id
           LIMIT ?`,
          [companyId, request.limit],
        )
      : await this.database.query<MovementRow>(
          `SELECT ${selectColumns}
           FROM inventory_all_stock_movements
           WHERE company_id=? AND (
             business_date > ? OR
             (business_date = ? AND business_order > ?) OR
             (business_date = ? AND business_order = ? AND document_id > ?) OR
             (business_date = ? AND business_order = ? AND document_id = ? AND line_id > ?) OR
             (business_date = ? AND business_order = ? AND document_id = ? AND line_id = ? AND movement_id > ?)
           )
           ORDER BY business_date,business_order,document_id,line_id,movement_id
           LIMIT ?`,
          [
            companyId,
            cursor.business_date,
            cursor.business_date, cursor.business_order,
            cursor.business_date, cursor.business_order, cursor.document_id,
            cursor.business_date, cursor.business_order, cursor.document_id, cursor.line_id,
            cursor.business_date, cursor.business_order, cursor.document_id, cursor.line_id, cursor.movement_id,
            request.limit,
          ],
        );

    const items = Object.freeze(rows.map(mapEntry));
    return Object.freeze({
      items,
      nextMovementId: items.at(-1)?.movementId ?? null,
    });
  }
}
