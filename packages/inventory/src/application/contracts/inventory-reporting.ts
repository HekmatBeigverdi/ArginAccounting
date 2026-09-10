import type { InventoryDocumentType } from "../../domain/inventory-document.ts";
import type {
  InventoryStockKey,
  InventoryStockMovementSnapshot,
} from "../../domain/inventory-stock.ts";

export interface InventoryKardexSourceReference {
  /** User-facing source document; reversal facts resolve to the original document. */
  readonly documentId: string;
  readonly documentNumber: string | null;
  readonly documentType: InventoryDocumentType;
  readonly documentDescription: string | null;
  readonly lineId: string;
  readonly linePosition: number;
  readonly lineDescription: string | null;
  readonly isReversal: boolean;
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

/** Exact product quantity grouped by one visible Warehouse; quantity is always in the Product base unit. */
export interface InventoryProductWarehouseBalanceRow {
  readonly warehouseId: string;
  readonly warehouseCode: string;
  readonly warehouseTitle: string;
  readonly quantity: string;
  readonly stockKeyCount: number;
}

/** Management-oriented product summary across the caller's visible Warehouse scope. */
export interface InventoryProductBalanceSummaryRow {
  readonly companyId: string;
  readonly productId: string;
  readonly productCode: string;
  readonly productTitle: string;
  readonly totalQuantity: string;
  readonly warehouseCount: number;
  readonly stockKeyCount: number;
  readonly warehouses: readonly InventoryProductWarehouseBalanceRow[];
}

export interface InventoryProductBalanceSummaryReport {
  readonly items: readonly InventoryProductBalanceSummaryRow[];
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

export interface InventoryProductBalanceSummaryQuery {
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly productId?: string | null;
  readonly includeZero?: boolean;
  /** Opaque product cursor. */
  readonly cursor?: string | null;
  readonly limit: number;
}

export interface InventoryQuantityReportReader {
  readKardex(query: InventoryKardexReportQuery): Promise<InventoryKardexReport>;
  readBalances(
    query: InventoryQuantityBalanceReportQuery,
  ): Promise<InventoryQuantityBalanceReport>;
  readProductSummaries(
    query: InventoryProductBalanceSummaryQuery,
  ): Promise<InventoryProductBalanceSummaryReport>;
}

/** Cursor is opaque outside Inventory and encodes the full deterministic movement chronology tuple. */
export interface InventoryKardexCursorPayload {
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly documentId: string;
  readonly lineId: string;
  readonly movementId: string;
}
