import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import {
  createSalesPostingSourceIdentity,
  salesPostingSourceIdentityKey,
} from "./sales-posting-source.ts";
import type { SalesPostingSourceIdentity } from "./sales-posting-source.ts";

export const SALES_POSTING_PURPOSES = Object.freeze([
  "accounting-recognition",
] as const);

export type SalesPostingPurpose =
  (typeof SALES_POSTING_PURPOSES)[number];

export interface SalesPostingIdempotencyIdentity {
  readonly source: SalesPostingSourceIdentity;
  readonly purpose: SalesPostingPurpose;
  readonly payloadFingerprint: string;
}

export interface SalesPostingIdempotencyRecord {
  readonly idempotencyKey: string;
  readonly source: SalesPostingSourceIdentity;
  readonly purpose: SalesPostingPurpose;
  readonly payloadFingerprint: string;
  readonly postingId: string;
  readonly journalVoucherId: string;
  readonly committedPostingVersion: number;
  readonly committedAtUtc: string;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function fingerprint(value: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.idempotencyInvalid,
      "payloadFingerprint",
    );
  }
  return value;
}

function purpose(value: SalesPostingPurpose): SalesPostingPurpose {
  if (!SALES_POSTING_PURPOSES.includes(value)) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.idempotencyInvalid,
      "purpose",
    );
  }
  return value;
}

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid,
      field,
    );
  }
  return value.trim();
}

function positiveVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid,
      "committedPostingVersion",
    );
  }
  return value;
}

function utcTimestamp(value: string): string {
  if (typeof value !== "string") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid,
      "committedAtUtc",
    );
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid,
      "committedAtUtc",
    );
  }
  return value;
}

export function createSalesPostingIdempotencyKey(
  source: SalesPostingSourceIdentity,
  postingPurpose: SalesPostingPurpose,
): string {
  const normalized = createSalesPostingSourceIdentity(source);
  return `${salesPostingSourceIdentityKey(normalized)}:purpose:${purpose(postingPurpose)}`;
}

export function createSalesPostingIdempotencyIdentity(
  input: SalesPostingIdempotencyIdentity,
): SalesPostingIdempotencyIdentity {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.idempotencyInvalid,
      "identity",
    );
  }

  return Object.freeze({
    source: createSalesPostingSourceIdentity(input.source),
    purpose: purpose(input.purpose),
    payloadFingerprint: fingerprint(input.payloadFingerprint),
  });
}

export function createSalesPostingIdempotencyRecord(
  input: SalesPostingIdempotencyRecord,
): SalesPostingIdempotencyRecord {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid,
      "record",
    );
  }

  const identity = createSalesPostingIdempotencyIdentity({
    source: input.source,
    purpose: input.purpose,
    payloadFingerprint: input.payloadFingerprint,
  });
  const expectedKey = createSalesPostingIdempotencyKey(
    identity.source,
    identity.purpose,
  );

  if (input.idempotencyKey !== expectedKey) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid,
      "idempotencyKey",
    );
  }

  return Object.freeze({
    idempotencyKey: expectedKey,
    source: identity.source,
    purpose: identity.purpose,
    payloadFingerprint: identity.payloadFingerprint,
    postingId: required(input.postingId, "postingId"),
    journalVoucherId: required(
      input.journalVoucherId,
      "journalVoucherId",
    ),
    committedPostingVersion: positiveVersion(
      input.committedPostingVersion,
    ),
    committedAtUtc: utcTimestamp(input.committedAtUtc),
  });
}

export function assertSalesPostingReplayCompatible(
  record: SalesPostingIdempotencyRecord,
  identity: SalesPostingIdempotencyIdentity,
): void {
  const stored = createSalesPostingIdempotencyRecord(record);
  const requested = createSalesPostingIdempotencyIdentity(identity);
  const requestedKey = createSalesPostingIdempotencyKey(
    requested.source,
    requested.purpose,
  );

  if (stored.idempotencyKey !== requestedKey) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.idempotencyConflict,
      "idempotencyKey",
    );
  }
  if (stored.payloadFingerprint !== requested.payloadFingerprint) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.idempotencyConflict,
      "payloadFingerprint",
    );
  }
}
