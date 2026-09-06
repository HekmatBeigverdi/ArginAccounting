/** Phase 20 Step 2: structural draft model; no stock or lifecycle operations. */
export const INVENTORY_DOCUMENT_TYPES = Object.freeze([
  "receipt",
  "issue",
  "opening",
  "transfer",
  "adjustment",
] as const);

export type InventoryDocumentType = (typeof INVENTORY_DOCUMENT_TYPES)[number];

export const INVENTORY_DOMAIN_ERROR_CODES = Object.freeze({
  inputInvalid: "inventory.input.invalid",
  identityRequired: "inventory.identity.required",
  documentTypeInvalid: "inventory.document-type.invalid",
  businessDateInvalid: "inventory.business-date.invalid",
  timestampInvalid: "inventory.timestamp.invalid",
  timestampOrderInvalid: "inventory.timestamp-order.invalid",
  versionInvalid: "inventory.version.invalid",
  statusInvalid: "inventory.status.invalid",
  linesInvalid: "inventory.lines.invalid",
  linePositionInvalid: "inventory.line-position.invalid",
  duplicateLineId: "inventory.line-id.duplicate",
  duplicateLinePosition: "inventory.line-position.duplicate",
  sourceCompanyMismatch: "inventory.source.company-mismatch",
  sourceSelfReference: "inventory.source.self-reference",
} as const);

export type InventoryDomainErrorCode =
  (typeof INVENTORY_DOMAIN_ERROR_CODES)[keyof typeof INVENTORY_DOMAIN_ERROR_CODES];

export class InventoryDomainError extends Error {
  readonly code: InventoryDomainErrorCode;
  readonly field: string;

  constructor(code: InventoryDomainErrorCode, field: string) {
    super(code);
    this.name = "InventoryDomainError";
    this.code = code;
    this.field = field;
  }
}

/** Source identities never contain a display number or a database row position. */
export interface InventorySourceReference {
  readonly companyId: string;
  readonly sourceSystem: string;
  readonly documentType: string;
  readonly documentId: string;
  readonly lineId: string | null;
}

export interface CreateInventorySourceReferenceInput {
  readonly companyId: string;
  readonly sourceSystem: string;
  readonly documentType: string;
  readonly documentId: string;
  readonly lineId?: string | null;
}

/** Owned by its document; position is ordering metadata, never line identity. */
export interface InventoryDocumentLineSnapshot {
  readonly lineId: string;
  readonly position: number;
  readonly productId: string;
  readonly description: string | null;
  readonly sourceReference: InventorySourceReference | null;
}

export interface CreateInventoryDocumentLineInput {
  readonly lineId: string;
  readonly position: number;
  readonly productId: string;
  readonly description?: string | null;
  readonly sourceReference?: CreateInventorySourceReferenceInput | null;
}

/**
 * Draft foundation only. Quantity/UoM and physical references arrive in Step 3;
 * fiscal eligibility/number allocation in Step 4; lifecycle in Step 5.
 */
export interface InventoryDocumentSnapshot {
  readonly documentId: string;
  readonly companyId: string;
  readonly documentType: InventoryDocumentType;
  readonly status: "draft";
  readonly documentNumber: string | null;
  readonly businessDate: string;
  readonly description: string | null;
  readonly sourceReference: InventorySourceReference | null;
  readonly lines: readonly InventoryDocumentLineSnapshot[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateInventoryDocumentInput {
  readonly documentId: string;
  readonly companyId: string;
  readonly documentType: InventoryDocumentType;
  readonly documentNumber?: string | null;
  readonly businessDate: string;
  readonly description?: string | null;
  readonly sourceReference?: CreateInventorySourceReferenceInput | null;
  readonly lines?: readonly CreateInventoryDocumentLineInput[];
  readonly createdAt: string;
}

const fail = (code: InventoryDomainErrorCode, field: string): never => {
  throw new InventoryDomainError(code, field);
};

function assertObject(value: unknown, field: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(INVENTORY_DOMAIN_ERROR_CODES.inputInvalid, field);
  }
}

function identity(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  // Preserve opaque IDs: do not uppercase, parse as numbers or collapse spaces.
  return value.trim();
}

function optionalText(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return fail(INVENTORY_DOMAIN_ERROR_CODES.inputInvalid, field);
  return value.trim() || null;
}

function businessDate(value: string, field: string): string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.businessDateInvalid, field);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.businessDateInvalid, field);
  }
  return value;
}

function timestamp(value: string, field: string): string {
  // Explicit UTC input prevents host timezone/DST from changing persisted facts.
  if (typeof value !== "string" ||
      !/^(?!0000)\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/u.test(value)) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  return parsed.toISOString();
}

export function createInventorySourceReference(
  input: CreateInventorySourceReferenceInput,
): InventorySourceReference {
  assertObject(input, "sourceReference");
  return Object.freeze({
    companyId: identity(input.companyId, "sourceReference.companyId"),
    sourceSystem: identity(input.sourceSystem, "sourceReference.sourceSystem"),
    documentType: identity(input.documentType, "sourceReference.documentType"),
    documentId: identity(input.documentId, "sourceReference.documentId"),
    lineId: input.lineId == null ? null : identity(input.lineId, "sourceReference.lineId"),
  });
}

export function createInventoryDocumentLine(
  input: CreateInventoryDocumentLineInput,
): InventoryDocumentLineSnapshot {
  assertObject(input, "line");
  if (!Number.isSafeInteger(input.position) || input.position < 1) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.linePositionInvalid, "line.position");
  }
  return Object.freeze({
    lineId: identity(input.lineId, "line.lineId"),
    position: input.position,
    productId: identity(input.productId, "line.productId"),
    description: optionalText(input.description, "line.description"),
    sourceReference: input.sourceReference == null
      ? null : createInventorySourceReference(input.sourceReference),
  });
}

function normalizeDocument(
  input: CreateInventoryDocumentInput,
  version: number,
  updatedAtInput: string,
): InventoryDocumentSnapshot {
  const documentId = identity(input.documentId, "documentId");
  const companyId = identity(input.companyId, "companyId");
  if (!INVENTORY_DOCUMENT_TYPES.includes(input.documentType)) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.documentTypeInvalid, "documentType");
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.versionInvalid, "version");
  }
  const createdAt = timestamp(input.createdAt, "createdAt");
  const updatedAt = timestamp(updatedAtInput, "updatedAt");
  if (updatedAt < createdAt) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.timestampOrderInvalid, "updatedAt");
  }
  const normalizeSource = (
    source: CreateInventorySourceReferenceInput | null | undefined,
  ): InventorySourceReference | null => {
    if (source == null) return null;
    const reference = createInventorySourceReference(source);
    if (reference.companyId !== companyId) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.sourceCompanyMismatch, "sourceReference.companyId");
    }
    // The reserved sourceSystem "inventory" identifies this bounded context.
    if (reference.sourceSystem === "inventory" && reference.documentId === documentId) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.sourceSelfReference, "sourceReference.documentId");
    }
    return reference;
  };
  const sourceReference = normalizeSource(input.sourceReference);
  const sourceLines = input.lines === undefined ? [] : input.lines;
  if (!Array.isArray(sourceLines)) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.linesInvalid, "lines");
  }
  const ids = new Set<string>();
  const positions = new Set<number>();
  const lines: InventoryDocumentLineSnapshot[] = [];
  // for..of also visits holes, so sparse input cannot bypass validation.
  for (const raw of sourceLines) {
    const line = createInventoryDocumentLine(raw);
    if (ids.has(line.lineId)) return fail(INVENTORY_DOMAIN_ERROR_CODES.duplicateLineId, "line.lineId");
    if (positions.has(line.position)) return fail(INVENTORY_DOMAIN_ERROR_CODES.duplicateLinePosition, "line.position");
    ids.add(line.lineId);
    positions.add(line.position);
    lines.push(Object.freeze({ ...line, sourceReference: normalizeSource(line.sourceReference) }));
  }
  lines.sort((a, b) => a.position - b.position);
  return Object.freeze({
    documentId,
    companyId,
    documentType: input.documentType,
    status: "draft",
    documentNumber: optionalText(input.documentNumber, "documentNumber"),
    businessDate: businessDate(input.businessDate, "businessDate"),
    description: optionalText(input.description, "description"),
    sourceReference,
    lines: Object.freeze(lines),
    version,
    createdAt,
    updatedAt,
  });
}

export function createInventoryDocument(input: CreateInventoryDocumentInput): InventoryDocumentSnapshot {
  assertObject(input, "document");
  return normalizeDocument(input, 1, input.createdAt);
}

/** Revalidates persisted draft structure; never authorizes a stock mutation. */
export function rehydrateInventoryDocument(snapshot: InventoryDocumentSnapshot): InventoryDocumentSnapshot {
  assertObject(snapshot, "document");
  if (snapshot.status !== "draft") return fail(INVENTORY_DOMAIN_ERROR_CODES.statusInvalid, "status");
  if (!Array.isArray(snapshot.lines)) return fail(INVENTORY_DOMAIN_ERROR_CODES.linesInvalid, "lines");
  return normalizeDocument(snapshot, snapshot.version, snapshot.updatedAt);
}
