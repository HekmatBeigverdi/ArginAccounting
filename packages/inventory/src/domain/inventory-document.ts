import { createInventoryDocumentScope } from "./inventory-scope.ts";
import type { InventoryDocumentScope, CreateInventoryDocumentScopeInput } from "./inventory-scope.ts";
import { INVENTORY_DOMAIN_ERROR_CODES, InventoryDomainError } from "./inventory-errors.ts";
import type { InventoryDomainErrorCode } from "./inventory-errors.ts";
import { rehydrateInventoryLineOperation } from "./inventory-operation.ts";
import type { InventoryLineOperationSnapshot } from "./inventory-operation.ts";
export { INVENTORY_DOMAIN_ERROR_CODES, InventoryDomainError } from "./inventory-errors.ts";
export type { InventoryDomainErrorCode } from "./inventory-errors.ts";

export const INVENTORY_DOCUMENT_TYPES = Object.freeze([
  "receipt",
  "issue",
  "opening",
  "transfer",
  "adjustment",
] as const);

export type InventoryDocumentType = (typeof INVENTORY_DOCUMENT_TYPES)[number];

/** Step 5 lifecycle is intentionally independent from future stock-posting state. */
export const INVENTORY_DOCUMENT_STATUSES = Object.freeze([
  "draft",
  "approved",
  "cancelled",
] as const);

export type InventoryDocumentStatus = (typeof INVENTORY_DOCUMENT_STATUSES)[number];

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
  readonly operation: InventoryLineOperationSnapshot | null;
  readonly lineId: string;
  readonly position: number;
  readonly productId: string;
  readonly description: string | null;
  readonly sourceReference: InventorySourceReference | null;
}

export interface CreateInventoryDocumentLineInput {
  readonly operation?: InventoryLineOperationSnapshot | null;
  readonly lineId: string;
  readonly position: number;
  readonly productId: string;
  readonly description?: string | null;
  readonly sourceReference?: CreateInventorySourceReferenceInput | null;
}

/**
 * Persisted lifecycle metadata is part of the document snapshot so approvals remain
 * deterministic offline and across Argin Bridge synchronization boundaries.
 */
export interface InventoryDocumentLifecycleSnapshot {
  readonly status: InventoryDocumentStatus;
  readonly approvedAt: string | null;
  readonly approvedByUserId: string | null;
  readonly cancelledAt: string | null;
  readonly cancelledByUserId: string | null;
  /** Durable identity of the approved document this draft corrects; never a display number. */
  readonly correctionOfDocumentId: string | null;
}

/**
 * Structural model with validated quantity/UoM, physical references and fiscal scope.
 * Lifecycle is modeled here; stock mutation/posting remains outside Step 5.
 */
export interface InventoryDocumentSnapshot extends InventoryDocumentLifecycleSnapshot {
  readonly scope: InventoryDocumentScope | null;
  readonly documentId: string;
  readonly companyId: string;
  readonly documentType: InventoryDocumentType;
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
  readonly scope?: CreateInventoryDocumentScopeInput | null;
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

export type CreateInventoryDocumentCorrectionInput = Omit<
  CreateInventoryDocumentInput,
  "companyId" | "documentType"
>;

export interface ApproveInventoryDocumentInput {
  readonly approvedAt: string;
  readonly approvedByUserId: string;
}

export interface CancelInventoryDocumentInput {
  readonly cancelledAt: string;
  readonly cancelledByUserId: string;
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
  const operation = input.operation == null ? null : rehydrateInventoryLineOperation(input.operation);
  const productId = identity(input.productId, "line.productId");
  if (operation && operation.productId !== productId) return fail(INVENTORY_DOMAIN_ERROR_CODES.operationMismatch, "line.operation.productId");
  return Object.freeze({
    operation,
    lineId: identity(input.lineId, "line.lineId"),
    position: input.position,
    productId,
    description: optionalText(input.description, "line.description"),
    sourceReference: input.sourceReference == null
      ? null : createInventorySourceReference(input.sourceReference),
  });
}

const newDraftLifecycle = (correctionOfDocumentId: string | null = null): InventoryDocumentLifecycleSnapshot => Object.freeze({
  status: "draft",
  approvedAt: null,
  approvedByUserId: null,
  cancelledAt: null,
  cancelledByUserId: null,
  correctionOfDocumentId,
});

function normalizeLifecycle(
  lifecycle: InventoryDocumentLifecycleSnapshot,
  documentId: string,
  createdAt: string,
  updatedAt: string,
): InventoryDocumentLifecycleSnapshot {
  if (!INVENTORY_DOCUMENT_STATUSES.includes(lifecycle.status)) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.statusInvalid, "status");
  }
  const correctionOfDocumentId = lifecycle.correctionOfDocumentId == null
    ? null
    : identity(lifecycle.correctionOfDocumentId, "correctionOfDocumentId");
  if (correctionOfDocumentId === documentId) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.correctionSelfReference, "correctionOfDocumentId");
  }

  const approvalIsEmpty = lifecycle.approvedAt == null && lifecycle.approvedByUserId == null;
  const cancellationIsEmpty = lifecycle.cancelledAt == null && lifecycle.cancelledByUserId == null;
  if (lifecycle.status === "draft") {
    if (!approvalIsEmpty || !cancellationIsEmpty) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, "status");
    }
    return newDraftLifecycle(correctionOfDocumentId);
  }

  if (lifecycle.approvedAt == null || lifecycle.approvedByUserId == null) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, "approvedAt");
  }
  const approvedAt = timestamp(lifecycle.approvedAt, "approvedAt");
  const approvedByUserId = identity(lifecycle.approvedByUserId, "approvedByUserId");
  if (approvedAt < createdAt || approvedAt > updatedAt) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.timestampOrderInvalid, "approvedAt");
  }

  if (lifecycle.status === "approved") {
    if (!cancellationIsEmpty) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, "cancelledAt");
    }
    return Object.freeze({
      status: "approved",
      approvedAt,
      approvedByUserId,
      cancelledAt: null,
      cancelledByUserId: null,
      correctionOfDocumentId,
    });
  }

  if (lifecycle.cancelledAt == null || lifecycle.cancelledByUserId == null) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, "cancelledAt");
  }
  const cancelledAt = timestamp(lifecycle.cancelledAt, "cancelledAt");
  const cancelledByUserId = identity(lifecycle.cancelledByUserId, "cancelledByUserId");
  if (cancelledAt < approvedAt || cancelledAt > updatedAt) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.timestampOrderInvalid, "cancelledAt");
  }
  return Object.freeze({
    status: "cancelled",
    approvedAt,
    approvedByUserId,
    cancelledAt,
    cancelledByUserId,
    correctionOfDocumentId,
  });
}

function normalizeDocument(
  input: CreateInventoryDocumentInput,
  version: number,
  updatedAtInput: string,
  lifecycle: InventoryDocumentLifecycleSnapshot,
): InventoryDocumentSnapshot {
  const documentId = identity(input.documentId, "documentId");
  const companyId = identity(input.companyId, "companyId");
  if (!INVENTORY_DOCUMENT_TYPES.includes(input.documentType)) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.documentTypeInvalid, "documentType");
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.versionInvalid, "version");
  }
  const scope = input.scope == null ? null : createInventoryDocumentScope(input.scope);
  if (scope?.destinationBranchId !== null && scope?.destinationBranchId !== undefined && input.documentType !== "transfer") {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.scopeInvalid, "destinationBranchId");
  }
  const createdAt = timestamp(input.createdAt, "createdAt");
  const updatedAt = timestamp(updatedAtInput, "updatedAt");
  if (updatedAt < createdAt) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.timestampOrderInvalid, "updatedAt");
  }
  const normalizedLifecycle = normalizeLifecycle(lifecycle, documentId, createdAt, updatedAt);
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
    if (line.operation) {
      const operation = line.operation;
      if (operation.companyId !== companyId || operation.productId !== line.productId ||
          (input.documentType !== "adjustment" && operation.quantity.enteredQuantity.startsWith("-")) ||
          (input.documentType === "transfer") !== (operation.destination !== null)) {
        return fail(INVENTORY_DOMAIN_ERROR_CODES.operationMismatch, "line.operation");
      }
    }
    ids.add(line.lineId);
    positions.add(line.position);
    lines.push(Object.freeze({ ...line, sourceReference: normalizeSource(line.sourceReference) }));
  }
  lines.sort((a, b) => a.position - b.position);
  return Object.freeze({
    scope,
    documentId,
    companyId,
    documentType: input.documentType,
    ...normalizedLifecycle,
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
  return normalizeDocument(input, 1, input.createdAt, newDraftLifecycle());
}

/** Revalidates persisted structure and lifecycle metadata; never authorizes a stock mutation. */
export function rehydrateInventoryDocument(snapshot: InventoryDocumentSnapshot): InventoryDocumentSnapshot {
  assertObject(snapshot, "document");
  if (!Array.isArray(snapshot.lines)) return fail(INVENTORY_DOMAIN_ERROR_CODES.linesInvalid, "lines");
  return normalizeDocument(snapshot, snapshot.version, snapshot.updatedAt, {
    status: snapshot.status,
    approvedAt: snapshot.approvedAt,
    approvedByUserId: snapshot.approvedByUserId,
    cancelledAt: snapshot.cancelledAt,
    cancelledByUserId: snapshot.cancelledByUserId,
    correctionOfDocumentId: snapshot.correctionOfDocumentId,
  });
}

/** All destructive edits are restricted to drafts. Call before any future draft mutation command. */
export function assertInventoryDocumentEditable(snapshot: InventoryDocumentSnapshot): InventoryDocumentSnapshot {
  const document = rehydrateInventoryDocument(snapshot);
  if (document.status !== "draft") {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.documentImmutable, "status");
  }
  return document;
}

/**
 * Approves a complete draft. Scope eligibility and permissions are application concerns;
 * this domain transition only enforces lifecycle completeness and immutable evidence.
 */
export function approveInventoryDocument(
  snapshot: InventoryDocumentSnapshot,
  input: ApproveInventoryDocumentInput,
): InventoryDocumentSnapshot {
  assertObject(input, "approval");
  const document = rehydrateInventoryDocument(snapshot);
  if (document.status !== "draft") {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleTransitionInvalid, "status");
  }
  if (
    document.scope === null ||
    document.documentNumber === null ||
    document.lines.length === 0 ||
    document.lines.some(line => line.operation === null)
  ) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.approvalIncomplete, "document");
  }
  const approvedAt = timestamp(input.approvedAt, "approvedAt");
  const approvedByUserId = identity(input.approvedByUserId, "approvedByUserId");
  return normalizeDocument(document, document.version + 1, approvedAt, {
    status: "approved",
    approvedAt,
    approvedByUserId,
    cancelledAt: null,
    cancelledByUserId: null,
    correctionOfDocumentId: document.correctionOfDocumentId,
  });
}

/** Cancellation is a lifecycle fact; future posting/reversal logic consumes it separately. */
export function cancelInventoryDocument(
  snapshot: InventoryDocumentSnapshot,
  input: CancelInventoryDocumentInput,
): InventoryDocumentSnapshot {
  assertObject(input, "cancellation");
  const document = rehydrateInventoryDocument(snapshot);
  if (document.status !== "approved") {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleTransitionInvalid, "status");
  }
  const cancelledAt = timestamp(input.cancelledAt, "cancelledAt");
  const cancelledByUserId = identity(input.cancelledByUserId, "cancelledByUserId");
  return normalizeDocument(document, document.version + 1, cancelledAt, {
    status: "cancelled",
    approvedAt: document.approvedAt,
    approvedByUserId: document.approvedByUserId,
    cancelledAt,
    cancelledByUserId,
    correctionOfDocumentId: document.correctionOfDocumentId,
  });
}

/**
 * Never rewrites an approved source document. A correction is a new durable draft that
 * points to the approved original by ID; later stock/posting steps decide its financial effect.
 */
export function createInventoryDocumentCorrection(
  originalSnapshot: InventoryDocumentSnapshot,
  input: CreateInventoryDocumentCorrectionInput,
): InventoryDocumentSnapshot {
  assertObject(input, "correction");
  const original = rehydrateInventoryDocument(originalSnapshot);
  if (original.status !== "approved") {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.correctionOriginalInvalid, "status");
  }
  const correctionId = identity(input.documentId, "documentId");
  if (correctionId === original.documentId) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.correctionSelfReference, "documentId");
  }
  return normalizeDocument({
    ...input,
    documentId: correctionId,
    companyId: original.companyId,
    documentType: original.documentType,
  }, 1, input.createdAt, newDraftLifecycle(original.documentId));
}
