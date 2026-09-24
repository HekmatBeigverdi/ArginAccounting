import type {
  PurchasePostingRule,
} from "../../domain/purchase-posting-rules.ts";
import type {
  PurchasePostingAggregate,
} from "../../domain/purchase-posting.ts";
import type {
  PurchasePostingSourceIdentity,
  PurchasePostingTraceContext,
} from "../../domain/purchase-posting-source-reference.ts";

export const purchasePostingPermissions = Object.freeze({
  view: "purchases.posting.view",
  execute: "purchases.posting.execute",
  reverse: "purchases.posting.reverse",
  manageRules: "purchases.posting.rules.manage",
  viewTrace: "purchases.posting.trace.view",
} as const);

export type PurchasePostingPermission =
  (typeof purchasePostingPermissions)[keyof typeof purchasePostingPermissions];

export interface PurchasePostingSecurityContext {
  readonly actorId: string;
  readonly actorDisplayName?: string | null;
  readonly correlationId?: string | null;
}

export interface PurchasePostingAuthorizationContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
}

export interface PurchasePostingAuthorizationPolicy {
  require(
    context: PurchasePostingAuthorizationContext,
    permission: PurchasePostingPermission,
  ): Promise<void>;
}

export type PurchasePostingAuditAction =
  | "purchase-posting.prepare"
  | "purchase-posting.replay"
  | "purchase-posting.reverse"
  | "purchase-posting.reversal-replay"
  | "purchase-posting.rule.create"
  | "purchase-posting.rule.update"
  | "purchase-posting.trace.view";

export interface PurchasePostingAuditEvent {
  readonly action: PurchasePostingAuditAction;
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly postingId: string | null;
  readonly journalVoucherId: string | null;
  readonly reversalJournalVoucherId: string | null;
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly occurredAt: string;
  readonly source: Readonly<PurchasePostingSourceIdentity> | null;
  readonly beforeStatus: PurchasePostingAggregate["status"] | null;
  readonly afterStatus: PurchasePostingAggregate["status"] | null;
  readonly beforeVersion: number | null;
  readonly afterVersion: number | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface PurchasePostingAuditSink {
  record(event: PurchasePostingAuditEvent): Promise<void>;
}

export interface PurchasePostingRuleAuditSnapshot {
  readonly rule: Readonly<PurchasePostingRule>;
  readonly version: number;
}

export interface PurchasePostingTraceSnapshot {
  readonly companyId: string;
  readonly branchId: string;
  readonly source: Readonly<PurchasePostingSourceIdentity>;
  readonly postingId: string;
  readonly postingVersion: number;
  readonly postingStatus: PurchasePostingAggregate["status"];
  readonly journalVoucherId: string | null;
  readonly reversalJournalVoucherId: string | null;
  readonly trace: Readonly<PurchasePostingTraceContext>;
  readonly idempotencyKey: string;
}

export interface PurchasePostingTraceReader {
  findByPostingId(
    companyId: string,
    postingId: string,
  ): Promise<PurchasePostingTraceSnapshot | null>;
}

export const purchasePostingCorrelationId = (
  security: PurchasePostingSecurityContext,
  requestId: string,
): string => {
  const correlationId = security.correlationId?.trim();
  return correlationId && correlationId.length > 0
    ? correlationId
    : requestId.trim();
};
