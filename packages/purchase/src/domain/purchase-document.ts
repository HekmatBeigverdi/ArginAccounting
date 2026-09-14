import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./purchase-domain-errors.ts";
import type { PurchaseDomainErrorCode } from "./purchase-domain-errors.ts";

export const PURCHASE_LINE_KINDS = Object.freeze([
  "stock-product",
  "non-stock-product",
  "service",
] as const);

export type PurchaseLineKind = (typeof PURCHASE_LINE_KINDS)[number];
export type PurchaseItemType = "product" | "service";

export interface PurchaseSourceReference {
  readonly sourceSystem: string;
  readonly sourceDocumentId: string;
  readonly sourceLineId: string | null;
}

export interface CreatePurchaseSourceReferenceInput {
  readonly sourceSystem: string;
  readonly sourceDocumentId: string;
  readonly sourceLineId?: string | null;
}

export interface PurchaseCorrectionReference {
  readonly documentId: string;
  readonly reason: string;
}

export interface CreatePurchaseCorrectionReferenceInput {
  readonly documentId: string;
  readonly reason: string;
}

export interface PurchaseDocumentLineSnapshot {
  readonly lineId: string;
  readonly position: number;
  readonly lineKind: PurchaseLineKind;
  readonly itemType: PurchaseItemType;
  readonly itemId: string;
  readonly description: string | null;
  readonly sourceReference: PurchaseSourceReference | null;
}

export interface CreatePurchaseDocumentLineInput {
  readonly lineId: string;
  readonly position: number;
  readonly lineKind: PurchaseLineKind;
  readonly itemId: string;
  readonly itemType?: PurchaseItemType;
  readonly description?: string | null;
  readonly sourceReference?: CreatePurchaseSourceReferenceInput | null;
}

export interface PurchaseDocumentSnapshot {
  readonly documentId: string;
  readonly companyId: string;
  readonly supplierId: string;
  readonly businessDate: string;
  readonly description: string | null;
  readonly sourceReference: PurchaseSourceReference | null;
  readonly correctionReference: PurchaseCorrectionReference | null;
  readonly lines: readonly PurchaseDocumentLineSnapshot[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePurchaseDocumentInput {
  readonly documentId: string;
  readonly companyId: string;
  readonly supplierId: string;
  readonly businessDate: string;
  readonly description?: string | null;
  readonly sourceReference?: CreatePurchaseSourceReferenceInput | null;
  readonly correctionReference?: CreatePurchaseCorrectionReferenceInput | null;
  readonly lines?: readonly CreatePurchaseDocumentLineInput[];
  readonly createdAt: string;
}

const fail = (code: PurchaseDomainErrorCode, field: string): never => {
  throw new PurchaseDomainError(code, field);
};

function assertObject(value: unknown, field: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(PURCHASE_DOMAIN_ERROR_CODES.inputInvalid, field);
  }
}

function identity(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function optionalText(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return fail(PURCHASE_DOMAIN_ERROR_CODES.inputInvalid, field);
  return value.trim() || null;
}

function requiredText(value: string, field: string): string {
  const normalized = optionalText(value, field);
  if (normalized === null) return fail(PURCHASE_DOMAIN_ERROR_CODES.identityRequired, field);
  return normalized;
}

function normalizeBusinessDate(value: string, field: string): string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.businessDateInvalid, field);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.businessDateInvalid, field);
  }
  return value;
}

function normalizeTimestamp(value: string, field: string): string {
  if (
    typeof value !== "string" ||
    !/^(?!0000)\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/u.test(value)
  ) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  return parsed.toISOString();
}

function expectedItemType(lineKind: PurchaseLineKind): PurchaseItemType {
  return lineKind === "service" ? "service" : "product";
}

export function createPurchaseSourceReference(
  input: CreatePurchaseSourceReferenceInput,
): PurchaseSourceReference {
  assertObject(input, "sourceReference");
  return Object.freeze({
    sourceSystem: identity(input.sourceSystem, "sourceReference.sourceSystem"),
    sourceDocumentId: identity(input.sourceDocumentId, "sourceReference.sourceDocumentId"),
    sourceLineId: input.sourceLineId == null
      ? null
      : identity(input.sourceLineId, "sourceReference.sourceLineId"),
  });
}

export function createPurchaseCorrectionReference(
  input: CreatePurchaseCorrectionReferenceInput,
  currentDocumentId: string,
): PurchaseCorrectionReference {
  assertObject(input, "correctionReference");
  const documentId = identity(input.documentId, "correctionReference.documentId");
  if (documentId === currentDocumentId) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.selfReference, "correctionReference.documentId");
  }
  return Object.freeze({
    documentId,
    reason: requiredText(input.reason, "correctionReference.reason"),
  });
}

export function createPurchaseDocumentLine(
  input: CreatePurchaseDocumentLineInput,
): PurchaseDocumentLineSnapshot {
  assertObject(input, "line");
  if (!PURCHASE_LINE_KINDS.includes(input.lineKind)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.lineKindInvalid, "lines.lineKind");
  }
  if (!Number.isSafeInteger(input.position) || input.position < 1) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.linePositionInvalid, "lines.position");
  }

  const inferredItemType = expectedItemType(input.lineKind);
  const itemType = input.itemType ?? inferredItemType;
  if (itemType !== inferredItemType) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.lineClassificationInvalid, "lines.itemType");
  }

  return Object.freeze({
    lineId: identity(input.lineId, "lines.lineId"),
    position: input.position,
    lineKind: input.lineKind,
    itemType,
    itemId: identity(input.itemId, "lines.itemId"),
    description: optionalText(input.description, "lines.description"),
    sourceReference: input.sourceReference == null
      ? null
      : createPurchaseSourceReference(input.sourceReference),
  });
}

function normalizePurchaseDocument(
  input: CreatePurchaseDocumentInput,
  version: number,
  updatedAtInput: string,
): PurchaseDocumentSnapshot {
  assertObject(input, "document");

  const documentId = identity(input.documentId, "documentId");
  const companyId = identity(input.companyId, "companyId");
  const supplierId = identity(input.supplierId, "supplierId");
  const businessDate = normalizeBusinessDate(input.businessDate, "businessDate");
  const createdAt = normalizeTimestamp(input.createdAt, "createdAt");
  const updatedAt = normalizeTimestamp(updatedAtInput, "updatedAt");

  if (updatedAt < createdAt) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.timestampOrderInvalid, "updatedAt");
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.versionInvalid, "version");
  }

  const sourceReference = input.sourceReference == null
    ? null
    : createPurchaseSourceReference(input.sourceReference);
  if (
    sourceReference?.sourceSystem === "purchase" &&
    sourceReference.sourceDocumentId === documentId
  ) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.selfReference, "sourceReference.sourceDocumentId");
  }

  const correctionReference = input.correctionReference == null
    ? null
    : createPurchaseCorrectionReference(input.correctionReference, documentId);

  const rawLines = input.lines ?? [];
  if (!Array.isArray(rawLines)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inputInvalid, "lines");
  }

  const lineIds = new Set<string>();
  const positions = new Set<number>();
  const lines: PurchaseDocumentLineSnapshot[] = [];

  for (const rawLine of rawLines) {
    const line = createPurchaseDocumentLine(rawLine);
    if (lineIds.has(line.lineId)) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.duplicateLineId, "lines.lineId");
    }
    if (positions.has(line.position)) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.duplicateLinePosition, "lines.position");
    }
    lineIds.add(line.lineId);
    positions.add(line.position);
    lines.push(line);
  }

  lines.sort((left, right) => left.position - right.position);

  return Object.freeze({
    documentId,
    companyId,
    supplierId,
    businessDate,
    description: optionalText(input.description, "description"),
    sourceReference,
    correctionReference,
    lines: Object.freeze(lines),
    version,
    createdAt,
    updatedAt,
  });
}

export function createPurchaseDocument(
  input: CreatePurchaseDocumentInput,
): PurchaseDocumentSnapshot {
  return normalizePurchaseDocument(input, 1, input.createdAt);
}

export function rehydratePurchaseDocument(
  snapshot: PurchaseDocumentSnapshot,
): PurchaseDocumentSnapshot {
  assertObject(snapshot, "document");
  return normalizePurchaseDocument(snapshot, snapshot.version, snapshot.updatedAt);
}
