export interface PurchasePostingFiscalContext {
  readonly companyId: string;
  readonly fiscalYearId: string;
  readonly fiscalYearStartDate: string;
  readonly fiscalYearEndDate: string;
  readonly fiscalYearStatus: "draft" | "open" | "closing" | "closed";
  readonly fiscalPeriodId: string;
  readonly fiscalPeriodStartDate: string;
  readonly fiscalPeriodEndDate: string;
  readonly fiscalPeriodStatus: "open" | "locked" | "closed";
}

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type {
  PurchasePostingDomainErrorCode,
} from "./purchase-posting-domain-errors.ts";

export type PurchasePostingHistoricalLockScope =
  | "all"
  | "accounting"
  | "purchases";

export interface PurchasePostingHistoricalLock {
  readonly scope: PurchasePostingHistoricalLockScope;
  readonly lockedThroughDate: string;
}

export interface PurchasePostingFiscalContextReader {
  resolve(
    companyId: string,
    operationDate: string,
  ): Promise<PurchasePostingFiscalContext | null>;
}

export interface PurchasePostingHistoricalLockReader {
  findActiveLocks(
    companyId: string,
    branchId: string | null,
    scope: PurchasePostingHistoricalLockScope,
  ): Promise<readonly PurchasePostingHistoricalLock[]>;
}

export interface PurchasePostingFiscalGateDependencies {
  readonly fiscalContext: PurchasePostingFiscalContextReader;
  readonly historicalLocks: PurchasePostingHistoricalLockReader;
}

export interface AssertPurchasePostingFiscalScopeInput {
  readonly companyId: string;
  readonly branchId: string | null;
  readonly fiscalYearId?: string | null;
  readonly fiscalPeriodId?: string | null;
  readonly operationDate: string;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

export async function assertPurchasePostingFiscalScope(
  input: AssertPurchasePostingFiscalScopeInput,
  dependencies: PurchasePostingFiscalGateDependencies,
): Promise<PurchasePostingFiscalContext> {
  if (!isIsoDate(input.operationDate)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalDateOutOfRange, "operationDate");
  }

  const context = await dependencies.fiscalContext.resolve(
    input.companyId,
    input.operationDate,
  );

  if (context === null) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalContextMissing, "operationDate");
  }

  if (
    context.companyId !== input.companyId
    || (input.fiscalYearId != null && context.fiscalYearId !== input.fiscalYearId)
    || (input.fiscalPeriodId != null && context.fiscalPeriodId !== input.fiscalPeriodId)
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalScopeMismatch, "fiscalContext");
  }

  if (context.fiscalYearStatus !== "open") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalYearNotOpen, "fiscalYearId");
  }

  if (context.fiscalPeriodStatus !== "open") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalPeriodNotOpen, "fiscalPeriodId");
  }

  if (
    input.operationDate < context.fiscalYearStartDate
    || input.operationDate > context.fiscalYearEndDate
    || input.operationDate < context.fiscalPeriodStartDate
    || input.operationDate > context.fiscalPeriodEndDate
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalDateOutOfRange, "operationDate");
  }

  const scopes = ["all", "accounting", "purchases"] as const;
  for (const scope of scopes) {
    const locks = await dependencies.historicalLocks.findActiveLocks(
      input.companyId,
      input.branchId,
      scope,
    );
    if (locks.some(lock => input.operationDate <= lock.lockedThroughDate)) {
      return fail(
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.historicalLockBlocked,
        `historicalLock.${scope}`,
      );
    }
  }

  return context;
}
