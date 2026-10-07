import type { SalesPostingAggregate } from "../../domain/sales-posting.ts";
import type { SalesPostingSourceIdentity } from "../../domain/sales-posting-source.ts";
import type { SalesPostingRecoverySnapshot } from "../posting-status-recovery.ts";

export const salesPostingPermissions = Object.freeze({
  view: "sales.posting.view",
  execute: "sales.posting.execute",
  recover: "sales.posting.recover",
  viewTrace: "sales.posting.trace.view",
} as const);

export type SalesPostingPermission =
  (typeof salesPostingPermissions)[keyof typeof salesPostingPermissions];

export interface SalesPostingSecurityContext {
  readonly actorId: string;
  readonly actorDisplayName?: string | null;
}

export interface SalesPostingAuthorizationContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
}

export interface SalesPostingAuthorizationPolicy {
  require(
    context: SalesPostingAuthorizationContext,
    permission: SalesPostingPermission,
  ): Promise<void>;
}

export interface SalesPostingApprovalEvidence {
  readonly approvalId: string;
  readonly approvedBy: string;
  readonly approvedAtUtc: string;
}

export type SalesPostingAuditAction =
  | "sales-posting.execute"
  | "sales-posting.replay"
  | "sales-posting.recover"
  | "sales-posting.trace.view";

export interface SalesPostingAuditEvent {
  readonly action: SalesPostingAuditAction;
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly postingId: string;
  readonly journalVoucherId: string | null;
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly occurredAtUtc: string;
  readonly source: Readonly<SalesPostingSourceIdentity>;
  readonly beforeVersion: number;
  readonly afterVersion: number;
  readonly approval: SalesPostingApprovalEvidence | null;
  readonly recovery: SalesPostingRecoverySnapshot | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SalesPostingAuditSink {
  record(event: SalesPostingAuditEvent): Promise<void>;
}

export interface SalesPostingTraceSnapshot {
  readonly companyId: string;
  readonly branchId: string;
  readonly postingId: string;
  readonly postingVersion: number;
  readonly source: Readonly<SalesPostingSourceIdentity>;
  readonly journalVoucherId: string | null;
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly recovery: SalesPostingRecoverySnapshot;
}

export interface SalesPostingTraceReader {
  findByPostingId(
    companyId: string,
    postingId: string,
  ): Promise<SalesPostingTraceSnapshot | null>;
}

export interface SalesPostingScopeReader {
  findById(postingId: string): Promise<SalesPostingAggregate | null>;
}
