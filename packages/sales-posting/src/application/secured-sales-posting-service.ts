import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "../domain/sales-posting-domain-errors.ts";
import type { SalesPostingAggregate } from "../domain/sales-posting.ts";
import {
  commitSalesPostingJournalAtomic,
} from "./atomic-sales-journal-creation.ts";
import type {
  CommitSalesPostingJournalInput,
  CommitSalesPostingJournalResult,
  SalesPostingJournalAtomicUnitOfWork,
} from "./atomic-sales-journal-creation.ts";
import {
  projectSalesPostingRecovery,
} from "./posting-status-recovery.ts";
import type {
  SalesPostingRecoverySnapshot,
} from "./posting-status-recovery.ts";
import {
  salesPostingPermissions,
} from "./contracts/sales-posting-security.ts";
import type {
  SalesPostingApprovalEvidence,
  SalesPostingAuditSink,
  SalesPostingAuthorizationPolicy,
  SalesPostingScopeReader,
  SalesPostingSecurityContext,
  SalesPostingTraceReader,
  SalesPostingTraceSnapshot,
} from "./contracts/sales-posting-security.ts";
import type {
  SalesPostingPostFinalizationState,
} from "./post-finalization-orchestrator.ts";

export interface SalesPostingOperationTrace {
  readonly requestId: string;
  readonly operationId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
}

export interface SecuredSalesPostingServiceDependencies {
  readonly postings: SalesPostingScopeReader;
  readonly authorization: SalesPostingAuthorizationPolicy;
  readonly audit: SalesPostingAuditSink;
  readonly traceReader: SalesPostingTraceReader;
  readonly journalUnitOfWork: SalesPostingJournalAtomicUnitOfWork;
}

export interface ExecuteSecuredSalesPostingInput {
  readonly command: CommitSalesPostingJournalInput;
  readonly trace: SalesPostingOperationTrace;
  readonly requiresApproval?: boolean;
  readonly approval?: SalesPostingApprovalEvidence | null;
}

export interface RecoverSecuredSalesPostingInput {
  readonly companyId: string;
  readonly branchId: string;
  readonly postingId: string;
  readonly orchestration: SalesPostingPostFinalizationState;
  readonly trace: SalesPostingOperationTrace;
  readonly occurredAtUtc: string;
  readonly lastErrorCode?: string | null;
}

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SalesPostingDomainError(
      SALES_POSTING_DOMAIN_ERROR_CODES.traceMismatch,
      field,
    );
  }
  return value.trim();
}

function assertApproval(
  requiredApproval: boolean,
  evidence: SalesPostingApprovalEvidence | null | undefined,
): SalesPostingApprovalEvidence | null {
  if (!requiredApproval) return evidence ?? null;
  if (
    !evidence
    || !evidence.approvalId?.trim()
    || !evidence.approvedBy?.trim()
    || !Number.isFinite(new Date(evidence.approvedAtUtc).getTime())
  ) {
    throw new SalesPostingDomainError(
      SALES_POSTING_DOMAIN_ERROR_CODES.approvalRequired,
      "approval",
    );
  }
  return Object.freeze({ ...evidence });
}

export class SecuredSalesPostingService {
  constructor(readonly deps: SecuredSalesPostingServiceDependencies) {}

  async execute(
    security: SalesPostingSecurityContext,
    input: ExecuteSecuredSalesPostingInput,
  ): Promise<CommitSalesPostingJournalResult> {
    const trace = this.normalizeTrace(input.trace);
    if (
      input.command.requestId !== undefined
      && input.command.requestId !== null
      && input.command.requestId !== trace.requestId
    ) {
      throw new SalesPostingDomainError(
        SALES_POSTING_DOMAIN_ERROR_CODES.traceMismatch,
        "requestId",
      );
    }

    const persisted = await this.requirePosting(
      input.command.postingId,
      input.command.companyId,
      input.command.branchId ?? "",
    );
    await this.requirePermission(
      security,
      persisted,
      trace,
      salesPostingPermissions.execute,
    );

    const approval = assertApproval(
      input.requiresApproval === true,
      input.approval,
    );

    const result = await commitSalesPostingJournalAtomic(
      {
        ...input.command,
        requestId: trace.requestId,
        causationId: trace.causationId,
      },
      this.deps.journalUnitOfWork,
    );

    await this.deps.audit.record(Object.freeze({
      action: result.replayed ? "sales-posting.replay" : "sales-posting.execute",
      actorId: security.actorId,
      companyId: persisted.companyId,
      branchId: persisted.branchId,
      postingId: persisted.postingId,
      journalVoucherId: result.journal.id,
      requestId: trace.requestId,
      operationId: trace.operationId,
      correlationId: trace.correlationId,
      causationId: trace.causationId,
      occurredAtUtc: result.posting.updatedAtUtc,
      source: result.posting.source,
      beforeVersion: persisted.version,
      afterVersion: result.posting.version,
      approval,
      recovery: null,
      metadata: Object.freeze({
        replayed: result.replayed,
        payloadFingerprint: input.command.payloadFingerprint,
        sourceVersion: result.posting.source.sourceVersion,
      }),
    }));

    return result;
  }

  async recover(
    security: SalesPostingSecurityContext,
    input: RecoverSecuredSalesPostingInput,
  ): Promise<SalesPostingRecoverySnapshot> {
    const trace = this.normalizeTrace(input.trace);
    const persisted = await this.requirePosting(
      input.postingId,
      input.companyId,
      input.branchId,
    );
    await this.requirePermission(
      security,
      persisted,
      trace,
      salesPostingPermissions.recover,
    );

    const recovery = projectSalesPostingRecovery({
      orchestration: input.orchestration,
      lastErrorCode: input.lastErrorCode ?? null,
    });

    await this.deps.audit.record(Object.freeze({
      action: "sales-posting.recover",
      actorId: security.actorId,
      companyId: persisted.companyId,
      branchId: persisted.branchId,
      postingId: persisted.postingId,
      journalVoucherId: recovery.journalVoucherId,
      requestId: trace.requestId,
      operationId: trace.operationId,
      correlationId: trace.correlationId,
      causationId: trace.causationId,
      occurredAtUtc: input.occurredAtUtc,
      source: persisted.source,
      beforeVersion: persisted.version,
      afterVersion: persisted.version,
      approval: null,
      recovery,
      metadata: Object.freeze({
        retryAction: recovery.retryAction,
        reason: recovery.reason,
      }),
    }));

    return recovery;
  }

  async viewTrace(
    security: SalesPostingSecurityContext,
    query: {
      readonly companyId: string;
      readonly branchId: string;
      readonly postingId: string;
      readonly trace: SalesPostingOperationTrace;
      readonly occurredAtUtc: string;
    },
  ): Promise<SalesPostingTraceSnapshot | null> {
    const trace = this.normalizeTrace(query.trace);
    const persisted = await this.requirePosting(
      query.postingId,
      query.companyId,
      query.branchId,
    );
    await this.requirePermission(
      security,
      persisted,
      trace,
      salesPostingPermissions.viewTrace,
    );

    const snapshot = await this.deps.traceReader.findByPostingId(
      persisted.companyId,
      persisted.postingId,
    );

    await this.deps.audit.record(Object.freeze({
      action: "sales-posting.trace.view",
      actorId: security.actorId,
      companyId: persisted.companyId,
      branchId: persisted.branchId,
      postingId: persisted.postingId,
      journalVoucherId: snapshot?.journalVoucherId ?? null,
      requestId: trace.requestId,
      operationId: trace.operationId,
      correlationId: trace.correlationId,
      causationId: trace.causationId,
      occurredAtUtc: query.occurredAtUtc,
      source: persisted.source,
      beforeVersion: persisted.version,
      afterVersion: persisted.version,
      approval: null,
      recovery: snapshot?.recovery ?? null,
      metadata: Object.freeze({ found: snapshot !== null }),
    }));

    return snapshot;
  }

  private async requirePosting(
    postingId: string,
    companyId: string,
    branchId: string,
  ): Promise<SalesPostingAggregate> {
    const posting = await this.deps.postings.findById(postingId);
    if (
      posting === null
      || posting.companyId !== companyId
      || posting.branchId !== branchId
    ) {
      throw new SalesPostingDomainError(
        SALES_POSTING_DOMAIN_ERROR_CODES.scopeMismatch,
        "posting",
      );
    }
    return posting;
  }

  private async requirePermission(
    security: SalesPostingSecurityContext,
    posting: SalesPostingAggregate,
    trace: SalesPostingOperationTrace,
    permission: Parameters<SalesPostingAuthorizationPolicy["require"]>[1],
  ): Promise<void> {
    try {
      await this.deps.authorization.require({
        actorId: required(security.actorId, "actorId"),
        companyId: posting.companyId,
        branchId: posting.branchId,
        requestId: trace.requestId,
        operationId: trace.operationId,
        correlationId: trace.correlationId,
      }, permission);
    } catch (error) {
      if (
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.unauthorized
      ) {
        throw error;
      }
      throw new SalesPostingDomainError(
        SALES_POSTING_DOMAIN_ERROR_CODES.unauthorized,
        "permission",
      );
    }
  }

  private normalizeTrace(
    trace: SalesPostingOperationTrace,
  ): SalesPostingOperationTrace {
    return Object.freeze({
      requestId: required(trace.requestId, "requestId"),
      operationId: required(trace.operationId, "operationId"),
      correlationId: required(trace.correlationId, "correlationId"),
      causationId: trace.causationId?.trim() || null,
    });
  }
}
