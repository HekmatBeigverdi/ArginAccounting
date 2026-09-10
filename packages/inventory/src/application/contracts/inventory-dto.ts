import type {
  InventoryDocumentSnapshot,
  InventoryDocumentStatus,
  InventoryDocumentType,
} from "../../domain/inventory-document.ts";
import type {
  InventoryStockBalanceSnapshot,
  InventoryStockKey,
  InventoryStockMovementSnapshot,
} from "../../domain/inventory-stock.ts";

export interface InventoryDocumentListItem {
  readonly documentId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly fiscalYearId: string | null;
  readonly fiscalPeriodId: string | null;
  readonly documentType: InventoryDocumentType;
  readonly status: InventoryDocumentStatus;
  readonly documentNumber: string | null;
  readonly businessDate: string;
  readonly lineCount: number;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InventoryDocumentDetail {
  readonly document: InventoryDocumentSnapshot;
  readonly movements: readonly InventoryStockMovementSnapshot[];
}

export interface InventoryKardexEntry {
  readonly movement: InventoryStockMovementSnapshot;
  /** Running quantity after this movement in canonical business chronology. */
  readonly runningQuantity: string;
}

export interface InventoryBalanceRow {
  readonly stockKey: InventoryStockKey;
  readonly quantity: string;
  readonly movementCount: number;
  readonly lastMovementId: string | null;
}

export interface InventoryPage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
}

export interface InventoryCursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export function inventoryBalanceRowFromSnapshot(snapshot: InventoryStockBalanceSnapshot): InventoryBalanceRow {
  return Object.freeze({
    stockKey: snapshot.stockKey,
    quantity: snapshot.quantity,
    movementCount: snapshot.movementCount,
    lastMovementId: snapshot.lastMovementId,
  });
}
