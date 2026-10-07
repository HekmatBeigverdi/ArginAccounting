import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "../domain/sales-posting-domain-errors.ts";
import type {
  SalesPostingPostFinalizationState,
} from "./post-finalization-orchestrator.ts";
import type {
  SalesPostingIdempotencyRecord,
} from "../domain/sales-posting-idempotency.ts";

export const SALES_POSTING_RECOVERY_STATUSES = Object.freeze([
  "pending",
  "ready",
  "committed",
  "blocked",
] as const);

export type SalesPostingRecoveryStatus =
  (typeof SALES_POSTING_RECOVERY_STATUSES)[number];

export const SALES_POSTING_RETRY_ACTIONS = Object.freeze([
  "wait",
  "retry",
  "replay",
  "manual-review",
  "none",
] as const);

export type SalesPostingRetryAction =
  (typeof SALES_POSTING_RETRY_ACTIONS)[number];

export interface SalesPostingRecoverySnapshot {
  readonly status: SalesPostingRecoveryStatus;
  readonly retryAction: SalesPostingRetryAction;
  readonly reason: string | null;
  readonly waitingLineIds: readonly string[];
  readonly journalVoucherId: string | null;
  readonly committedPostingVersion: number | null;
}

export function projectSalesPostingRecovery(input: {
  readonly orchestration: SalesPostingPostFinalizationState;
  readonly committed?: SalesPostingIdempotencyRecord | null;
  readonly lastErrorCode?: string | null;
}): SalesPostingRecoverySnapshot {
  if (!input || typeof input !== "object" || !input.orchestration) {
    throw new SalesPostingDomainError(
      SALES_POSTING_DOMAIN_ERROR_CODES.recoveryInvalid,
      "input",
    );
  }

  if (input.committed) {
    return Object.freeze({
      status: "committed",
      retryAction: "replay",
      reason: null,
      waitingLineIds: Object.freeze([]),
      journalVoucherId: input.committed.journalVoucherId,
      committedPostingVersion: input.committed.committedPostingVersion,
    });
  }

  if (input.orchestration.status === "pending") {
    return Object.freeze({
      status: "pending",
      retryAction: "wait",
      reason: input.orchestration.reason,
      waitingLineIds: Object.freeze([...input.orchestration.waitingLineIds]),
      journalVoucherId: null,
      committedPostingVersion: null,
    });
  }

  if (input.lastErrorCode) {
    const retriable = new Set([
      SALES_POSTING_DOMAIN_ERROR_CODES.atomicCommitConflict,
      SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyConflict,
    ]);
    return Object.freeze({
      status: retriable.has(input.lastErrorCode as never) ? "ready" : "blocked",
      retryAction: retriable.has(input.lastErrorCode as never) ? "retry" : "manual-review",
      reason: input.lastErrorCode,
      waitingLineIds: Object.freeze([]),
      journalVoucherId: null,
      committedPostingVersion: null,
    });
  }

  return Object.freeze({
    status: "ready",
    retryAction: "retry",
    reason: null,
    waitingLineIds: Object.freeze([]),
    journalVoucherId: null,
    committedPostingVersion: null,
  });
}

export function assertDeterministicRecoveryTransition(
  previous: SalesPostingRecoverySnapshot,
  next: SalesPostingRecoverySnapshot,
): void {
  if (previous.status === "committed" && next.status !== "committed") {
    throw new SalesPostingDomainError(
      SALES_POSTING_DOMAIN_ERROR_CODES.recoveryConflict,
      "status",
    );
  }
  if (
    previous.status === "committed"
    && next.journalVoucherId !== previous.journalVoucherId
  ) {
    throw new SalesPostingDomainError(
      SALES_POSTING_DOMAIN_ERROR_CODES.recoveryConflict,
      "journalVoucherId",
    );
  }
}
