import type { DatabaseExecutor, DatabaseValue } from "@argin/database";
import type { InventoryValuationRecalculationStatusReport } from "@argin/inventory/valuation-reports";

type DateRow = { d: string | null };
type CountRow = { n: number };
type RevisionRow = { revision: number };

const requiredText = (value: string, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`VALUATION_STATUS_INPUT_INVALID:${field}`);
  }
  return value.trim();
};

/**
 * Recalculation/currentness reader used by the Step 17 workspace.
 * Full reversal pairs are not missing valuation work: both immutable movement facts
 * remain authoritative, but their net monetary effect is compensated.
 */
export class SqliteInventoryValuationStatusReader {
  constructor(private readonly db: DatabaseExecutor) {}

  async read(input: {
    companyId: string;
    productId: string | null;
  }): Promise<InventoryValuationRecalculationStatusReport> {
    const companyId = requiredText(input.companyId, "companyId");
    const productId = input.productId
      ? requiredText(input.productId, "productId")
      : null;
    const scopeWhere = productId
      ? "company_id=? AND product_id=?"
      : "company_id=?";
    const scopeParams: DatabaseValue[] = productId
      ? [companyId, productId]
      : [companyId];

    const latestMovement = await this.db.queryOne<DateRow>(
      `SELECT MAX(m.business_date) d
       FROM inventory_all_stock_movements m
       WHERE ${productId ? "m.company_id=? AND m.product_id=?" : "m.company_id=?"}
         AND m.reversal_of_movement_id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM inventory_all_stock_movements rv
           WHERE rv.company_id=m.company_id
             AND rv.reversal_of_movement_id=m.movement_id
         )`,
      scopeParams,
    );

    const latestValued = await this.db.queryOne<DateRow>(
      `SELECT MAX(business_date) d
       FROM inventory_valuation_entries
       WHERE ${scopeWhere}`,
      scopeParams,
    );

    const unresolved = await this.db.queryOne<CountRow>(
      `SELECT COUNT(*) n
       FROM inventory_valuation_entries
       WHERE ${scopeWhere} AND cost_state='unresolved'`,
      scopeParams,
    );

    const missing = await this.db.queryOne<CountRow>(
      `SELECT COUNT(*) n
       FROM inventory_all_stock_movements m
       LEFT JOIN inventory_valuation_entries e
         ON e.company_id=m.company_id AND e.movement_id=m.movement_id
       WHERE ${productId ? "m.company_id=? AND m.product_id=?" : "m.company_id=?"}
         AND e.valuation_entry_id IS NULL
         AND m.reversal_of_movement_id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM inventory_all_stock_movements rv
           WHERE rv.company_id=m.company_id
             AND rv.reversal_of_movement_id=m.movement_id
         )`,
      scopeParams,
    );

    const streamKey = productId
      ? `valuation:${companyId}:${productId}`
      : `policy:${companyId}`;
    const streamRevision = await this.db.queryOne<RevisionRow>(
      `SELECT revision
       FROM inventory_valuation_stream_versions
       WHERE company_id=? AND stream_key=?`,
      [companyId, streamKey],
    );

    const noMovements = !latestMovement?.d;
    const needsAttention =
      (unresolved?.n ?? 0) > 0 ||
      (missing?.n ?? 0) > 0 ||
      (!noMovements && !latestValued?.d);

    return Object.freeze({
      companyId,
      productId,
      latestMovementBusinessDate: latestMovement?.d ?? null,
      latestValuedBusinessDate: latestValued?.d ?? null,
      unresolvedCount: (unresolved?.n ?? 0) + (missing?.n ?? 0),
      streamRevision: streamRevision?.revision ?? 0,
      status: noMovements
        ? "empty"
        : needsAttention
          ? "attention-required"
          : "current",
    });
  }
}
