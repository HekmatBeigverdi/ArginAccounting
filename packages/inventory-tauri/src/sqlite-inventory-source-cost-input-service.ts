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

      const policy = await session.queryOne<{
        policy_id: string;
        method: "fifo" | "moving_average";
        strategy_version: number;
        currency: string;
      }>(`SELECT policy_id,method,strategy_version,currency
           FROM inventory_valuation_policies
          WHERE company_id=? AND effective_from<=?
          ORDER BY effective_from DESC,revision DESC
          LIMIT 1`, [companyId, movement.businessDate]);

      if (policy) {
        const valuationEntryId = `valuation:${basis.movementId}`;
        const valuedAt = new Date().toISOString();
        await session.execute(
          `INSERT INTO inventory_valuation_entries(
            valuation_entry_id,company_id,product_id,movement_id,document_id,line_id,
            reversal_of_movement_id,transfer_id,kind,method,strategy_version,currency,
            warehouse_id,zone_id,location_id,business_date,business_order,quantity,
            unit_cost,total_cost,cost_state,unresolved_reason,valued_at,revision
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
          ON CONFLICT(company_id,movement_id) DO UPDATE SET
            method=excluded.method,
            strategy_version=excluded.strategy_version,
            currency=excluded.currency,
            quantity=excluded.quantity,
            unit_cost=excluded.unit_cost,
            total_cost=excluded.total_cost,
            cost_state='resolved',
            unresolved_reason=NULL,
            valued_at=excluded.valued_at,
            revision=inventory_valuation_entries.revision+1`,
          [valuationEntryId,companyId,basis.productId,basis.movementId,movement.documentId,movement.lineId,
            movement.reversalOfMovementId ?? null,movement.transferId ?? null,"inbound",policy.method,
            policy.strategy_version,policy.currency,basis.warehouseId,movement.stockKey.zoneId,
            movement.stockKey.locationId,movement.businessDate,movement.businessOrder,basis.quantity,
            basis.unitCost,basis.totalCost,"resolved",null,valuedAt],
        );

        if (policy.method === "fifo") {
          await session.execute(
            `INSERT INTO inventory_valuation_cost_layers(
              cost_layer_id,company_id,product_id,source_movement_id,source_valuation_entry_id,
              method,strategy_version,currency,warehouse_id,zone_id,location_id,
              opened_business_date,opened_business_order,original_quantity,remaining_quantity,
              unit_cost,original_cost,remaining_cost,revision
            ) VALUES(?,?,?,?,?,'fifo',?,?,?,?,?,?,?,?,?,?,?,?,1)
            ON CONFLICT(cost_layer_id) DO NOTHING`,
            [`fifo-layer:${basis.movementId}`,companyId,basis.productId,basis.movementId,valuationEntryId,
              policy.strategy_version,policy.currency,basis.warehouseId,movement.stockKey.zoneId,
              movement.stockKey.locationId,movement.businessDate,movement.businessOrder,basis.quantity,
              basis.quantity,basis.unitCost,basis.totalCost,basis.totalCost],
          );
        }
      }

      await session.execute(`INSERT INTO inventory_valuation_stream_versions(company_id,stream_key,revision)
        VALUES (?,?,1) ON CONFLICT(company_id,stream_key) DO UPDATE SET revision=revision+1`,
        [companyId, `valuation:${companyId}:${basis.productId}`]);
    });
  }
}
