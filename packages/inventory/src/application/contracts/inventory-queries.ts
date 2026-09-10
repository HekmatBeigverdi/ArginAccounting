import type { InventoryDocumentStatus, InventoryDocumentType } from "../../domain/inventory-document.ts";
import type { InventoryStockKey } from "../../domain/inventory-stock.ts";
import { INVENTORY_APPLICATION_ERROR_CODES as codes, InventoryApplicationError } from "./inventory-errors.ts";

export const INVENTORY_QUERY_LIMITS = Object.freeze({
  minPageSize: 1,
  maxPageSize: 200,
  defaultPageSize: 50,
  minCursorLimit: 1,
  maxCursorLimit: 500,
  defaultCursorLimit: 100,
});

export type InventoryDocumentSortField = "businessDate" | "documentNumber" | "documentType" | "status" | "createdAt" | "updatedAt";
export type InventorySortDirection = "asc" | "desc";

export interface InventoryPageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface InventoryCursorRequest {
  readonly cursor?: string | null;
  readonly limit: number;
}

export interface InventoryDocumentSort {
  readonly field: InventoryDocumentSortField;
  readonly direction: InventorySortDirection;
}

export interface InventoryDocumentFilter {
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly fiscalYearId?: string | null;
  readonly fiscalPeriodId?: string | null;
  readonly documentTypes?: readonly InventoryDocumentType[];
  readonly statuses?: readonly InventoryDocumentStatus[];
  readonly businessDateFrom?: string | null;
  readonly businessDateTo?: string | null;
  readonly productId?: string | null;
  readonly warehouseId?: string | null;
  readonly sourceSystem?: string | null;
  readonly search?: string | null;
}

export interface ListInventoryDocumentsQuery {
  readonly filter: InventoryDocumentFilter;
  readonly page: InventoryPageRequest;
  readonly sort?: InventoryDocumentSort;
}

export interface GetInventoryDocumentQuery {
  readonly companyId: string;
  readonly documentId: string;
}

export interface GetInventoryDocumentByNumberQuery {
  readonly companyId: string;
  readonly fiscalYearId: string;
  readonly branchId: string | null;
  readonly documentType: InventoryDocumentType;
  readonly documentNumber: string;
}

export interface InventoryKardexQuery {
  readonly companyId: string;
  readonly stockKey: InventoryStockKey;
  readonly businessDateFrom?: string | null;
  readonly businessDateTo?: string | null;
  readonly page: InventoryCursorRequest;
}

export interface InventoryBalanceQuery {
  readonly companyId: string;
  readonly productId?: string | null;
  readonly warehouseId?: string | null;
  readonly zoneId?: string | null;
  readonly locationId?: string | null;
  readonly includeZero?: boolean;
  readonly page: InventoryCursorRequest;
}

function invalid(field: string): never {
  throw new InventoryApplicationError(codes.invalidRequest, field);
}

export function normalizeInventoryPageRequest(input: InventoryPageRequest): InventoryPageRequest {
  if (!input || typeof input !== "object") return invalid("page");
  if (!Number.isSafeInteger(input.page) || input.page < 1) return invalid("page.page");
  if (!Number.isSafeInteger(input.pageSize) ||
      input.pageSize < INVENTORY_QUERY_LIMITS.minPageSize ||
      input.pageSize > INVENTORY_QUERY_LIMITS.maxPageSize) return invalid("page.pageSize");
  return Object.freeze({ page: input.page, pageSize: input.pageSize });
}

export function normalizeInventoryCursorRequest(input: InventoryCursorRequest): InventoryCursorRequest {
  if (!input || typeof input !== "object") return invalid("page");
  if (!Number.isSafeInteger(input.limit) ||
      input.limit < INVENTORY_QUERY_LIMITS.minCursorLimit ||
      input.limit > INVENTORY_QUERY_LIMITS.maxCursorLimit) return invalid("page.limit");
  if (input.cursor !== undefined && input.cursor !== null &&
      (typeof input.cursor !== "string" || !input.cursor.trim() || input.cursor.length > 512)) {
    return invalid("page.cursor");
  }
  return Object.freeze({ cursor: input.cursor == null ? null : input.cursor.trim(), limit: input.limit });
}
