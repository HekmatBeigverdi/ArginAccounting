import type { CurrencyCode } from "@argin/platform";
import type { InventoryValuationMethod } from "../../domain/inventory-valuation.ts";
import type { InventoryCostUnresolvedReason } from "../../domain/inventory-cost-resolution-policy.ts";

export const INVENTORY_VALUATION_REPORT_MAX_LIMIT = 500 as const;

export interface InventoryValuationReportScope {
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly productId?: string | null;
  readonly warehouseId?: string | null;
}

export interface InventoryValuationAsOfQuery extends InventoryValuationReportScope {
  readonly asOfBusinessDate: string;
  readonly limit: number;
}

export interface InventoryValuationValueRow {
  readonly productId: string;
  readonly warehouseId: string;
  readonly zoneId: string | null;
  readonly locationId: string | null;
  readonly businessDate: string;
  readonly policyId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly quantity: string;
  readonly totalCost: number | null;
  readonly unresolvedCount: number;
}

export interface InventoryValuationAsOfReport {
  readonly asOfBusinessDate: string;
  readonly rows: readonly InventoryValuationValueRow[];
  readonly resolvedTotalCost: number;
  readonly unresolvedRowCount: number;
  readonly truncated: boolean;
}

export interface InventoryValuationKardexCursor {
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly documentId: string;
  readonly lineId: string;
  readonly movementId: string;
}

export interface InventoryValuationMonetaryKardexQuery extends InventoryValuationReportScope {
  readonly productId: string;
  readonly warehouseId: string;
  readonly businessDateFrom?: string | null;
  readonly businessDateTo?: string | null;
  readonly cursor?: string | null;
  readonly limit: number;
}

export interface InventoryValuationMonetaryKardexEntry {
  readonly valuationEntryId: string;
  readonly movementId: string;
  readonly documentId: string;
  readonly lineId: string;
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly kind: "inbound" | "outbound" | "transfer" | "reversal";
  readonly method: InventoryValuationMethod;
  readonly currency: CurrencyCode;
  readonly quantity: string;
  readonly unitCost: string | null;
  readonly monetaryDelta: number | null;
  readonly runningResolvedCost: number;
  readonly costState: "resolved" | "unresolved";
  readonly unresolvedReason: string | null;
}

export interface InventoryValuationMonetaryKardexReport {
  readonly openingResolvedCost: number;
  readonly entries: readonly InventoryValuationMonetaryKardexEntry[];
  readonly closingResolvedCost: number;
  readonly unresolvedCount: number;
  readonly nextCursor: string | null;
}

export interface InventoryValuationLayerQuery extends InventoryValuationReportScope {
  readonly productId?: string | null;
  readonly onlyOpen?: boolean;
  readonly limit: number;
}

export interface InventoryValuationLayerRow {
  readonly costLayerId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly zoneId: string | null;
  readonly locationId: string | null;
  readonly sourceMovementId: string;
  readonly sourceValuationEntryId: string;
  readonly openedBusinessDate: string;
  readonly openedBusinessOrder: number;
  readonly currency: CurrencyCode;
  readonly originalQuantity: string;
  readonly remainingQuantity: string;
  readonly unitCost: string;
  readonly originalCost: number;
  readonly remainingCost: number;
  readonly revision: number;
}

export interface InventoryValuationLayerReport {
  readonly rows: readonly InventoryValuationLayerRow[];
  readonly truncated: boolean;
}

export interface InventoryValuationUnresolvedQuery extends InventoryValuationReportScope {
  readonly fromBusinessDate?: string | null;
  readonly limit: number;
}

export interface InventoryValuationUnresolvedRow {
  readonly valuationEntryId: string;
  readonly movementId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly quantity: string;
  readonly method: InventoryValuationMethod;
  readonly currency: CurrencyCode;
  readonly reason: InventoryCostUnresolvedReason | string;
}

export interface InventoryValuationUnresolvedReport {
  readonly rows: readonly InventoryValuationUnresolvedRow[];
  readonly truncated: boolean;
}

export interface InventoryValuationRecalculationStatusQuery {
  readonly companyId: string;
  readonly productId?: string | null;
}

export interface InventoryValuationRecalculationStatusReport {
  readonly companyId: string;
  readonly productId: string | null;
  readonly latestMovementBusinessDate: string | null;
  readonly latestValuedBusinessDate: string | null;
  readonly unresolvedCount: number;
  readonly streamRevision: number;
  readonly status: "empty" | "current" | "attention-required";
}

export interface InventoryValuationReportReader {
  readAsOf(query: InventoryValuationAsOfQuery): Promise<InventoryValuationAsOfReport>;
  readMonetaryKardex(query: InventoryValuationMonetaryKardexQuery): Promise<InventoryValuationMonetaryKardexReport>;
  readLayers(query: InventoryValuationLayerQuery): Promise<InventoryValuationLayerReport>;
  readUnresolved(query: InventoryValuationUnresolvedQuery): Promise<InventoryValuationUnresolvedReport>;
  readRecalculationStatus(query: InventoryValuationRecalculationStatusQuery): Promise<InventoryValuationRecalculationStatusReport>;
}
