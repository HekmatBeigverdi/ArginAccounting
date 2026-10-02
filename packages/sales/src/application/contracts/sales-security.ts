import type { SalesDocumentStatus } from "../../domain/sales-lifecycle.ts";

export const salesPermissions = Object.freeze({
  view: "sales.documents.view",
  create: "sales.documents.create",
  edit: "sales.documents.edit",
  submit: "sales.documents.submit",
  approve: "sales.documents.approve",
  reject: "sales.documents.reject",
  finalize: "sales.documents.finalize",
  cancel: "sales.documents.cancel",
  stageIssue: "sales.inventory-issues.stage",
  stageReturnReceipt: "sales.return-receipts.stage",
  export: "sales.reports.export",
} as const);

export type SalesPermission = (typeof salesPermissions)[keyof typeof salesPermissions];

export interface SalesSecurityContext {
  readonly actorId: string;
  readonly actorDisplayName?: string | null;
  readonly correlationId?: string | null;
}

export interface SalesAuthorizationContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
}

export interface SalesAuthorizationPolicy {
  require(context: SalesAuthorizationContext, permission: SalesPermission): Promise<void>;
}

export type SalesAuditAction =
  | "sales.document.create"
  | "sales.document.edit"
  | "sales.document.submit"
  | "sales.document.approve"
  | "sales.document.reject"
  | "sales.document.finalize"
  | "sales.document.cancel"
  | "sales.inventory-issue.stage"
  | "sales.return-receipt.stage"
  | "sales.query.view"
  | "sales.report.export";

export interface SalesAuditEvent {
  readonly action: SalesAuditAction;
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly documentId: string | null;
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly beforeStatus: SalesDocumentStatus | null;
  readonly afterStatus: SalesDocumentStatus | null;
  readonly beforeVersion: number | null;
  readonly afterVersion: number | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SalesAuditSink {
  record(event: SalesAuditEvent): Promise<void>;
}

export const salesCorrelationId = (
  security: SalesSecurityContext,
  requestId: string,
): string => {
  const correlationId = security.correlationId?.trim();
  return correlationId || requestId.trim();
};
