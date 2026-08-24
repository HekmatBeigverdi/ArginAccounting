import type { ApprovalActor } from "@argin/audit";

import type { JournalVoucherStatus } from "../domain/journal-voucher.ts";
import type { JournalVoucherApprovalDecision } from "./journal-voucher-approval-integration.ts";

export interface JournalVoucherLifecycleCommandContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly requestId?: string | null;
  readonly correlationId?: string | null;
  readonly causationId?: string | null;
  readonly occurredAt: string;
}

export interface SubmitJournalVoucherLifecycleCommand { readonly context: JournalVoucherLifecycleCommandContext; readonly voucherId: string; readonly expectedVersion: number; readonly actor: ApprovalActor; }
export interface DecideJournalVoucherLifecycleApprovalCommand { readonly context: JournalVoucherLifecycleCommandContext; readonly voucherId: string; readonly expectedVersion: number; readonly expectedApprovalVersion: number; readonly actor: ApprovalActor; readonly decision: JournalVoucherApprovalDecision; readonly comment?: string | null; }
export interface PostJournalVoucherLifecycleCommand { readonly context: JournalVoucherLifecycleCommandContext; readonly voucherId: string; readonly expectedVersion: number; readonly postingReference?: string | null; }
export interface ReopenJournalVoucherLifecycleCommand { readonly context: JournalVoucherLifecycleCommandContext; readonly voucherId: string; readonly expectedVersion: number; readonly actor: ApprovalActor; readonly reason: string; }
export interface ReverseJournalVoucherLifecycleCommand { readonly context: JournalVoucherLifecycleCommandContext; readonly voucherId: string; readonly expectedVersion: number; readonly reversalDate: string; readonly reason: string; readonly replacementVoucherId?: string | null; }
export interface GetJournalVoucherLifecycleQuery { readonly companyId: string; readonly voucherId: string; }

export type JournalVoucherLifecycleActionCapability = "edit" | "delete" | "submit_for_approval" | "approve" | "reject" | "return_to_draft" | "cancel_approval" | "reopen_for_amendment" | "post" | "reverse";
export interface JournalVoucherLifecycleCapabilitiesDto { readonly editable: boolean; readonly deletable: boolean; readonly actions: readonly JournalVoucherLifecycleActionCapability[]; }
export interface JournalVoucherApprovalTraceDto { readonly approvalRequestId: string; readonly submittedContentVersion: number; readonly status: "pending" | "approved" | "closed"; readonly isCurrent: boolean; }
export interface JournalVoucherPostingTraceDto { readonly approvalRequestId: string; readonly submittedContentVersion: number; readonly postedVersion: number; readonly postedBy: string; readonly postedAt: string; readonly postingReference: string | null; }
export interface JournalVoucherAmendmentTraceDto { readonly approvalRequestId: string; readonly previousVersion: number; readonly reopenedVersion: number; readonly reopenedBy: string; readonly reopenedAt: string; readonly reason: string; }
export interface JournalVoucherReversalTraceDto { readonly originalVoucherId: string; readonly reversalVoucherId: string; readonly replacementVoucherId: string | null; readonly requestId: string; readonly reversedBy: string; readonly reversedAt: string; readonly reason: string; }
export interface JournalVoucherLifecycleDto { readonly voucherId: string; readonly companyId: string; readonly status: JournalVoucherStatus; readonly version: number; readonly capabilities: JournalVoucherLifecycleCapabilitiesDto; readonly approval: JournalVoucherApprovalTraceDto | null; readonly posting: JournalVoucherPostingTraceDto | null; readonly latestAmendment: JournalVoucherAmendmentTraceDto | null; readonly reversal: JournalVoucherReversalTraceDto | null; }

export type JournalVoucherLifecycleApplicationErrorCode =
  | "journal.unauthorized"
  | "journal.segregation-of-duties-violation"
  | "journal.not-found"
  | "journal.version-conflict"
  | "journal.invalid-transition"
  | "journal.locked"
  | "journal.approval-cycle-exists"
  | "journal.approval-cycle-missing"
  | "journal.approval-target-mismatch"
  | "journal.approval-status-mismatch"
  | "journal.approval-version-conflict"
  | "journal.approval-content-version-mismatch"
  | "journal.not-approved"
  | "journal.posting-validation-failed"
  | "journal.amendment-not-allowed"
  | "journal.amendment-reason-required"
  | "journal.not-posted"
  | "journal.already-reversed"
  | "journal.reversal-idempotency-conflict"
  | "journal.reversal-validation-failed"
  | "journal.replacement-invalid"
  | "journal.idempotency-conflict"
  | "journal.persistence-failed";

export class JournalVoucherLifecycleApplicationError extends Error {
  constructor(readonly code: JournalVoucherLifecycleApplicationErrorCode, message: string, readonly details: Readonly<Record<string, unknown>> = Object.freeze({}), options?: ErrorOptions) {
    super(message, options);
    this.name = "JournalVoucherLifecycleApplicationError";
  }
}
