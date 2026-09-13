import type { DatabaseExecutor } from "@argin/database";
import { createInventoryValuationTraceSnapshot, type InventoryValuationTraceSnapshot } from "@argin/inventory/valuation-security";
import {
  SqliteInventoryValuationCostInputProvider,
  SqliteInventoryValuationEntryRepository,
  SqliteInventoryValuationMovementReader,
  SqliteInventoryValuationPolicyRepository,
} from "@argin/inventory-tauri";

export function createInventoryValuationTraceService(database: DatabaseExecutor) {
  const movements = new SqliteInventoryValuationMovementReader(database);
  const entries = new SqliteInventoryValuationEntryRepository(database);
  const policies = new SqliteInventoryValuationPolicyRepository(database);
  const costs = new SqliteInventoryValuationCostInputProvider(database);
  return async (companyId: string, movementId: string): Promise<InventoryValuationTraceSnapshot | null> => {
    const movement = await movements.findById(companyId, movementId);
    if (!movement) return null;
    const entry = await entries.findByMovement(companyId, movementId);
    if (!entry) return null;
    const history = await policies.listByCompany(companyId);
    const policy = [...history]
      .filter(item => item.effectiveFrom <= movement.businessDate)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
    if (!policy) return null;
    const costInput = await costs.getResolvedInboundCostBasis(companyId, movement);
    return createInventoryValuationTraceSnapshot({
      companyId,
      movementId,
      productId: movement.stockKey.productId,
      policy,
      costInput,
      entry,
    });
  };
}
