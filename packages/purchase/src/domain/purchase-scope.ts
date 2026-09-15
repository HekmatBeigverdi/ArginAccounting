import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./purchase-domain-errors.ts";
import type { PurchaseDomainErrorCode } from "./purchase-domain-errors.ts";
import type { PurchaseDocumentType } from "./purchase-lifecycle.ts";

export type PurchaseFiscalYearStatus = "draft" | "open" | "closing" | "closed";
export type PurchaseFiscalPeriodStatus = "open" | "locked" | "closed";

export interface PurchaseDocumentScope {
  readonly companyId: string;
  readonly branchId: string;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
  readonly fiscalYearStartDate: string;
  readonly fiscalYearEndDate: string;
  readonly fiscalPeriodStartDate: string;
  readonly fiscalPeriodEndDate: string;
  readonly fiscalYearStatus: PurchaseFiscalYearStatus;
  readonly fiscalPeriodStatus: PurchaseFiscalPeriodStatus;
  readonly lockedThroughDate: string | null;
}

export interface CreatePurchaseDocumentScopeInput extends PurchaseDocumentScope {}

export interface PurchaseNumberSeriesRequest {
  readonly seriesType: string;
  readonly scope: {
    readonly companyId: string;
    readonly branchId: string;
    readonly fiscalYearId: string;
  };
}

const fail = (code: PurchaseDomainErrorCode, field: string): never => {
  throw new PurchaseDomainError(code, field);
};

const required = (value: string, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
};

const isoDate = (value: string, field: string): string => {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeInvalid, field);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeInvalid, field);
  }
  return value;
};

export function createPurchaseDocumentScope(
  input: CreatePurchaseDocumentScopeInput,
): PurchaseDocumentScope {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeInvalid, "scope");
  }

  const fiscalYearStatuses: readonly PurchaseFiscalYearStatus[] = [
    "draft", "open", "closing", "closed",
  ];
  const fiscalPeriodStatuses: readonly PurchaseFiscalPeriodStatus[] = [
    "open", "locked", "closed",
  ];
  if (!fiscalYearStatuses.includes(input.fiscalYearStatus)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeInvalid, "scope.fiscalYearStatus");
  }
  if (!fiscalPeriodStatuses.includes(input.fiscalPeriodStatus)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeInvalid, "scope.fiscalPeriodStatus");
  }

  const fiscalYearStartDate = isoDate(input.fiscalYearStartDate, "scope.fiscalYearStartDate");
  const fiscalYearEndDate = isoDate(input.fiscalYearEndDate, "scope.fiscalYearEndDate");
  const fiscalPeriodStartDate = isoDate(input.fiscalPeriodStartDate, "scope.fiscalPeriodStartDate");
  const fiscalPeriodEndDate = isoDate(input.fiscalPeriodEndDate, "scope.fiscalPeriodEndDate");
  const lockedThroughDate = input.lockedThroughDate == null
    ? null
    : isoDate(input.lockedThroughDate, "scope.lockedThroughDate");

  if (fiscalYearStartDate > fiscalYearEndDate) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeInvalid, "scope.fiscalYearEndDate");
  }
  if (fiscalPeriodStartDate > fiscalPeriodEndDate) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeInvalid, "scope.fiscalPeriodEndDate");
  }
  if (fiscalPeriodStartDate < fiscalYearStartDate || fiscalPeriodEndDate > fiscalYearEndDate) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeInvalid, "scope.fiscalPeriodId");
  }

  return Object.freeze({
    companyId: required(input.companyId, "scope.companyId"),
    branchId: required(input.branchId, "scope.branchId"),
    fiscalYearId: required(input.fiscalYearId, "scope.fiscalYearId"),
    fiscalPeriodId: required(input.fiscalPeriodId, "scope.fiscalPeriodId"),
    fiscalYearStartDate,
    fiscalYearEndDate,
    fiscalPeriodStartDate,
    fiscalPeriodEndDate,
    fiscalYearStatus: input.fiscalYearStatus,
    fiscalPeriodStatus: input.fiscalPeriodStatus,
    lockedThroughDate,
  });
}

export function assertPurchaseBusinessDateAllowed(
  scopeInput: PurchaseDocumentScope,
  businessDateInput: string,
): void {
  const scope = createPurchaseDocumentScope(scopeInput);
  const businessDate = isoDate(businessDateInput, "businessDate");

  if (businessDate < scope.fiscalYearStartDate || businessDate > scope.fiscalYearEndDate ||
      businessDate < scope.fiscalPeriodStartDate || businessDate > scope.fiscalPeriodEndDate) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalDateInvalid, "businessDate");
  }
  if (scope.fiscalYearStatus !== "open") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeBlocked, "scope.fiscalYearStatus");
  }
  if (scope.fiscalPeriodStatus !== "open") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeBlocked, "scope.fiscalPeriodStatus");
  }
  if (scope.lockedThroughDate !== null && businessDate <= scope.lockedThroughDate) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.fiscalDateLocked, "businessDate");
  }
}

export function createPurchaseNumberSeriesRequest(
  documentType: PurchaseDocumentType,
  scopeInput: PurchaseDocumentScope,
): PurchaseNumberSeriesRequest {
  const scope = createPurchaseDocumentScope(scopeInput);
  return Object.freeze({
    seriesType: `purchase:${documentType}`,
    scope: Object.freeze({
      companyId: scope.companyId,
      branchId: scope.branchId,
      fiscalYearId: scope.fiscalYearId,
    }),
  });
}
