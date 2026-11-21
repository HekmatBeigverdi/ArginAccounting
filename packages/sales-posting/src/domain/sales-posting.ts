import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import {
  createSalesPostingSourceIdentity,
} from "./sales-posting-source.ts";
import type {
  CreateSalesPostingSourceIdentityInput,
  SalesPostingSourceIdentity,
} from "./sales-posting-source.ts";

export interface SalesPostingAggregate {
  readonly postingId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly source: SalesPostingSourceIdentity;
  readonly version: number;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

export interface CreateSalesPostingInput {
  readonly postingId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly source: CreateSalesPostingSourceIdentityInput | SalesPostingSourceIdentity;
  readonly createdAtUtc: string;
}

export interface RehydrateSalesPostingInput {
  readonly postingId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly source: CreateSalesPostingSourceIdentityInput | SalesPostingSourceIdentity;
  readonly version: number;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function assertObject(value: unknown, field: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.inputInvalid, field);
  }
}

function identity(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  const normalized = value.trim();
  if (normalized.length > 128) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.identityInvalid, field);
  }
  return normalized;
}

function version(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.versionInvalid, "version");
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

function normalize(input: RehydrateSalesPostingInput): SalesPostingAggregate {
  assertObject(input, "posting");

  const createdAtUtc = utcTimestamp(input.createdAtUtc, "createdAtUtc");
  const updatedAtUtc = utcTimestamp(input.updatedAtUtc, "updatedAtUtc");
  if (updatedAtUtc < createdAtUtc) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.timestampOrderInvalid, "updatedAtUtc");
  }

  return Object.freeze({
    postingId: identity(input.postingId, "postingId"),
    companyId: identity(input.companyId, "companyId"),
    branchId: identity(input.branchId, "branchId"),
    source: createSalesPostingSourceIdentity(input.source),
    version: version(input.version),
    createdAtUtc,
    updatedAtUtc,
  });
}

export function createSalesPosting(input: CreateSalesPostingInput): SalesPostingAggregate {
  assertObject(input, "posting");
  const createdAtUtc = utcTimestamp(input.createdAtUtc, "createdAtUtc");

  return normalize({
    postingId: input.postingId,
    companyId: input.companyId,
    branchId: input.branchId,
    source: input.source,
    version: 1,
    createdAtUtc,
    updatedAtUtc: createdAtUtc,
  });
}

export function rehydrateSalesPosting(
  input: RehydrateSalesPostingInput,
): SalesPostingAggregate {
  return normalize(input);
}
