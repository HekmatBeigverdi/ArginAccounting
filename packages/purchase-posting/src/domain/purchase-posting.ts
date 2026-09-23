import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";

export const PURCHASE_POSTING_STATUSES = Object.freeze([
  "draft",
  "prepared",
  "posted",
  "reversed",
] as const);

export type PurchasePostingStatus = (typeof PURCHASE_POSTING_STATUSES)[number];

export interface PurchasePostingAggregate {
  readonly postingId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly status: PurchasePostingStatus;
  readonly journalVoucherId: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePurchasePostingInput {
  readonly postingId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly createdAt: string;
}

export interface RehydratePurchasePostingInput {
  readonly postingId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly status: PurchasePostingStatus;
  readonly journalVoucherId: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function assertObject(value: unknown, field: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.inputInvalid, field);
  }
}

function identity(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function optionalIdentity(value: string | null, field: string): string | null {
  if (value === null) return null;
  return identity(value, field);
}

function timestamp(value: string, field: string): string {
  if (typeof value !== "string") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  return value;
}

function status(value: PurchasePostingStatus): PurchasePostingStatus {
  if (!PURCHASE_POSTING_STATUSES.includes(value)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.statusInvalid, "status");
  }
  return value;
}

function assertStateInvariant(
  postingStatus: PurchasePostingStatus,
  journalVoucherId: string | null,
): void {
  const hasJournal = journalVoucherId !== null;
  if (postingStatus === "draft" && hasJournal) {
    fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.stateInvalid, "journalVoucherId");
  }
  if ((postingStatus === "prepared" || postingStatus === "posted" || postingStatus === "reversed") && !hasJournal) {
    fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.stateInvalid, "journalVoucherId");
  }
}

function normalize(input: RehydratePurchasePostingInput): PurchasePostingAggregate {
  assertObject(input, "posting");

  const createdAt = timestamp(input.createdAt, "createdAt");
  const updatedAt = timestamp(input.updatedAt, "updatedAt");
  if (updatedAt < createdAt) {
    fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.timestampOrderInvalid, "updatedAt");
  }
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid, "version");
  }

  const postingStatus = status(input.status);
  const journalVoucherId = optionalIdentity(input.journalVoucherId, "journalVoucherId");
  assertStateInvariant(postingStatus, journalVoucherId);

  return Object.freeze({
    postingId: identity(input.postingId, "postingId"),
    companyId: identity(input.companyId, "companyId"),
    branchId: identity(input.branchId, "branchId"),
    status: postingStatus,
    journalVoucherId,
    version: input.version,
    createdAt,
    updatedAt,
  });
}

export function createPurchasePosting(
  input: CreatePurchasePostingInput,
): PurchasePostingAggregate {
  assertObject(input, "posting");
  const createdAt = timestamp(input.createdAt, "createdAt");
  return normalize({
    postingId: input.postingId,
    companyId: input.companyId,
    branchId: input.branchId,
    status: "draft",
    journalVoucherId: null,
    version: 1,
    createdAt,
    updatedAt: createdAt,
  });
}

export function rehydratePurchasePosting(
  input: RehydratePurchasePostingInput,
): PurchasePostingAggregate {
  return normalize(input);
}


export function preparePurchasePosting(
  posting: PurchasePostingAggregate,
  input: {
    readonly journalVoucherId: string;
    readonly expectedVersion: number;
    readonly occurredAt: string;
  },
): PurchasePostingAggregate {
  assertObject(posting, "posting");
  assertObject(input, "prepare");

  if (posting.status !== "draft") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.stateInvalid, "status");
  }
  if (posting.version !== input.expectedVersion) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid, "expectedVersion");
  }
  if (posting.version === Number.MAX_SAFE_INTEGER) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid, "version");
  }

  const updatedAt = timestamp(input.occurredAt, "occurredAt");
  if (updatedAt < posting.updatedAt) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.timestampOrderInvalid, "occurredAt");
  }

  return normalize({
    postingId: posting.postingId,
    companyId: posting.companyId,
    branchId: posting.branchId,
    status: "prepared",
    journalVoucherId: identity(input.journalVoucherId, "journalVoucherId"),
    version: posting.version + 1,
    createdAt: posting.createdAt,
    updatedAt,
  });
}


export function reversePurchasePosting(
  posting: PurchasePostingAggregate,
  input: {
    readonly originalJournalVoucherId: string;
    readonly expectedVersion: number;
    readonly occurredAt: string;
  },
): PurchasePostingAggregate {
  assertObject(posting, "posting");
  assertObject(input, "reverse");

  if (posting.status !== "posted") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.stateInvalid, "status");
  }
  if (posting.version !== input.expectedVersion) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid, "expectedVersion");
  }
  if (posting.journalVoucherId !== identity(input.originalJournalVoucherId, "originalJournalVoucherId")) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalJournalMismatch, "originalJournalVoucherId");
  }
  if (posting.version === Number.MAX_SAFE_INTEGER) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid, "version");
  }

  const updatedAt = timestamp(input.occurredAt, "occurredAt");
  if (updatedAt < posting.updatedAt) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.timestampOrderInvalid, "occurredAt");
  }

  return normalize({
    postingId: posting.postingId,
    companyId: posting.companyId,
    branchId: posting.branchId,
    status: "reversed",
    journalVoucherId: posting.journalVoucherId,
    version: posting.version + 1,
    createdAt: posting.createdAt,
    updatedAt,
  });
}
