import {
  commitPurchasePostingReplaySafe,
  type PurchasePostingReplayUnitOfWork,
  type ReplaySafePurchasePostingInput,
  type ReplaySafePurchasePostingResult,
} from "./replay-safe-posting.ts";
import {
  reversePurchasePostingControlled,
  type PurchasePostingReversalUnitOfWork,
  type ReversePurchasePostingCommand,
  type ReversePurchasePostingResult,
} from "./controlled-posting-reversal.ts";
import type { PurchasePostingAggregate } from "../domain/purchase-posting.ts";
import {
  createPurchasePostingTraceContext,
  type PurchasePostingTraceContext,
} from "../domain/purchase-posting-source-reference.ts";
import {
  purchasePostingPermissions,
  type PurchasePostingAuditAction,
  type PurchasePostingAuditSink,
  type PurchasePostingAuthorizationPolicy,
  type PurchasePostingRuleAuditSnapshot,
  type PurchasePostingSecurityContext,
  type PurchasePostingTraceReader,
  type PurchasePostingTraceSnapshot,
} from "./contracts/purchase-posting-security.ts";

export type PurchasePostingSecurityErrorCode =
  | "PURCHASE_POSTING_UNAUTHORIZED"
  | "PURCHASE_POSTING_NOT_FOUND"
  | "PURCHASE_POSTING_SCOPE_MISMATCH"
  | "PURCHASE_POSTING_TRACE_MISMATCH";

export class PurchasePostingSecurityError extends Error {
  constructor(
    readonly code: PurchasePostingSecurityErrorCode,
    readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "PurchasePostingSecurityError";
  }
}

export interface PurchasePostingScopeReader {
  findById(postingId: string): Promise<PurchasePostingAggregate | null>;
}

export interface SecuredPurchasePostingServiceDependencies {
  readonly postings: PurchasePostingScopeReader;
  readonly authorization: PurchasePostingAuthorizationPolicy;
  readonly audit: PurchasePostingAuditSink;
  readonly postingUnitOfWork: PurchasePostingReplayUnitOfWork;
  readonly reversalUnitOfWork: PurchasePostingReversalUnitOfWork;
  readonly traceReader: PurchasePostingTraceReader;
}

export interface SecuredPurchasePostingInput {
  readonly command: ReplaySafePurchasePostingInput;
  readonly trace: PurchasePostingTraceContext;
}

export interface SecuredPurchasePostingReversalInput {
  readonly command: ReversePurchasePostingCommand;
  readonly trace: PurchasePostingTraceContext;
}

export interface PurchasePostingRuleMutationContext {
  readonly companyId: string;
  readonly branchId: string;
  readonly trace: PurchasePostingTraceContext;
  readonly occurredAt: string;
}

export interface PurchasePostingRuleMutationInput {
  readonly context: PurchasePostingRuleMutationContext;
  readonly before: PurchasePostingRuleAuditSnapshot | null;
  readonly after: PurchasePostingRuleAuditSnapshot;
}

export interface PurchasePostingTraceQuery {
  readonly companyId: string;
  readonly branchId: string;
  readonly postingId: string;
  readonly trace: PurchasePostingTraceContext;
  readonly occurredAt: string;
}

const normalizedTrace = (
  value: PurchasePostingTraceContext,
): PurchasePostingTraceContext => createPurchasePostingTraceContext(value);

const ruleSnapshotMatchesScope = (
  snapshot: PurchasePostingRuleAuditSnapshot,
  companyId: string,
  branchId: string,
): boolean =>
  snapshot.rule.companyId === companyId
  && (snapshot.rule.branchId === null || snapshot.rule.branchId === branchId);

export class SecuredPurchasePostingService {
  constructor(readonly deps: SecuredPurchasePostingServiceDependencies) {}

  async post(
    security: PurchasePostingSecurityContext,
    input: SecuredPurchasePostingInput,
  ): Promise<ReplaySafePurchasePostingResult> {
    const trace = normalizedTrace(input.trace);
    this.assertPostTrace(input.command, trace);

    const persisted = await this.requirePosting(
      input.command.posting.postingId,
      input.command.posting.companyId,
    );

    await this.require(
      security,
      persisted.companyId,
      persisted.branchId,
      trace,
      purchasePostingPermissions.execute,
    );

    const result = await commitPurchasePostingReplaySafe(
      input.command,
      this.deps.postingUnitOfWork,
    );

    await this.record(
      result.replayed ? "purchase-posting.replay" : "purchase-posting.prepare",
      security,
      trace,
      result.posting,
      input.command.source,
      persisted.status,
      persisted.version,
      null,
      null,
      {
        postingPurpose: input.command.purpose,
        payloadFingerprint: input.command.payloadFingerprint,
        idempotencyKey: result.idempotencyRecord.idempotencyKey,
        sourceVersion: input.command.source.sourceVersion,
        sourceRevision: input.command.source.sourceRevision,
        replayed: result.replayed,
      },
    );

    return result;
  }

  async reverse(
    security: PurchasePostingSecurityContext,
    input: SecuredPurchasePostingReversalInput,
  ): Promise<ReversePurchasePostingResult> {
    const trace = normalizedTrace(input.trace);
    if (trace.requestId !== input.command.requestId) {
      throw new PurchasePostingSecurityError(
        "PURCHASE_POSTING_TRACE_MISMATCH",
        "requestId",
      );
    }

    const persisted = await this.requirePosting(
      input.command.postingId,
      input.command.companyId,
    );

    await this.require(
      security,
      persisted.companyId,
      persisted.branchId,
      trace,
      purchasePostingPermissions.reverse,
    );

    const result = await reversePurchasePostingControlled(
      {
        ...input.command,
        correlationId: trace.correlationId,
        causationId: trace.causationId,
      },
      this.deps.reversalUnitOfWork,
    );

    await this.record(
      result.replayed
        ? "purchase-posting.reversal-replay"
        : "purchase-posting.reverse",
      security,
      trace,
      result.posting,
      null,
      persisted.status,
      persisted.version,
      result.reversal.reversalJournalVoucherId,
      input.command.reason,
      {
        originalJournalVoucherId: result.reversal.originalJournalVoucherId,
        reversalRequestId: result.reversal.requestId,
        committedPostingVersion: result.reversal.committedPostingVersion,
        replayed: result.replayed,
      },
    );

    return result;
  }

  async saveRule(
    security: PurchasePostingSecurityContext,
    input: PurchasePostingRuleMutationInput,
    mutate: (rule: PurchasePostingRuleAuditSnapshot) => Promise<PurchasePostingRuleAuditSnapshot>,
  ): Promise<PurchasePostingRuleAuditSnapshot> {
    const trace = normalizedTrace(input.context.trace);

    if (
      input.after.rule.companyId !== input.context.companyId
      || !ruleSnapshotMatchesScope(
        input.after,
        input.context.companyId,
        input.context.branchId,
      )
      || (
        input.before !== null
        && (
          input.before.rule.ruleId !== input.after.rule.ruleId
          || input.before.rule.companyId !== input.after.rule.companyId
        )
      )
    ) {
      throw new PurchasePostingSecurityError(
        "PURCHASE_POSTING_SCOPE_MISMATCH",
        "rule",
      );
    }

    await this.require(
      security,
      input.context.companyId,
      input.context.branchId,
      trace,
      purchasePostingPermissions.manageRules,
    );

    const result = await mutate(input.after);
    const action: PurchasePostingAuditAction =
      input.before === null
        ? "purchase-posting.rule.create"
        : "purchase-posting.rule.update";

    await this.deps.audit.record(Object.freeze({
      action,
      actorId: security.actorId,
      companyId: input.context.companyId,
      branchId: input.context.branchId,
      postingId: null,
      journalVoucherId: null,
      reversalJournalVoucherId: null,
      requestId: trace.requestId,
      operationId: trace.operationId,
      correlationId: trace.correlationId,
      causationId: trace.causationId,
      occurredAt: input.context.occurredAt,
      source: null,
      beforeStatus: null,
      afterStatus: null,
      beforeVersion: input.before?.version ?? null,
      afterVersion: result.version,
      reason: null,
      metadata: Object.freeze({
        ruleId: result.rule.ruleId,
        accountRole: result.rule.accountRole,
        accountId: result.rule.accountId,
        priority: result.rule.priority,
        active: result.rule.active,
      }),
    }));

    return result;
  }

  async viewPosting(
    security: PurchasePostingSecurityContext,
    query: PurchasePostingTraceQuery,
  ): Promise<PurchasePostingAggregate> {
    const trace = normalizedTrace(query.trace);
    const persisted = await this.requirePosting(query.postingId, query.companyId);
    if (persisted.branchId !== query.branchId) {
      throw new PurchasePostingSecurityError(
        "PURCHASE_POSTING_SCOPE_MISMATCH",
        "branchId",
      );
    }
    await this.require(
      security,
      persisted.companyId,
      persisted.branchId,
      trace,
      purchasePostingPermissions.view,
    );
    return persisted;
  }

  async viewTrace(
    security: PurchasePostingSecurityContext,
    query: PurchasePostingTraceQuery,
  ): Promise<PurchasePostingTraceSnapshot | null> {
    const trace = normalizedTrace(query.trace);
    const persisted = await this.requirePosting(query.postingId, query.companyId);

    if (persisted.branchId !== query.branchId) {
      throw new PurchasePostingSecurityError(
        "PURCHASE_POSTING_SCOPE_MISMATCH",
        "branchId",
      );
    }

    await this.require(
      security,
      persisted.companyId,
      persisted.branchId,
      trace,
      purchasePostingPermissions.viewTrace,
    );

    const result = await this.deps.traceReader.findByPostingId(
      persisted.companyId,
      persisted.postingId,
    );

    await this.deps.audit.record(Object.freeze({
      action: "purchase-posting.trace.view",
      actorId: security.actorId,
      companyId: persisted.companyId,
      branchId: persisted.branchId,
      postingId: persisted.postingId,
      journalVoucherId: persisted.journalVoucherId,
      reversalJournalVoucherId: result?.reversalJournalVoucherId ?? null,
      requestId: trace.requestId,
      operationId: trace.operationId,
      correlationId: trace.correlationId,
      causationId: trace.causationId,
      occurredAt: query.occurredAt,
      source: result?.source ?? null,
      beforeStatus: persisted.status,
      afterStatus: persisted.status,
      beforeVersion: persisted.version,
      afterVersion: persisted.version,
      reason: null,
      metadata: Object.freeze({
        found: result !== null,
      }),
    }));

    return result;
  }

  private async requirePosting(
    postingId: string,
    companyId: string,
  ): Promise<PurchasePostingAggregate> {
    const posting = await this.deps.postings.findById(postingId);
    if (posting === null) {
      throw new PurchasePostingSecurityError(
        "PURCHASE_POSTING_NOT_FOUND",
        "postingId",
      );
    }
    if (posting.companyId !== companyId) {
      throw new PurchasePostingSecurityError(
        "PURCHASE_POSTING_SCOPE_MISMATCH",
        "companyId",
      );
    }
    return posting;
  }

  private async require(
    security: PurchasePostingSecurityContext,
    companyId: string,
    branchId: string,
    trace: PurchasePostingTraceContext,
    permission: Parameters<PurchasePostingAuthorizationPolicy["require"]>[1],
  ): Promise<void> {
    try {
      await this.deps.authorization.require({
        actorId: security.actorId,
        companyId,
        branchId,
        requestId: trace.requestId,
        operationId: trace.operationId,
        correlationId: trace.correlationId,
      }, permission);
    } catch (error) {
      if (error instanceof PurchasePostingSecurityError) throw error;
      throw new PurchasePostingSecurityError(
        "PURCHASE_POSTING_UNAUTHORIZED",
        "permission",
      );
    }
  }

  private assertPostTrace(
    command: ReplaySafePurchasePostingInput,
    trace: PurchasePostingTraceContext,
  ): void {
    if (
      command.journal.source.requestId !== trace.requestId
      || command.journal.source.correlationId !== trace.correlationId
      || command.journal.source.causationId !== trace.causationId
    ) {
      throw new PurchasePostingSecurityError(
        "PURCHASE_POSTING_TRACE_MISMATCH",
        "journal.source",
      );
    }
  }

  private async record(
    action: PurchasePostingAuditAction,
    security: PurchasePostingSecurityContext,
    trace: PurchasePostingTraceContext,
    posting: PurchasePostingAggregate,
    source: ReplaySafePurchasePostingInput["source"] | null,
    beforeStatus: PurchasePostingAggregate["status"],
    beforeVersion: number,
    reversalJournalVoucherId: string | null,
    reason: string | null,
    metadata: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    await this.deps.audit.record(Object.freeze({
      action,
      actorId: security.actorId,
      companyId: posting.companyId,
      branchId: posting.branchId,
      postingId: posting.postingId,
      journalVoucherId: posting.journalVoucherId,
      reversalJournalVoucherId,
      requestId: trace.requestId,
      operationId: trace.operationId,
      correlationId: trace.correlationId,
      causationId: trace.causationId,
      occurredAt: posting.updatedAt,
      source,
      beforeStatus,
      afterStatus: posting.status,
      beforeVersion,
      afterVersion: posting.version,
      reason: reason?.trim() || null,
      metadata,
    }));
  }
}
