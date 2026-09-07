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

export const INVENTORY_DOCUMENT_STATUSES = Object.freeze([
  "draft",
  "submitted",
  "approved",
  "confirmed",
  "cancelled",
  "reversed",
] as const);

export type InventoryDocumentStatus = (typeof INVENTORY_DOCUMENT_STATUSES)[number];

/**
 * Frozen Step 5 transition matrix. Approval and confirmation are deliberately distinct:
 * only confirmation is the lifecycle gate that later stock-ledger services may make effective.
 */
export const INVENTORY_DOCUMENT_TRANSITIONS: Readonly<Record<InventoryDocumentStatus, readonly InventoryDocumentStatus[]>> = Object.freeze({
  draft: Object.freeze(["submitted", "cancelled"] as const),
  submitted: Object.freeze(["draft", "approved", "cancelled"] as const),
  approved: Object.freeze(["draft", "confirmed", "cancelled"] as const),
  confirmed: Object.freeze(["reversed"] as const),
  cancelled: Object.freeze([]),
  reversed: Object.freeze([]),
});

export interface InventoryLifecycleTransitionSnapshot {
  readonly fromStatus: InventoryDocumentStatus;
  readonly toStatus: InventoryDocumentStatus;
  readonly occurredAt: string;
  readonly actorUserId: string;
  readonly reason: string | null;
  /** Used only for a confirmed -> reversed link to the separate compensating document. */
  readonly relatedDocumentId: string | null;
}

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

export interface InventoryDocumentSnapshot {
  readonly scope: InventoryDocumentScope | null;
  readonly documentId: string;
  readonly companyId: string;
  readonly documentType: InventoryDocumentType;
  readonly status: InventoryDocumentStatus;
  readonly lifecycleHistory: readonly InventoryLifecycleTransitionSnapshot[];
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

export interface InventoryLifecycleActionInput {
  readonly occurredAt: string;
  readonly actorUserId: string;
  readonly reason?: string | null;
}

export interface ReverseInventoryDocumentInput extends InventoryLifecycleActionInput {
  readonly reversalDocumentId: string;
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
  return value.trim();
}

function optionalText(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return fail(INVENTORY_DOMAIN_ERROR_CODES.inputInvalid, field);
  return value.trim() || null;
}

function requiredReason(value: string | null | undefined, field: string): string {
  const normalized = optionalText(value, field);
  if (normalized === null) return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, field);
  return normalized;
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

function isStatus(value: unknown): value is InventoryDocumentStatus {
  return typeof value === "string" && INVENTORY_DOCUMENT_STATUSES.includes(value as InventoryDocumentStatus);
}

export function canTransitionInventoryDocument(
  fromStatus: InventoryDocumentStatus,
  toStatus: InventoryDocumentStatus,
): boolean {
  return INVENTORY_DOCUMENT_TRANSITIONS[fromStatus].includes(toStatus);
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
  if (operation && operation.productId !== productId) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.operationMismatch, "line.operation.productId");
  }
  return Object.freeze({
    operation,
    lineId: identity(input.lineId, "line.lineId"),
    position: input.position,
    productId,
    description: optionalText(input.description, "line.description"),
    sourceReference: input.sourceReference == null ? null : createInventorySourceReference(input.sourceReference),
  });
}

function normalizeLifecycleHistory(
  rawHistory: readonly InventoryLifecycleTransitionSnapshot[],
  documentId: string,
  expectedStatus: InventoryDocumentStatus,
  createdAt: string,
  updatedAt: string,
): readonly InventoryLifecycleTransitionSnapshot[] {
  if (!Array.isArray(rawHistory)) return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleHistoryInvalid, "lifecycleHistory");
  let current: InventoryDocumentStatus = "draft";
  let previousAt = createdAt;
  const history: InventoryLifecycleTransitionSnapshot[] = [];

  for (const raw of rawHistory) {
    assertObject(raw, "lifecycleHistory");
    if (!isStatus(raw.fromStatus) || !isStatus(raw.toStatus)) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.statusInvalid, "lifecycleHistory.status");
    }
    if (raw.fromStatus !== current || !canTransitionInventoryDocument(raw.fromStatus, raw.toStatus)) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleHistoryInvalid, "lifecycleHistory.transition");
    }
    const occurredAt = timestamp(raw.occurredAt, "lifecycleHistory.occurredAt");
    if (occurredAt < previousAt || occurredAt > updatedAt) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.timestampOrderInvalid, "lifecycleHistory.occurredAt");
    }
    const actorUserId = identity(raw.actorUserId, "lifecycleHistory.actorUserId");
    const reason = optionalText(raw.reason, "lifecycleHistory.reason");
    const relatedDocumentId = raw.relatedDocumentId == null
      ? null
      : identity(raw.relatedDocumentId, "lifecycleHistory.relatedDocumentId");

    if (raw.fromStatus === "approved" && raw.toStatus === "draft" && reason === null) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, "lifecycleHistory.reason");
    }
    if (raw.toStatus === "reversed") {
      if (relatedDocumentId === null || relatedDocumentId === documentId) {
        return fail(INVENTORY_DOMAIN_ERROR_CODES.reversalReferenceInvalid, "lifecycleHistory.relatedDocumentId");
      }
    } else if (relatedDocumentId !== null) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, "lifecycleHistory.relatedDocumentId");
    }

    history.push(Object.freeze({
      fromStatus: raw.fromStatus,
      toStatus: raw.toStatus,
      occurredAt,
      actorUserId,
      reason,
      relatedDocumentId,
    }));
    current = raw.toStatus;
    previousAt = occurredAt;
  }

  if (current !== expectedStatus) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleHistoryInvalid, "status");
  }
  return Object.freeze(history);
}

function normalizeDocument(
  input: CreateInventoryDocumentInput,
  version: number,
  updatedAtInput: string,
  status: InventoryDocumentStatus,
  lifecycleHistory: readonly InventoryLifecycleTransitionSnapshot[],
): InventoryDocumentSnapshot {
  const documentId = identity(input.documentId, "documentId");
  const companyId = identity(input.companyId, "companyId");
  if (!INVENTORY_DOCUMENT_TYPES.includes(input.documentType)) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.documentTypeInvalid, "documentType");
  }
  if (!isStatus(status)) return fail(INVENTORY_DOMAIN_ERROR_CODES.statusInvalid, "status");
  if (!Number.isSafeInteger(version) || version < 1) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.versionInvalid, "version");
  }
  const scope = input.scope == null ? null : createInventoryDocumentScope(input.scope);
  if (scope?.destinationBranchId !== null && scope?.destinationBranchId !== undefined && input.documentType !== "transfer") {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.scopeInvalid, "destinationBranchId");
  }
  const createdAt = timestamp(input.createdAt, "createdAt");
  const updatedAt = timestamp(updatedAtInput, "updatedAt");
  if (updatedAt < createdAt) return fail(INVENTORY_DOMAIN_ERROR_CODES.timestampOrderInvalid, "updatedAt");
  const normalizedHistory = normalizeLifecycleHistory(lifecycleHistory, documentId, status, createdAt, updatedAt);

  const normalizeSource = (source: CreateInventorySourceReferenceInput | null | undefined): InventorySourceReference | null => {
    if (source == null) return null;
    const reference = createInventorySourceReference(source);
    if (reference.companyId !== companyId) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.sourceCompanyMismatch, "sourceReference.companyId");
    }
    if (reference.sourceSystem === "inventory" && reference.documentId === documentId) {
      return fail(INVENTORY_DOMAIN_ERROR_CODES.sourceSelfReference, "sourceReference.documentId");
    }
    return reference;
  };

  const sourceReference = normalizeSource(input.sourceReference);
  const sourceLines = input.lines === undefined ? [] : input.lines;
  if (!Array.isArray(sourceLines)) return fail(INVENTORY_DOMAIN_ERROR_CODES.linesInvalid, "lines");
  const ids = new Set<string>();
  const positions = new Set<number>();
  const lines: InventoryDocumentLineSnapshot[] = [];
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
    status,
    lifecycleHistory: normalizedHistory,
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
  return normalizeDocument(input, 1, input.createdAt, "draft", Object.freeze([]));
}

export function rehydrateInventoryDocument(snapshot: InventoryDocumentSnapshot): InventoryDocumentSnapshot {
  assertObject(snapshot, "document");
  if (!Array.isArray(snapshot.lines)) return fail(INVENTORY_DOMAIN_ERROR_CODES.linesInvalid, "lines");
  return normalizeDocument(snapshot, snapshot.version, snapshot.updatedAt, snapshot.status, snapshot.lifecycleHistory);
}

function transitionInventoryDocument(
  snapshot: InventoryDocumentSnapshot,
  toStatus: InventoryDocumentStatus,
  input: InventoryLifecycleActionInput,
  relatedDocumentId: string | null = null,
  forceReason = false,
): InventoryDocumentSnapshot {
  assertObject(input, "lifecycleAction");
  const document = rehydrateInventoryDocument(snapshot);
  if (!canTransitionInventoryDocument(document.status, toStatus)) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleTransitionInvalid, "status");
  }
  const occurredAt = timestamp(input.occurredAt, "occurredAt");
  if (occurredAt < document.updatedAt) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.timestampOrderInvalid, "occurredAt");
  }
  const actorUserId = identity(input.actorUserId, "actorUserId");
  const reason = forceReason
    ? requiredReason(input.reason, "reason")
    : optionalText(input.reason, "reason");
  const normalizedRelatedDocumentId = relatedDocumentId === null ? null : identity(relatedDocumentId, "relatedDocumentId");
  if (toStatus === "reversed" && (normalizedRelatedDocumentId === null || normalizedRelatedDocumentId === document.documentId)) {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.reversalReferenceInvalid, "relatedDocumentId");
  }

  const history = Object.freeze([
    ...document.lifecycleHistory,
    Object.freeze({
      fromStatus: document.status,
      toStatus,
      occurredAt,
      actorUserId,
      reason,
      relatedDocumentId: normalizedRelatedDocumentId,
    }),
  ]);
  return normalizeDocument(document, document.version + 1, occurredAt, toStatus, history);
}

function assertSubmissionComplete(document: InventoryDocumentSnapshot): void {
  if (
    document.scope === null ||
    document.documentNumber === null ||
    document.lines.length === 0 ||
    document.lines.some(line => line.operation === null)
  ) {
    fail(INVENTORY_DOMAIN_ERROR_CODES.submissionIncomplete, "document");
  }
}

/** Ordinary field/line mutation is Draft-only. Approved data must first invalidate approval by returning to Draft. */
export function assertInventoryDocumentEditable(snapshot: InventoryDocumentSnapshot): InventoryDocumentSnapshot {
  const document = rehydrateInventoryDocument(snapshot);
  if (document.status !== "draft") return fail(INVENTORY_DOMAIN_ERROR_CODES.documentImmutable, "status");
  return document;
}

/** Deletion/tombstone eligibility is separate from cancellation and is restricted to Draft documents. */
export function assertInventoryDocumentDeletable(snapshot: InventoryDocumentSnapshot): InventoryDocumentSnapshot {
  const document = rehydrateInventoryDocument(snapshot);
  if (document.status !== "draft") return fail(INVENTORY_DOMAIN_ERROR_CODES.documentDeleteDenied, "status");
  return document;
}

export function submitInventoryDocument(
  snapshot: InventoryDocumentSnapshot,
  input: InventoryLifecycleActionInput,
): InventoryDocumentSnapshot {
  const document = rehydrateInventoryDocument(snapshot);
  if (document.status !== "draft") return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleTransitionInvalid, "status");
  assertSubmissionComplete(document);
  return transitionInventoryDocument(document, "submitted", input);
}

/** Domain state change only. Shared Phase 8 approval authorization/orchestration belongs to Step 14. */
export function approveInventoryDocument(
  snapshot: InventoryDocumentSnapshot,
  input: InventoryLifecycleActionInput,
): InventoryDocumentSnapshot {
  return transitionInventoryDocument(snapshot, "approved", input);
}

/**
 * This is the sole lifecycle transition that may become stock-effective in later authoritative services.
 * Step 5 itself writes no StockMovement or balance rows.
 */
export function confirmInventoryDocument(
  snapshot: InventoryDocumentSnapshot,
  input: InventoryLifecycleActionInput,
): InventoryDocumentSnapshot {
  return transitionInventoryDocument(snapshot, "confirmed", input);
}

/**
 * Submitted data can be returned for editing. Approved data follows the same explicit transition,
 * which invalidates the current approval before any approval-relevant field/line may be edited.
 */
export function returnInventoryDocumentToDraft(
  snapshot: InventoryDocumentSnapshot,
  input: InventoryLifecycleActionInput,
): InventoryDocumentSnapshot {
  const document = rehydrateInventoryDocument(snapshot);
  if (document.status !== "submitted" && document.status !== "approved") {
    return fail(INVENTORY_DOMAIN_ERROR_CODES.lifecycleTransitionInvalid, "status");
  }
  return transitionInventoryDocument(document, "draft", input, null, document.status === "approved");
}

/** Cancellation is only for unconfirmed documents; confirmed facts require a linked reversal. */
export function cancelInventoryDocument(
  snapshot: InventoryDocumentSnapshot,
  input: InventoryLifecycleActionInput,
): InventoryDocumentSnapshot {
  return transitionInventoryDocument(snapshot, "cancelled", input);
}

/**
 * Marks a confirmed original as reversed and links it to a distinct compensating document identity.
 * Creation/confirmation of inverse StockMovements is owned by later movement/workflow/UoW steps.
 */
export function reverseInventoryDocument(
  snapshot: InventoryDocumentSnapshot,
  input: ReverseInventoryDocumentInput,
): InventoryDocumentSnapshot {
  assertObject(input, "reversal");
  const reversalDocumentId = identity(input.reversalDocumentId, "reversalDocumentId");
  return transitionInventoryDocument(snapshot, "reversed", input, reversalDocumentId, true);
}
