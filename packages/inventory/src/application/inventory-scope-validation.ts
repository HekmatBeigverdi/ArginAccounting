import type { CompanyRepository, BranchRepository } from "@argin/company";
import type {
  FiscalYearRepository,
  FiscalPeriodRepository,
  HistoricalLockRepository,
} from "@argin/fiscal";
import type { AuthenticatedUser } from "@argin/security";
import { isWarehouseVisibleToBranch } from "@argin/warehouse";
import type { WarehouseReader } from "@argin/warehouse";
import { rehydrateInventoryDocument } from "../domain/inventory-document.ts";
import type { InventoryDocumentSnapshot } from "../domain/inventory-document.ts";
import type { InventoryDocumentScope } from "../domain/inventory-scope.ts";
import { inventoryScopeId } from "../domain/inventory-scope.ts";
import {
  InventoryDomainError,
  INVENTORY_DOMAIN_ERROR_CODES as codes,
} from "../domain/inventory-errors.ts";

/** Only published upstream reader contracts; transaction-bound implementations are supplied by composition. */
export interface InventoryScopeReaders {
  readonly companies: Pick<CompanyRepository, "findById">;
  readonly branches: Pick<BranchRepository, "findById">;
  readonly fiscalYears: Pick<FiscalYearRepository, "findById">;
  readonly fiscalPeriods: Pick<FiscalPeriodRepository, "findById">;
  readonly historicalLocks: Pick<HistoricalLockRepository, "findActiveLocks">;
  readonly warehouses: Pick<WarehouseReader, "getById">;
}

export interface InventoryScopeContext {
  /** Trusted authenticated Company selection, not a field accepted from a document request. */
  readonly companyId: string;
  readonly actor: Pick<AuthenticatedUser, "id" | "branchIds" | "permissions">;
  /** Trusted configuration; default is disabled. Not a caller-controlled document flag. */
  readonly allowCrossBranchTransfers?: boolean;
}

export type ScopedInventoryDocument = InventoryDocumentSnapshot & {
  readonly scope: InventoryDocumentScope;
};

function fail(code: (typeof codes)[keyof typeof codes], field: string): never {
  throw new InventoryDomainError(code, field);
}

function validateFiscalDate(value: string, field: string): string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return fail(codes.fiscalScopeInvalid, field);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail(codes.fiscalScopeInvalid, field);
  }
  return value;
}

function isDateWithinRange(start: string, end: string, operationDate: string): boolean {
  return (
    validateFiscalDate(start, "startDate") <= operationDate &&
    operationDate <= validateFiscalDate(end, "endDate")
  );
}

/** Current write eligibility only. Historical reads continue to use Domain rehydration. */
export async function validateInventoryDocumentScope(
  input: InventoryDocumentSnapshot,
  context: InventoryScopeContext,
  readers: InventoryScopeReaders,
): Promise<ScopedInventoryDocument> {
  // Copy/freeze document and capture trusted actor/policy before any await.
  const document = rehydrateInventoryDocument(input);
  const scope = document.scope;
  if (!scope) {
    return fail(codes.scopeRequired, "scope");
  }
  if (!context || inventoryScopeId(context.companyId, "context.companyId") !== document.companyId) {
    return fail(codes.companyScopeMismatch, "companyId");
  }
  if (
    !context.actor ||
    !Array.isArray(context.actor.branchIds) ||
    !Array.isArray(context.actor.permissions)
  ) {
    return fail(codes.branchAccessDenied, "actor");
  }
  inventoryScopeId(context.actor.id, "actor.id");
  const actorBranchIds = [...context.actor.branchIds];
  const hasFullAccess = context.actor.permissions.includes("system.full-access");
  if (
    context.allowCrossBranchTransfers !== undefined &&
    typeof context.allowCrossBranchTransfers !== "boolean"
  ) {
    return fail(codes.scopeInvalid, "allowCrossBranchTransfers");
  }
  const destinationBranchId =
    document.documentType === "transfer"
      ? (scope.destinationBranchId ?? scope.branchId)
      : scope.branchId;
  if (destinationBranchId !== scope.branchId && context.allowCrossBranchTransfers !== true) {
    return fail(codes.crossBranchTransferDenied, "destinationBranchId");
  }
  const documentBranchIds = [...new Set([scope.branchId, destinationBranchId])];
  for (const branchId of documentBranchIds) {
    if (branchId !== null && !hasFullAccess && !actorBranchIds.includes(branchId)) {
      return fail(codes.branchAccessDenied, "branchId");
    }
  }

  // Verify that the company and each document branch are active and belong together.
  const company = await readers.companies.findById(document.companyId);
  if (!company || company.id !== document.companyId || company.status !== "active") {
    return fail(codes.companyScopeMismatch, "companyId");
  }
  for (const branchId of documentBranchIds) {
    if (branchId === null) {
      continue;
    }
    const branch = await readers.branches.findById(branchId);
    if (
      !branch ||
      branch.id !== branchId ||
      branch.companyId !== document.companyId ||
      branch.status !== "active"
    ) {
      return fail(codes.branchScopeMismatch, "branchId");
    }
  }

  // Require an open fiscal year and period containing the business date.
  const year = await readers.fiscalYears.findById(scope.fiscalYearId);
  if (
    !year ||
    year.id !== scope.fiscalYearId ||
    year.companyId !== document.companyId ||
    year.status !== "open" ||
    year.closedAt !== null ||
    !isDateWithinRange(year.startDate, year.endDate, document.businessDate)
  ) {
    return fail(codes.fiscalScopeInvalid, "fiscalYearId");
  }
  const period = await readers.fiscalPeriods.findById(scope.fiscalPeriodId);
  if (
    !period ||
    period.id !== scope.fiscalPeriodId ||
    period.fiscalYearId !== year.id ||
    period.status !== "open" ||
    !isDateWithinRange(period.startDate, period.endDate, document.businessDate) ||
    period.startDate < year.startDate ||
    period.endDate > year.endDate
  ) {
    return fail(codes.fiscalScopeInvalid, "fiscalPeriodId");
  }

  // Check company-wide and branch-specific historical locks.
  for (const branchId of documentBranchIds) {
    // Shared repository contract includes Company-wide locks and scope='all'.
    const locks = await readers.historicalLocks.findActiveLocks(
      document.companyId,
      branchId,
      "inventory",
    );
    if (!Array.isArray(locks)) {
      return fail(codes.fiscalScopeInvalid, "historicalLocks");
    }
    for (const lock of locks) {
      if (!lock || typeof lock !== "object") {
        return fail(codes.fiscalScopeInvalid, "historicalLocks");
      }
      if (
        !lock.isActive ||
        lock.companyId !== document.companyId ||
        (lock.scope !== "inventory" && lock.scope !== "all") ||
        (lock.branchId !== null && lock.branchId !== branchId)
      ) {
        continue;
      }
      if (
        document.businessDate <= validateFiscalDate(lock.lockedThroughDate, "lockedThroughDate")
      ) {
        return fail(codes.historicalLockBlocked, "businessDate");
      }
    }
  }

  // One scoped lookup per distinct warehouse/branch pair; never use mutable UI labels.
  const checkedWarehouseBranchPairs = new Set<string>();
  for (const line of document.lines) {
    // Incomplete drafts remain valid; confirmation later rejects them.
    if (!line.operation) {
      continue;
    }
    const endpoints = [{ reference: line.operation.warehouse, branchId: scope.branchId }];
    if (line.operation.destination) {
      endpoints.push({ reference: line.operation.destination, branchId: destinationBranchId });
    }
    for (const endpoint of endpoints) {
      const warehouseId = endpoint.reference.warehouseId;
      const key = JSON.stringify([warehouseId, endpoint.branchId]);
      if (checkedWarehouseBranchPairs.has(key)) {
        continue;
      }
      const warehouse = await readers.warehouses.getById({
        companyId: document.companyId,
        warehouseId,
      });
      if (
        !warehouse ||
        warehouse.companyId !== document.companyId ||
        warehouse.warehouseId !== warehouseId ||
        !warehouse.organizationalScope ||
        (warehouse.organizationalScope.mode !== "company" &&
          warehouse.organizationalScope.mode !== "branch") ||
        !isWarehouseVisibleToBranch(warehouse, endpoint.branchId)
      ) {
        return fail(codes.warehouseBranchMismatch, "warehouseId");
      }
      checkedWarehouseBranchPairs.add(key);
    }
  }

  return Object.freeze({ ...document, scope });
}
