import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";
import {
  PURCHASE_POSTING_SOURCE_DOCUMENT_TYPES,
} from "./purchase-posting-facts.ts";
import type {
  PurchasePostingFactSnapshot,
  PurchasePostingSourceDocumentType,
} from "./purchase-posting-facts.ts";

export const PURCHASE_POSTING_SOURCE_SYSTEM = "purchase" as const;

export interface PurchasePostingSourceIdentity {
  readonly companyId: string;
  readonly branchId: string;
  readonly sourceSystem: typeof PURCHASE_POSTING_SOURCE_SYSTEM;
  readonly sourceType: PurchasePostingSourceDocumentType;
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly sourceRevision: number | null;
}

export interface CreatePurchasePostingSourceIdentityInput {
  readonly companyId: string;
  readonly branchId: string;
  readonly sourceSystem?: typeof PURCHASE_POSTING_SOURCE_SYSTEM;
  readonly sourceType: PurchasePostingSourceDocumentType;
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly sourceRevision?: number | null;
}

export interface PurchasePostingSourceLineReference {
  readonly source: PurchasePostingSourceIdentity;
  readonly sourceLineId: string;
}

export interface CreatePurchasePostingSourceLineReferenceInput {
  readonly source: CreatePurchasePostingSourceIdentityInput | PurchasePostingSourceIdentity;
  readonly sourceLineId: string;
}

export interface PurchasePostingTraceContext {
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
}

export interface CreatePurchasePostingTraceContextInput {
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
  readonly causationId?: string | null;
}

export interface PurchasePostingSourceReference {
  readonly source: PurchasePostingSourceIdentity;
  readonly trace: PurchasePostingTraceContext;
}

export interface CreatePurchasePostingSourceReferenceInput {
  readonly source: CreatePurchasePostingSourceIdentityInput | PurchasePostingSourceIdentity;
  readonly trace: CreatePurchasePostingTraceContextInput | PurchasePostingTraceContext;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function assertObject(value: unknown, field: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceIdentityInvalid, field);
  }
}

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  const normalized = value.trim();
  if (normalized.length > 128) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceIdentityInvalid, field);
  }
  return normalized;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid, field);
  }
  return value;
}

function optionalPositiveInteger(value: number | null | undefined, field: string): number | null {
  if (value == null) return null;
  return positiveInteger(value, field);
}

export function createPurchasePostingSourceIdentity(
  input: CreatePurchasePostingSourceIdentityInput,
): PurchasePostingSourceIdentity {
  assertObject(input, "source");
  const sourceSystem = input.sourceSystem ?? PURCHASE_POSTING_SOURCE_SYSTEM;
  if (sourceSystem !== PURCHASE_POSTING_SOURCE_SYSTEM) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceIdentityInvalid, "source.sourceSystem");
  }
  if (!PURCHASE_POSTING_SOURCE_DOCUMENT_TYPES.includes(input.sourceType)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.documentTypeInvalid, "source.sourceType");
  }

  return Object.freeze({
    companyId: required(input.companyId, "source.companyId"),
    branchId: required(input.branchId, "source.branchId"),
    sourceSystem,
    sourceType: input.sourceType,
    sourceId: required(input.sourceId, "source.sourceId"),
    sourceVersion: positiveInteger(input.sourceVersion, "source.sourceVersion"),
    sourceRevision: optionalPositiveInteger(input.sourceRevision, "source.sourceRevision"),
  });
}

export function createPurchasePostingSourceLineReference(
  input: CreatePurchasePostingSourceLineReferenceInput,
): PurchasePostingSourceLineReference {
  assertObject(input, "lineReference");
  return Object.freeze({
    source: createPurchasePostingSourceIdentity(input.source),
    sourceLineId: required(input.sourceLineId, "lineReference.sourceLineId"),
  });
}

export function createPurchasePostingTraceContext(
  input: CreatePurchasePostingTraceContextInput,
): PurchasePostingTraceContext {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.traceContextInvalid, "trace");
  }

  const operationId = required(input.operationId, "trace.operationId");
  const causationId = input.causationId == null
    ? null
    : required(input.causationId, "trace.causationId");

  if (causationId === operationId) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.selfCausation, "trace.causationId");
  }

  return Object.freeze({
    requestId: required(input.requestId, "trace.requestId"),
    operationId,
    correlationId: required(input.correlationId, "trace.correlationId"),
    causationId,
  });
}

export function createPurchasePostingSourceReference(
  input: CreatePurchasePostingSourceReferenceInput,
): PurchasePostingSourceReference {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceIdentityInvalid, "sourceReference");
  }
  return Object.freeze({
    source: createPurchasePostingSourceIdentity(input.source),
    trace: createPurchasePostingTraceContext(input.trace),
  });
}

export function assertPurchasePostingSourceMatchesFact(
  source: PurchasePostingSourceIdentity,
  fact: PurchasePostingFactSnapshot,
): void {
  const normalized = createPurchasePostingSourceIdentity(source);

  if (normalized.companyId !== fact.companyId) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceReferenceMismatch, "source.companyId");
  }
  if (normalized.branchId !== fact.branchId) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceReferenceMismatch, "source.branchId");
  }
  if (normalized.sourceType !== fact.documentType) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceReferenceMismatch, "source.sourceType");
  }
  if (normalized.sourceId !== fact.purchaseDocumentId) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceReferenceMismatch, "source.sourceId");
  }
  if (normalized.sourceVersion !== fact.purchaseDocumentVersion) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceReferenceMismatch, "source.sourceVersion");
  }
}

export function assertPurchasePostingLineReferenceMatchesFact(
  reference: PurchasePostingSourceLineReference,
  fact: PurchasePostingFactSnapshot,
): void {
  const normalized = createPurchasePostingSourceLineReference(reference);
  assertPurchasePostingSourceMatchesFact(normalized.source, fact);

  if (!fact.lines.some(line => line.purchaseLineId === normalized.sourceLineId)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceReferenceMismatch, "lineReference.sourceLineId");
  }
}

export function purchasePostingSourceIdentityKey(
  source: PurchasePostingSourceIdentity,
): string {
  const normalized = createPurchasePostingSourceIdentity(source);
  const revision = normalized.sourceRevision === null ? "-" : String(normalized.sourceRevision);
  return [
    normalized.sourceSystem,
    normalized.companyId,
    normalized.branchId,
    normalized.sourceType,
    normalized.sourceId,
    `v${normalized.sourceVersion}`,
    `r${revision}`,
  ].join(":");
}
