import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type { SalesPostingAggregate } from "./sales-posting.ts";
import {
  rehydrateSalesPosting,
} from "./sales-posting.ts";
import {
  salesPostingSourceIdentityKey,
} from "./sales-posting-source.ts";
import type {
  SalesPostingSourceIdentity,
} from "./sales-posting-source.ts";

export interface SalesPostingConcurrencyExpectation {
  readonly postingId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly source: SalesPostingSourceIdentity;
  readonly expectedPostingVersion: number;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function positiveVersion(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.versionInvalid, field);
  }
  return value;
}

function utcTimestamp(value: string, field: string): string {
  if (typeof value !== "string") {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  return value;
}

export function assertSalesPostingConcurrency(
  current: SalesPostingAggregate,
  expectation: SalesPostingConcurrencyExpectation,
): void {
  if (!current || typeof current !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch,
      "posting",
    );
  }

  if (current.postingId !== expectation.postingId) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch,
      "postingId",
    );
  }

  if (current.companyId !== expectation.companyId) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch,
      "companyId",
    );
  }

  if (current.branchId !== expectation.branchId) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch,
      "branchId",
    );
  }

  if (
    salesPostingSourceIdentityKey(current.source)
    !== salesPostingSourceIdentityKey(expectation.source)
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch,
      "source",
    );
  }

  const expected = positiveVersion(
    expectation.expectedPostingVersion,
    "expectedPostingVersion",
  );
  if (current.version !== expected) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyConflict,
      "expectedPostingVersion",
    );
  }
}

export function applySalesPostingCompareAndSwap(
  current: SalesPostingAggregate,
  expectation: SalesPostingConcurrencyExpectation,
  occurredAtUtc: string,
): SalesPostingAggregate {
  assertSalesPostingConcurrency(current, expectation);
  const occurredAt = utcTimestamp(occurredAtUtc, "occurredAtUtc");

  if (occurredAt < current.updatedAtUtc) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.timestampOrderInvalid,
      "occurredAtUtc",
    );
  }

  const nextVersion = current.version + 1;
  if (!Number.isSafeInteger(nextVersion)) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.versionInvalid,
      "version",
    );
  }

  return rehydrateSalesPosting({
    postingId: current.postingId,
    companyId: current.companyId,
    branchId: current.branchId,
    source: current.source,
    version: nextVersion,
    createdAtUtc: current.createdAtUtc,
    updatedAtUtc: occurredAt,
  });
}
