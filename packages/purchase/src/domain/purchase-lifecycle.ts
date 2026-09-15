import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./purchase-domain-errors.ts";
import type { PurchaseDomainErrorCode } from "./purchase-domain-errors.ts";

export const PURCHASE_DOCUMENT_TYPES = Object.freeze([
  "purchase-order",
  "supplier-invoice",
  "purchase-return",
  "purchase-correction",
] as const);

export type PurchaseDocumentType = (typeof PURCHASE_DOCUMENT_TYPES)[number];

export const PURCHASE_DOCUMENT_STATUSES = Object.freeze([
  "draft",
  "submitted",
  "approved",
  "confirmed",
  "cancelled",
  "returned",
  "corrected",
] as const);

export type PurchaseDocumentStatus = (typeof PURCHASE_DOCUMENT_STATUSES)[number];

export const PURCHASE_DOCUMENT_TRANSITIONS: Readonly<Record<PurchaseDocumentStatus, readonly PurchaseDocumentStatus[]>> = Object.freeze({
  draft: Object.freeze(["submitted", "cancelled"] as const),
  submitted: Object.freeze(["draft", "approved", "cancelled"] as const),
  approved: Object.freeze(["draft", "confirmed", "cancelled"] as const),
  confirmed: Object.freeze(["returned", "corrected"] as const),
  cancelled: Object.freeze([]),
  returned: Object.freeze([]),
  corrected: Object.freeze([]),
});

export interface PurchaseLifecycleTransitionSnapshot {
  readonly fromStatus: PurchaseDocumentStatus;
  readonly toStatus: PurchaseDocumentStatus;
  readonly occurredAt: string;
  readonly actorUserId: string;
  readonly reason: string | null;
  readonly relatedDocumentId: string | null;
}

export interface PurchaseLifecycleSnapshot {
  readonly documentId: string;
  readonly documentType: PurchaseDocumentType;
  readonly status: PurchaseDocumentStatus;
  readonly history: readonly PurchaseLifecycleTransitionSnapshot[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePurchaseLifecycleInput {
  readonly documentId: string;
  readonly documentType: PurchaseDocumentType;
  readonly status?: PurchaseDocumentStatus;
  readonly history?: readonly PurchaseLifecycleTransitionSnapshot[];
  readonly version?: number;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

export interface PurchaseLifecycleActionInput {
  readonly occurredAt: string;
  readonly actorUserId: string;
  readonly reason?: string | null;
}

export interface PurchaseLinkedLifecycleActionInput extends PurchaseLifecycleActionInput {
  readonly relatedDocumentId: string;
}

const fail = (code: PurchaseDomainErrorCode, field: string): never => {
  throw new PurchaseDomainError(code, field);
};

const required = (value: string, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) return fail(PURCHASE_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
};

const optional = (value: string | null | undefined, field: string): string | null => {
  if (value == null) return null;
  if (typeof value !== "string") return fail(PURCHASE_DOMAIN_ERROR_CODES.inputInvalid, field);
  return value.trim() || null;
};

const timestamp = (value: string, field: string): string => {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/u.test(value)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return fail(PURCHASE_DOMAIN_ERROR_CODES.timestampInvalid, field);
  return parsed.toISOString();
};

const isStatus = (value: unknown): value is PurchaseDocumentStatus =>
  typeof value === "string" && PURCHASE_DOCUMENT_STATUSES.includes(value as PurchaseDocumentStatus);

export const canTransitionPurchaseDocument = (fromStatus: PurchaseDocumentStatus, toStatus: PurchaseDocumentStatus): boolean =>
  PURCHASE_DOCUMENT_TRANSITIONS[fromStatus].includes(toStatus);

export function createPurchaseLifecycle(input: CreatePurchaseLifecycleInput): PurchaseLifecycleSnapshot {
  const documentId = required(input.documentId, "documentId");
  if (!PURCHASE_DOCUMENT_TYPES.includes(input.documentType)) return fail(PURCHASE_DOMAIN_ERROR_CODES.documentTypeInvalid, "documentType");
  const status = input.status ?? "draft";
  if (!isStatus(status)) return fail(PURCHASE_DOMAIN_ERROR_CODES.statusInvalid, "status");
  const version = input.version ?? 1;
  if (!Number.isSafeInteger(version) || version < 1) return fail(PURCHASE_DOMAIN_ERROR_CODES.versionInvalid, "version");
  const createdAt = timestamp(input.createdAt, "createdAt");
  const updatedAt = timestamp(input.updatedAt ?? input.createdAt, "updatedAt");
  if (updatedAt < createdAt) return fail(PURCHASE_DOMAIN_ERROR_CODES.timestampOrderInvalid, "updatedAt");

  const rawHistory = input.history ?? [];
  if (!Array.isArray(rawHistory)) return fail(PURCHASE_DOMAIN_ERROR_CODES.lifecycleHistoryInvalid, "history");
  let current: PurchaseDocumentStatus = "draft";
  let previousAt = createdAt;
  const history: PurchaseLifecycleTransitionSnapshot[] = [];
  for (const raw of rawHistory) {
    if (!isStatus(raw.fromStatus) || !isStatus(raw.toStatus) || raw.fromStatus !== current || !canTransitionPurchaseDocument(raw.fromStatus, raw.toStatus)) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.lifecycleHistoryInvalid, "history.transition");
    }
    const occurredAt = timestamp(raw.occurredAt, "history.occurredAt");
    if (occurredAt < previousAt || occurredAt > updatedAt) return fail(PURCHASE_DOMAIN_ERROR_CODES.timestampOrderInvalid, "history.occurredAt");
    const reason = optional(raw.reason, "history.reason");
    const relatedDocumentId = raw.relatedDocumentId == null ? null : required(raw.relatedDocumentId, "history.relatedDocumentId");
    if (raw.fromStatus === "approved" && raw.toStatus === "draft" && reason === null) return fail(PURCHASE_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, "history.reason");
    if (raw.toStatus === "returned" || raw.toStatus === "corrected") {
      if (reason === null) return fail(PURCHASE_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, "history.reason");
      if (relatedDocumentId === null || relatedDocumentId === documentId) return fail(PURCHASE_DOMAIN_ERROR_CODES.relatedDocumentInvalid, "history.relatedDocumentId");
    } else if (relatedDocumentId !== null) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, "history.relatedDocumentId");
    }
    history.push(Object.freeze({
      fromStatus: raw.fromStatus,
      toStatus: raw.toStatus,
      occurredAt,
      actorUserId: required(raw.actorUserId, "history.actorUserId"),
      reason,
      relatedDocumentId,
    }));
    current = raw.toStatus;
    previousAt = occurredAt;
  }
  if (current !== status) return fail(PURCHASE_DOMAIN_ERROR_CODES.lifecycleHistoryInvalid, "status");
  if (version !== history.length + 1) return fail(PURCHASE_DOMAIN_ERROR_CODES.versionInvalid, "version");
  return Object.freeze({ documentId, documentType: input.documentType, status, history: Object.freeze(history), version, createdAt, updatedAt });
}

function transition(
  snapshot: PurchaseLifecycleSnapshot,
  toStatus: PurchaseDocumentStatus,
  input: PurchaseLifecycleActionInput,
  relatedDocumentId: string | null = null,
  requireReason = false,
): PurchaseLifecycleSnapshot {
  const current = createPurchaseLifecycle(snapshot);
  if (!canTransitionPurchaseDocument(current.status, toStatus)) return fail(PURCHASE_DOMAIN_ERROR_CODES.lifecycleTransitionInvalid, "status");
  const occurredAt = timestamp(input.occurredAt, "occurredAt");
  if (occurredAt < current.updatedAt) return fail(PURCHASE_DOMAIN_ERROR_CODES.timestampOrderInvalid, "occurredAt");
  const reason = optional(input.reason, "reason");
  if (requireReason && reason === null) return fail(PURCHASE_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid, "reason");
  if (relatedDocumentId !== null && relatedDocumentId === current.documentId) return fail(PURCHASE_DOMAIN_ERROR_CODES.relatedDocumentInvalid, "relatedDocumentId");
  return createPurchaseLifecycle({
    ...current,
    status: toStatus,
    history: [...current.history, {
      fromStatus: current.status,
      toStatus,
      occurredAt,
      actorUserId: required(input.actorUserId, "actorUserId"),
      reason,
      relatedDocumentId,
    }],
    version: current.version + 1,
    updatedAt: occurredAt,
  });
}

export const submitPurchaseLifecycle = (s: PurchaseLifecycleSnapshot, a: PurchaseLifecycleActionInput) => transition(s, "submitted", a);
export const approvePurchaseLifecycle = (s: PurchaseLifecycleSnapshot, a: PurchaseLifecycleActionInput) => transition(s, "approved", a);
export const confirmPurchaseLifecycle = (s: PurchaseLifecycleSnapshot, a: PurchaseLifecycleActionInput) => transition(s, "confirmed", a);
export const cancelPurchaseLifecycle = (s: PurchaseLifecycleSnapshot, a: PurchaseLifecycleActionInput) => transition(s, "cancelled", a);
export const reopenPurchaseLifecycle = (s: PurchaseLifecycleSnapshot, a: PurchaseLifecycleActionInput) => transition(s, "draft", a, null, s.status === "approved");
export const returnPurchaseLifecycle = (s: PurchaseLifecycleSnapshot, a: PurchaseLinkedLifecycleActionInput) => transition(s, "returned", a, required(a.relatedDocumentId, "relatedDocumentId"), true);
export const correctPurchaseLifecycle = (s: PurchaseLifecycleSnapshot, a: PurchaseLinkedLifecycleActionInput) => transition(s, "corrected", a, required(a.relatedDocumentId, "relatedDocumentId"), true);
