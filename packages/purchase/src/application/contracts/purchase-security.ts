import type { PurchaseDocumentStatus } from "../../domain/purchase-lifecycle.ts";

export const purchasePermissions = Object.freeze({
  view: "purchases.documents.view",
  create: "purchases.documents.create",
  edit: "purchases.documents.edit",
  submit: "purchases.documents.submit",
  approve: "purchases.documents.approve",
  confirm: "purchases.documents.confirm",
  cancel: "purchases.documents.cancel",
  reopen: "purchases.documents.reopen",
  return: "purchases.documents.return",
  correct: "purchases.documents.correct",
  stageReceipt: "purchases.receipts.stage",
  manageMatching: "purchases.matching.manage",
  resolveCost: "purchases.cost-resolution.manage",
  export: "purchases.reports.export",
} as const);

export type PurchasePermission = (typeof purchasePermissions)[keyof typeof purchasePermissions];

export interface PurchaseSecurityContext {
  readonly actorId: string;
  readonly actorDisplayName?: string | null;
  readonly correlationId?: string | null;
}

export interface PurchaseAuthorizationContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
}

export interface PurchaseAuthorizationPolicy {
  require(context: PurchaseAuthorizationContext, permission: PurchasePermission): Promise<void>;
}

export type PurchaseAuditAction =
  | "purchase.document.create"
  | "purchase.document.submit"
  | "purchase.document.approve"
  | "purchase.document.confirm"
  | "purchase.document.cancel"
  | "purchase.document.reopen"
  | "purchase.document.return"
  | "purchase.document.correct"
  | "purchase.inventory-receipt.stage"
  | "purchase.match.create"
  | "purchase.cost.resolve"
  | "purchase.query.view"
  | "purchase.report.export";

export interface PurchaseAuditEvent {
  readonly action: PurchaseAuditAction;
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly documentId: string | null;
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly beforeStatus: PurchaseDocumentStatus | null;
  readonly afterStatus: PurchaseDocumentStatus | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/** Shared Audit adapter persists append-only and de-duplicates by action + operationId + target identity. */
export interface PurchaseAuditSink {
  record(event: PurchaseAuditEvent): Promise<void>;
}

export const PURCHASE_APPROVAL_REQUEST_TYPE = "purchase-document" as const;

export interface PurchaseApprovalReference {
  readonly requestId: string;
  readonly status: "draft" | "pending" | "approved" | "rejected" | "cancelled";
}

/**
 * Adapter over shared Phase 8 Approval.
 * approvalCycleKey identifies the latest Purchase submit transition and prevents reuse of an older approval after reopen/resubmit.
 */
export interface PurchaseApprovalGateway {
  submit(input: {
    readonly companyId: string;
    readonly branchId: string;
    readonly documentId: string;
    readonly documentNumber: string | null;
    readonly approvalCycleKey: string;
    readonly actorId: string;
    readonly actorDisplayName: string;
    readonly correlationId: string;
  }): Promise<PurchaseApprovalReference>;
  approve(input: {
    readonly companyId: string;
    readonly documentId: string;
    readonly approvalCycleKey: string;
    readonly actorId: string;
    readonly actorDisplayName: string;
    readonly correlationId: string;
    readonly comment: string | null;
  }): Promise<PurchaseApprovalReference>;
  requireApproved(companyId: string, documentId: string, approvalCycleKey: string): Promise<void>;
}

export const purchaseCorrelationId = (security: PurchaseSecurityContext, requestId: string): string => {
  const correlationId = security.correlationId?.trim();
  return correlationId && correlationId.length > 0 ? correlationId : requestId.trim();
};
