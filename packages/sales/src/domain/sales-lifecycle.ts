import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import type { SalesDocumentType } from "./sales-document.ts";

export const SALES_DOCUMENT_STATUSES = Object.freeze([
  "draft", "submitted", "approved", "finalized", "cancelled",
] as const);
export type SalesDocumentStatus = (typeof SALES_DOCUMENT_STATUSES)[number];

export type SalesLifecycleAction = "submit" | "approve" | "reject" | "finalize" | "cancel";

export interface SalesLifecycleTransition {
  readonly transitionId: string;
  readonly documentId: string;
  readonly documentType: SalesDocumentType;
  readonly fromStatus: SalesDocumentStatus;
  readonly toStatus: SalesDocumentStatus;
  readonly action: SalesLifecycleAction;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly reason: string | null;
}

export interface SalesLifecycleState {
  readonly documentId: string;
  readonly documentType: SalesDocumentType;
  readonly status: SalesDocumentStatus;
  readonly transitions: readonly SalesLifecycleTransition[];
}

export interface TransitionSalesLifecycleInput {
  readonly transitionId: string;
  readonly action: SalesLifecycleAction;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly reason?: string | null;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}
function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}
function timestamp(value: string): string {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) {
    return fail(SALES_DOMAIN_ERROR_CODES.lifecycleTimestampInvalid, "lifecycle.occurredAt");
  }
  return value;
}
function reason(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "lifecycle.reason");
  return value.trim() || null;
}

const transitions: Readonly<Record<SalesDocumentStatus, Partial<Record<SalesLifecycleAction, SalesDocumentStatus>>>> = Object.freeze({
  draft: Object.freeze({ submit: "submitted", cancel: "cancelled" }),
  submitted: Object.freeze({ approve: "approved", reject: "draft", cancel: "cancelled" }),
  approved: Object.freeze({ finalize: "finalized", reject: "draft", cancel: "cancelled" }),
  finalized: Object.freeze({}),
  cancelled: Object.freeze({}),
});

export function createSalesLifecycle(documentId: string, documentType: SalesDocumentType): SalesLifecycleState {
  return Object.freeze({
    documentId: required(documentId, "lifecycle.documentId"),
    documentType,
    status: "draft",
    transitions: Object.freeze([]),
  });
}

export function transitionSalesLifecycle(
  state: SalesLifecycleState,
  input: TransitionSalesLifecycleInput,
): SalesLifecycleState {
  if (typeof state !== "object" || state === null || typeof input !== "object" || input === null) {
    return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "lifecycle");
  }
  const toStatus = transitions[state.status]?.[input.action];
  if (!toStatus) return fail(SALES_DOMAIN_ERROR_CODES.lifecycleTransitionInvalid, "lifecycle.action");

  const transition: SalesLifecycleTransition = Object.freeze({
    transitionId: required(input.transitionId, "lifecycle.transitionId"),
    documentId: required(state.documentId, "lifecycle.documentId"),
    documentType: state.documentType,
    fromStatus: state.status,
    toStatus,
    action: input.action,
    actorId: required(input.actorId, "lifecycle.actorId"),
    occurredAt: timestamp(input.occurredAt),
    reason: reason(input.reason),
  });

  if (state.transitions.some((item) => item.transitionId === transition.transitionId)) {
    return fail(SALES_DOMAIN_ERROR_CODES.lifecycleTransitionDuplicate, "lifecycle.transitionId");
  }

  return Object.freeze({
    documentId: state.documentId,
    documentType: state.documentType,
    status: toStatus,
    transitions: Object.freeze([...state.transitions, transition]),
  });
}
