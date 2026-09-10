import type { InventoryDocumentStatus } from "../../domain/inventory-document.ts";

export const inventoryPermissions = Object.freeze({
  view: "inventory.documents.view",
  create: "inventory.documents.create",
  edit: "inventory.documents.edit",
  submit: "inventory.documents.submit",
  approve: "inventory.documents.approve",
  confirm: "inventory.documents.confirm",
  reverse: "inventory.documents.reverse",
  cancel: "inventory.documents.cancel",
  import: "inventory.documents.import",
  export: "inventory.documents.export",
} as const);

export type InventoryPermission = (typeof inventoryPermissions)[keyof typeof inventoryPermissions];

export interface InventorySecurityContext {
  readonly actorId: string;
  readonly actorDisplayName?: string | null;
  readonly correlationId?: string | null;
}

export interface InventoryAuthorizationContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface InventoryAuthorizationPolicy {
  require(context: InventoryAuthorizationContext, permission: InventoryPermission): Promise<void>;
}

export type InventoryAuditAction =
  | "inventory.document.submit"
  | "inventory.document.approve"
  | "inventory.document.confirm"
  | "inventory.document.reverse"
  | "inventory.document.cancel"
  | "inventory.document.import"
  | "inventory.document.export";

export interface InventoryAuditEvent {
  readonly action: InventoryAuditAction;
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly documentId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly beforeStatus: InventoryDocumentStatus | null;
  readonly afterStatus: InventoryDocumentStatus | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/** Shared Audit adapter must persist append-only and de-duplicate successful replay by action + requestId + documentId. */
export interface InventoryAuditSink {
  record(event: InventoryAuditEvent): Promise<void>;
}

export const INVENTORY_APPROVAL_REQUEST_TYPE = "inventory-document" as const;

export interface InventoryApprovalReference {
  readonly requestId: string;
  readonly status: "draft" | "pending" | "approved" | "rejected" | "cancelled";
}

/** Adapter over the shared Phase 8 Approval engine. This is not an Inventory-owned workflow store. */
export interface InventoryApprovalGateway {
  submit(input: {
    readonly companyId: string;
    readonly branchId: string | null;
    readonly documentId: string;
    readonly documentNumber: string | null;
    readonly actorId: string;
    readonly actorDisplayName: string;
    readonly correlationId: string;
  }): Promise<InventoryApprovalReference>;
  approve(input: {
    readonly companyId: string;
    readonly documentId: string;
    readonly actorId: string;
    readonly actorDisplayName: string;
    readonly correlationId: string;
    readonly comment: string | null;
  }): Promise<InventoryApprovalReference>;
  requireApproved(companyId: string, documentId: string): Promise<void>;
}

export const inventoryCorrelationId = (security: InventorySecurityContext, requestId: string): string => {
  const correlationId = security.correlationId?.trim();
  return correlationId && correlationId.length > 0 ? correlationId : requestId.trim();
};
