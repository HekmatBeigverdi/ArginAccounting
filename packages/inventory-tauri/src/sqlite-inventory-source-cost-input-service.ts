import type { DatabaseExecutor } from "@argin/database";
import type { InventoryResolvedInboundCostBasis } from "@argin/inventory/inbound-cost";
import { SqliteInventoryValuationCostInputProvider, SqliteInventoryValuationMovementReader } from "./sqlite-inventory-valuation-repositories.ts";

/** Accepts authoritative source costs without rounding them again or replacing manual costs.
 * Monetary projections remain owned by Inventory's valuation/recalculation workflow.
 */
export class SqliteInventorySourceCostInputService {
  constructor(private readonly database: DatabaseExecutor) {}

  async accept(companyId: string, basis: InventoryResolvedInboundCostBasis): Promise<void> {
    await this.database.transaction(async session => {
      const movement = await new SqliteInventoryValuationMovementReader(session).findById(companyId, basis.movementId);
      if (!movement || movement.quantityDelta.startsWith("-") || movement.quantityDelta !== basis.quantity ||
          movement.stockKey.productId !== basis.productId || movement.stockKey.warehouseId !== basis.warehouseId) {
        throw new Error("مبنای هزینه با گردش قطعی موجودی مطابقت ندارد.");
      }
      if (!basis.basisLineId || !/^[A-Z]{3}$/.test(basis.currency) || !/^\d+(\.\d+)?$/.test(basis.unitCost) ||
          ![basis.baseCost, basis.landedCost, basis.totalCost].every(value => Number.isSafeInteger(value) && value >= 0) ||
          basis.totalCost !== basis.baseCost + basis.landedCost) {
        throw new Error("مبنای هزینه معتبر نیست.");
      }
      const existing = await new SqliteInventoryValuationCostInputProvider(session).getResolvedInboundCostBasis(companyId, movement);
      if (existing) {
        if (existing.basisLineId === basis.basisLineId && existing.totalCost === basis.totalCost &&
            existing.currency === basis.currency && existing.quantity === basis.quantity &&
            existing.unitCost === basis.unitCost && existing.baseCost === basis.baseCost &&
            existing.landedCost === basis.landedCost) return;
        throw new Error("برای این رسید قبلاً مبنای هزینه دیگری ثبت شده است؛ اصلاح هزینه باید از مسیر ارزش‌گذاری انجام شود.");
      }
      await session.execute(`INSERT INTO inventory_valuation_cost_inputs
        (basis_line_id,company_id,movement_id,product_id,warehouse_id,quantity,currency,
         base_cost,landed_cost,total_cost,unit_cost,allocations_json,revision)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [basis.basisLineId,companyId,basis.movementId,basis.productId,basis.warehouseId,basis.quantity,
          basis.currency,basis.baseCost,basis.landedCost,basis.totalCost,basis.unitCost,JSON.stringify(basis.allocations)]);
      await session.execute(`INSERT INTO inventory_valuation_stream_versions(company_id,stream_key,revision)
        VALUES (?,?,1) ON CONFLICT(company_id,stream_key) DO UPDATE SET revision=revision+1`,
        [companyId, `valuation:${companyId}:${basis.productId}`]);
    });
  }
}
