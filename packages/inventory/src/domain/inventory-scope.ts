import { InventoryDomainError, INVENTORY_DOMAIN_ERROR_CODES as codes } from "./inventory-errors.ts";

export interface InventoryDocumentScope {
  readonly branchId: string | null;
  readonly destinationBranchId: string | null;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
}
export interface CreateInventoryDocumentScopeInput {
  readonly branchId?: string | null;
  /** Null means use the source document Branch for destination eligibility. */
  readonly destinationBranchId?: string | null;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
}
export function inventoryScopeId(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 128 || value.trim() === "*") {
    throw new InventoryDomainError(codes.scopeInvalid, field);
  }
  return value.trim();
}
export function createInventoryDocumentScope(input: CreateInventoryDocumentScopeInput): InventoryDocumentScope {
  if (!input || typeof input !== "object") throw new InventoryDomainError(codes.scopeInvalid, "scope");
  return Object.freeze({
    branchId: input.branchId == null ? null : inventoryScopeId(input.branchId, "branchId"),
    destinationBranchId: input.destinationBranchId == null ? null : inventoryScopeId(input.destinationBranchId, "destinationBranchId"),
    fiscalYearId: inventoryScopeId(input.fiscalYearId, "fiscalYearId"),
    fiscalPeriodId: inventoryScopeId(input.fiscalPeriodId, "fiscalPeriodId"),
  });
}
