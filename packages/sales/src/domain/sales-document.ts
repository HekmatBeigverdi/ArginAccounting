import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import type { SalesDomainErrorCode } from "./sales-domain-errors.ts";

export const SALES_DOCUMENT_TYPES = Object.freeze([
  "sales-order",
  "sales-invoice",
  "sales-return",
  "sales-correction",
] as const);
export type SalesDocumentType = (typeof SALES_DOCUMENT_TYPES)[number];

export const SALES_LINE_KINDS = Object.freeze([
  "stock-product",
  "non-stock-product",
  "service",
] as const);
export type SalesLineKind = (typeof SALES_LINE_KINDS)[number];
export type SalesItemType = "product" | "service";

export interface SalesDocumentScope {
  readonly companyId: string;
  readonly branchId: string;
  readonly fiscalYearId: string;
}

export interface SalesCustomerReference {
  readonly partyId: string;
}

export interface SalesItemReference {
  readonly productId: string;
  readonly itemType: SalesItemType;
}

export interface SalesSourceReference {
  readonly sourceSystem: string;
  readonly sourceDocumentId: string;
  readonly sourceLineId: string | null;
}

export interface CreateSalesSourceReferenceInput {
  readonly sourceSystem: string;
  readonly sourceDocumentId: string;
  readonly sourceLineId?: string | null;
}

export interface SalesRelatedDocumentReference {
  readonly documentId: string;
  readonly lineId: string | null;
  readonly relationType: string;
}

export interface CreateSalesRelatedDocumentReferenceInput {
  readonly documentId: string;
  readonly lineId?: string | null;
  readonly relationType: string;
}

export interface SalesDocumentLineSnapshot {
  readonly lineId: string;
  readonly position: number;
  readonly lineKind: SalesLineKind;
  readonly item: SalesItemReference;
  readonly description: string | null;
  readonly sourceReference: SalesSourceReference | null;
}

export interface CreateSalesDocumentLineInput {
  readonly lineId: string;
  readonly position: number;
  readonly lineKind: SalesLineKind;
  readonly productId: string;
  readonly itemType?: SalesItemType;
  readonly description?: string | null;
  readonly sourceReference?: CreateSalesSourceReferenceInput | null;
}

export interface SalesDocumentSnapshot {
  readonly documentId: string;
  readonly documentType: SalesDocumentType;
  readonly scope: SalesDocumentScope;
  readonly customer: SalesCustomerReference;
  readonly documentNumber: string | null;
  readonly businessDate: string;
  readonly description: string | null;
  readonly sourceReference: SalesSourceReference | null;
  readonly relatedDocumentReference: SalesRelatedDocumentReference | null;
  readonly lines: readonly SalesDocumentLineSnapshot[];
}

export interface CreateSalesDocumentInput {
  readonly documentId: string;
  readonly documentType: SalesDocumentType;
  readonly companyId: string;
  readonly branchId: string;
  readonly fiscalYearId: string;
  readonly customerPartyId: string;
  readonly documentNumber?: string | null;
  readonly businessDate: string;
  readonly description?: string | null;
  readonly sourceReference?: CreateSalesSourceReferenceInput | null;
  readonly relatedDocumentReference?: CreateSalesRelatedDocumentReferenceInput | null;
  readonly lines?: readonly CreateSalesDocumentLineInput[];
}

const fail = (code: SalesDomainErrorCode, field: string): never => {
  throw new SalesDomainError(code, field);
};
function assertObject(value: unknown, field: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, field);
}
function identity(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}
function optionalText(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, field);
  return value.trim() || null;
}
function businessDate(value: string): string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/u.test(value)) return fail(SALES_DOMAIN_ERROR_CODES.businessDateInvalid, "businessDate");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return fail(SALES_DOMAIN_ERROR_CODES.businessDateInvalid, "businessDate");
  return value;
}
function expectedItemType(kind: SalesLineKind): SalesItemType {
  return kind === "service" ? "service" : "product";
}

export function createSalesSourceReference(input: CreateSalesSourceReferenceInput): SalesSourceReference {
  assertObject(input, "sourceReference");
  return Object.freeze({
    sourceSystem: identity(input.sourceSystem, "sourceReference.sourceSystem"),
    sourceDocumentId: identity(input.sourceDocumentId, "sourceReference.sourceDocumentId"),
    sourceLineId: input.sourceLineId == null ? null : identity(input.sourceLineId, "sourceReference.sourceLineId"),
  });
}

export function createSalesRelatedDocumentReference(
  input: CreateSalesRelatedDocumentReferenceInput,
  currentDocumentId: string,
): SalesRelatedDocumentReference {
  assertObject(input, "relatedDocumentReference");
  const documentId = identity(input.documentId, "relatedDocumentReference.documentId");
  if (documentId === currentDocumentId) return fail(SALES_DOMAIN_ERROR_CODES.selfReference, "relatedDocumentReference.documentId");
  return Object.freeze({
    documentId,
    lineId: input.lineId == null ? null : identity(input.lineId, "relatedDocumentReference.lineId"),
    relationType: identity(input.relationType, "relatedDocumentReference.relationType"),
  });
}

export function createSalesDocumentLine(input: CreateSalesDocumentLineInput): SalesDocumentLineSnapshot {
  assertObject(input, "line");
  if (!SALES_LINE_KINDS.includes(input.lineKind)) return fail(SALES_DOMAIN_ERROR_CODES.lineKindInvalid, "lines.lineKind");
  if (!Number.isSafeInteger(input.position) || input.position < 1) return fail(SALES_DOMAIN_ERROR_CODES.linePositionInvalid, "lines.position");
  const expected = expectedItemType(input.lineKind);
  const itemType = input.itemType ?? expected;
  if (itemType !== expected) return fail(SALES_DOMAIN_ERROR_CODES.lineClassificationInvalid, "lines.itemType");
  return Object.freeze({
    lineId: identity(input.lineId, "lines.lineId"),
    position: input.position,
    lineKind: input.lineKind,
    item: Object.freeze({
      productId: identity(input.productId, "lines.productId"),
      itemType,
    }),
    description: optionalText(input.description, "lines.description"),
    sourceReference: input.sourceReference == null ? null : createSalesSourceReference(input.sourceReference),
  });
}

export function createSalesDocument(input: CreateSalesDocumentInput): SalesDocumentSnapshot {
  assertObject(input, "document");
  if (!SALES_DOCUMENT_TYPES.includes(input.documentType)) return fail(SALES_DOMAIN_ERROR_CODES.documentTypeInvalid, "documentType");
  const documentId = identity(input.documentId, "documentId");
  const companyId = identity(input.companyId, "companyId");
  const scope = Object.freeze({
    companyId,
    branchId: identity(input.branchId, "branchId"),
    fiscalYearId: identity(input.fiscalYearId, "fiscalYearId"),
  });
  const sourceReference = input.sourceReference == null ? null : createSalesSourceReference(input.sourceReference);
  if (sourceReference?.sourceSystem === "sales" && sourceReference.sourceDocumentId === documentId) {
    return fail(SALES_DOMAIN_ERROR_CODES.selfReference, "sourceReference.sourceDocumentId");
  }
  const relatedDocumentReference = input.relatedDocumentReference == null
    ? null
    : createSalesRelatedDocumentReference(input.relatedDocumentReference, documentId);
  const rawLines = input.lines ?? [];
  if (!Array.isArray(rawLines)) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "lines");
  const ids = new Set<string>();
  const positions = new Set<number>();
  const lines: SalesDocumentLineSnapshot[] = [];
  for (const raw of rawLines) {
    const line = createSalesDocumentLine(raw);
    if (ids.has(line.lineId)) return fail(SALES_DOMAIN_ERROR_CODES.duplicateLineId, "lines.lineId");
    if (positions.has(line.position)) return fail(SALES_DOMAIN_ERROR_CODES.duplicateLinePosition, "lines.position");
    ids.add(line.lineId);
    positions.add(line.position);
    lines.push(line);
  }
  lines.sort((a, b) => a.position - b.position);
  return Object.freeze({
    documentId,
    documentType: input.documentType,
    scope,
    customer: Object.freeze({ partyId: identity(input.customerPartyId, "customerPartyId") }),
    documentNumber: optionalText(input.documentNumber, "documentNumber"),
    businessDate: businessDate(input.businessDate),
    description: optionalText(input.description, "description"),
    sourceReference,
    relatedDocumentReference,
    lines: Object.freeze(lines),
  });
}
