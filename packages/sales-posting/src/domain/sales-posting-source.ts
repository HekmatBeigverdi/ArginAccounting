import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";

export const SALES_POSTING_SOURCE_SYSTEM = "sales" as const;

export const SALES_POSTING_SOURCE_TYPES = Object.freeze([
  "sales-invoice",
  "sales-return",
  "sales-correction",
] as const);

export type SalesPostingSourceType = (typeof SALES_POSTING_SOURCE_TYPES)[number];

export interface SalesPostingSourceIdentity {
  readonly sourceSystem: typeof SALES_POSTING_SOURCE_SYSTEM;
  readonly sourceType: SalesPostingSourceType;
  readonly sourceDocumentId: string;
  readonly sourceVersion: number;
  readonly externalReference: string | null;
}

export interface CreateSalesPostingSourceIdentityInput {
  readonly sourceSystem?: typeof SALES_POSTING_SOURCE_SYSTEM;
  readonly sourceType: SalesPostingSourceType;
  readonly sourceDocumentId: string;
  readonly sourceVersion: number;
  readonly externalReference?: string | null;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function requiredIdentity(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  const normalized = value.trim();
  if (normalized.length > 128) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.identityInvalid, field);
  }
  return normalized;
}

function optionalIdentity(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  return requiredIdentity(value, field);
}

function positiveVersion(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.versionInvalid, field);
  }
  return value;
}

export function createSalesPostingSourceIdentity(
  input: CreateSalesPostingSourceIdentityInput,
): SalesPostingSourceIdentity {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, "source");
  }

  const sourceSystem = input.sourceSystem ?? SALES_POSTING_SOURCE_SYSTEM;
  if (sourceSystem !== SALES_POSTING_SOURCE_SYSTEM) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, "source.sourceSystem");
  }
  if (!SALES_POSTING_SOURCE_TYPES.includes(input.sourceType)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceTypeInvalid, "source.sourceType");
  }

  return Object.freeze({
    sourceSystem,
    sourceType: input.sourceType,
    sourceDocumentId: requiredIdentity(input.sourceDocumentId, "source.sourceDocumentId"),
    sourceVersion: positiveVersion(input.sourceVersion, "source.sourceVersion"),
    externalReference: optionalIdentity(input.externalReference, "source.externalReference"),
  });
}

export function salesPostingSourceIdentityKey(source: SalesPostingSourceIdentity): string {
  const normalized = createSalesPostingSourceIdentity(source);
  const component = (value: string): string => encodeURIComponent(value);
  return [
    normalized.sourceSystem,
    normalized.sourceType,
    component(normalized.sourceDocumentId),
    `v${normalized.sourceVersion}`,
  ].join(":");
}
