import type { InventoryDocumentType } from "../../domain/inventory-document.ts";
import type { InventoryStockKey, InventoryStockMovementSnapshot } from "../../domain/inventory-stock.ts";

export interface InventoryKardexSourceReference {
  readonly documentId: string;
  readonly documentNumber: string | null;
  readonly documentType: InventoryDocumentType;
  readonly lineId: string;
  readonly linePosition: number;
  readonly sourceSystem: string | null;
  readonly sourceDocumentType: string | null;
  readonly sourceDocumentId: string | null;
  readonly sourceLineId: string | null;
}

export interface InventoryKardexReportEntry {
  readonly movement: InventoryStockMovementSnapshot;
  readonly incomingQuantity: string;
  readonly outgoingQuantity: string;
  readonly runningQuantity: string;
  readonly source: InventoryKardexSourceReference;
}

export interface InventoryKardexReport {
  readonly stockKey: InventoryStockKey;
  readonly openingQuantity: string;
  readonly incomingQuantity: string;
  readonly outgoingQuantity: string;
  readonly closingQuantity: string;
  readonly entries: readonly InventoryKardexReportEntry[];
  readonly nextCursor: string | null;
}

export interface InventoryQuantityBalanceReportRow {
  readonly stockKey: InventoryStockKey;
  readonly quantity: string;
  readonly productCode: string;
  readonly productTitle: string;
  readonly warehouseCode: string;
  readonly warehouseTitle: string;
  readonly zoneCode: string | null;
  readonly zoneTitle: string | null;
  readonly locationCode: string | null;
  readonly locationTitle: string | null;
  readonly lastMovementId: string | null;
}

export interface InventoryQuantityBalanceReport {
  readonly items: readonly InventoryQuantityBalanceReportRow[];
  readonly nextCursor: string | null;
}

export interface InventoryKardexReportQuery {
  readonly companyId: string;
  /** Null means company-wide context; a Branch limits branch-owned Warehouses while keeping company-wide Warehouses visible. */
  readonly branchId?: string | null;
  readonly stockKey: InventoryStockKey;
  readonly businessDateFrom?: string | null;
  readonly businessDateTo?: string | null;
  readonly cursor?: string | null;
  readonly limit: number;
}

export interface InventoryQuantityBalanceReportQuery {
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly productId?: string | null;
  readonly warehouseId?: string | null;
  readonly zoneId?: string | null;
  readonly locationId?: string | null;
  readonly includeZero?: boolean;
  readonly cursor?: string | null;
  readonly limit: number;
}

export interface InventoryQuantityReportReader {
  readKardex(query: InventoryKardexReportQuery): Promise<InventoryKardexReport>;
  readBalances(query: InventoryQuantityBalanceReportQuery): Promise<InventoryQuantityBalanceReport>;
}

/** Cursor is opaque outside Inventory and encodes the full deterministic movement chronology tuple. */
export interface InventoryKardexCursorPayload {
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly documentId: string;
  readonly lineId: string;
  readonly movementId: string;
}
