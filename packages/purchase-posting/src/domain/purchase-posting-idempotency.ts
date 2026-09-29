import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";
import {
  createPurchasePostingSourceIdentity,
  purchasePostingSourceIdentityKey,
} from "./purchase-posting-source-reference.ts";
import type {
  PurchasePostingSourceIdentity,
} from "./purchase-posting-source-reference.ts";

export const PURCHASE_POSTING_PURPOSES = Object.freeze([
  "accounting-recognition",
] as const);

export type PurchasePostingPurpose =
  (typeof PURCHASE_POSTING_PURPOSES)[number];

export interface PurchasePostingIdempotencyIdentity {
  readonly source: PurchasePostingSourceIdentity;
  readonly purpose: PurchasePostingPurpose;
  readonly payloadFingerprint: string;
}

export interface PurchasePostingIdempotencyRecord {
  readonly idempotencyKey: string;
  readonly source: PurchasePostingSourceIdentity;
  readonly purpose: PurchasePostingPurpose;
  readonly payloadFingerprint: string;
  readonly postingId: string;
  readonly journalVoucherId: string;
  readonly committedPostingVersion: number;
  readonly committedAt: string;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function fingerprint(value: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.idempotencyInvalid, "payloadFingerprint");
  }
  return value;
}

function purpose(value: PurchasePostingPurpose): PurchasePostingPurpose {
  if (!PURCHASE_POSTING_PURPOSES.includes(value)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.idempotencyInvalid, "purpose");
  }
  return value;
}

export function createPurchasePostingIdempotencyKey(
  source: PurchasePostingSourceIdentity,
  postingPurpose: PurchasePostingPurpose,
): string {
  const normalized = createPurchasePostingSourceIdentity(source);
  const normalizedPurpose = purpose(postingPurpose);
  return `${purchasePostingSourceIdentityKey(normalized)}:purpose:${normalizedPurpose}`;
}

export function createPurchasePostingIdempotencyIdentity(
  input: PurchasePostingIdempotencyIdentity,
): PurchasePostingIdempotencyIdentity {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.idempotencyInvalid, "identity");
  }
  return Object.freeze({
    source: createPurchasePostingSourceIdentity(input.source),
    purpose: purpose(input.purpose),
    payloadFingerprint: fingerprint(input.payloadFingerprint),
  });
}

export function createPurchasePostingIdempotencyRecord(
  input: PurchasePostingIdempotencyRecord,
): PurchasePostingIdempotencyRecord {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid, "record");
  }
  const identity = createPurchasePostingIdempotencyIdentity({
    source: input.source,
    purpose: input.purpose,
    payloadFingerprint: input.payloadFingerprint,
  });
  const expectedKey = createPurchasePostingIdempotencyKey(identity.source, identity.purpose);
  if (input.idempotencyKey !== expectedKey) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid, "idempotencyKey");
  }
  if (
    typeof input.postingId !== "string" || input.postingId.trim().length === 0
    || typeof input.journalVoucherId !== "string" || input.journalVoucherId.trim().length === 0
    || !Number.isSafeInteger(input.committedPostingVersion)
    || input.committedPostingVersion < 1
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid, "outcome");
  }
  const parsed = new Date(input.committedAt);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== input.committedAt) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid, "committedAt");
  }

  return Object.freeze({
    idempotencyKey: expectedKey,
    source: identity.source,
    purpose: identity.purpose,
    payloadFingerprint: identity.payloadFingerprint,
    postingId: input.postingId.trim(),
    journalVoucherId: input.journalVoucherId.trim(),
    committedPostingVersion: input.committedPostingVersion,
    committedAt: input.committedAt,
  });
}

export function assertPurchasePostingReplayCompatible(
  record: PurchasePostingIdempotencyRecord,
  identity: PurchasePostingIdempotencyIdentity,
): void {
  const stored = createPurchasePostingIdempotencyRecord(record);
  const requested = createPurchasePostingIdempotencyIdentity(identity);
  const requestedKey = createPurchasePostingIdempotencyKey(requested.source, requested.purpose);

  if (stored.idempotencyKey !== requestedKey) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.idempotencyConflict, "idempotencyKey");
  }
  if (stored.payloadFingerprint !== requested.payloadFingerprint) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.idempotencyConflict, "payloadFingerprint");
  }
}
