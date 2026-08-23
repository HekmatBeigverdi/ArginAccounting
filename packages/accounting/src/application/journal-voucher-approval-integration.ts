import type {
  ApprovalActor,
  ApprovalRequest,
  ApprovalScope,
  ApprovalTarget,
} from "@argin/audit";

import {
  transitionJournalVoucher,
  type JournalVoucherLifecycleAction,
} from "../domain/journal-voucher-lifecycle.ts";
import type { JournalVoucher } from "../domain/journal-voucher.ts";

export const JOURNAL_VOUCHER_APPROVAL_REQUEST_TYPE =
  "accounting.journal-voucher" as const;
export const JOURNAL_VOUCHER_APPROVAL_TARGET_TYPE =
  "accounting.journal-voucher" as const;

export type JournalVoucherApprovalDecision =
  | "approve"
  | "reject"
  | "return-to-draft"
  | "cancel";

export interface JournalVoucherApprovalCycle {
  readonly approvalRequestId: string;
  readonly voucherId: string;
  readonly submittedContentVersion: number;
  readonly isCurrent: boolean;
}

export interface JournalVoucherApprovalMutationContext {
  readonly actor: ApprovalActor;
  readonly occurredAt: string;
  readonly correlationId?: string | null;
  readonly comment?: string | null;
}

export interface SubmitJournalVoucherForApprovalCommand
  extends JournalVoucherApprovalMutationContext {
  readonly voucherId: string;
  readonly companyId: string;
  readonly expectedVersion: number;
}

export interface DecideJournalVoucherApprovalCommand
  extends JournalVoucherApprovalMutationContext {
  readonly voucherId: string;
  readonly companyId: string;
  readonly expectedVoucherVersion: number;
  readonly expectedApprovalVersion: number;
  readonly decision: JournalVoucherApprovalDecision;
}

export interface JournalVoucherApprovalGateway {
  createAndSubmit(input: {
    readonly requestType: typeof JOURNAL_VOUCHER_APPROVAL_REQUEST_TYPE;
    readonly title: string;
    readonly description: string | null;
    readonly target: ApprovalTarget;
    readonly scope: ApprovalScope;
    readonly actor: ApprovalActor;
    readonly correlationId: string | null;
  }): Promise<ApprovalRequest>;

  applyDecision(input: {
    readonly approvalRequestId: string;
    readonly expectedVersion: number;
    readonly decision: JournalVoucherApprovalDecision;
    readonly actor: ApprovalActor;
    readonly comment: string | null;
    readonly correlationId: string | null;
  }): Promise<ApprovalRequest>;
}

export interface JournalVoucherApprovalSession {
  getVoucher(voucherId: string): Promise<JournalVoucher | null>;
  saveVoucher(voucher: JournalVoucher, expectedVersion: number): Promise<void>;
  getCurrentApprovalCycle(voucherId: string): Promise<JournalVoucherApprovalCycle | null>;
  saveApprovalCycle(cycle: JournalVoucherApprovalCycle): Promise<void>;
  closeApprovalCycle(approvalRequestId: string): Promise<void>;
  readonly approval: JournalVoucherApprovalGateway;
}

export interface JournalVoucherApprovalUnitOfWork {
  run<T>(work: (session: JournalVoucherApprovalSession) => Promise<T>): Promise<T>;
}

export interface JournalVoucherApprovalIntegrationDependencies {
  readonly unitOfWork: JournalVoucherApprovalUnitOfWork;
}

export interface JournalVoucherApprovalIntegrationResult {
  readonly voucher: JournalVoucher;
  readonly approvalRequest: ApprovalRequest;
  readonly cycle: JournalVoucherApprovalCycle;
}

export class JournalVoucherApprovalIntegrationError extends Error {
  constructor(
    readonly code:
      | "journal.not-found"
      | "journal.version-conflict"
      | "journal.approval-cycle-exists"
      | "journal.approval-cycle-missing"
      | "journal.approval-target-mismatch"
      | "journal.approval-status-mismatch"
      | "journal.approval-version-conflict",
    message: string,
  ) {
    super(message);
    this.name = "JournalVoucherApprovalIntegrationError";
  }
}

export async function submitJournalVoucherForApproval(
  command: SubmitJournalVoucherForApprovalCommand,
  dependencies: JournalVoucherApprovalIntegrationDependencies,
): Promise<JournalVoucherApprovalIntegrationResult> {
  return dependencies.unitOfWork.run(async (session) => {
    const voucher = await requireVoucher(
      session,
      command.voucherId,
      command.companyId,
    );
    assertVersion(voucher, command.expectedVersion);

    const currentCycle = await session.getCurrentApprovalCycle(voucher.id);
    if (currentCycle?.isCurrent) {
      throw new JournalVoucherApprovalIntegrationError(
        "journal.approval-cycle-exists",
        "برای این سند یک چرخه تأیید جاری وجود دارد.",
      );
    }

    const actorId = requireActorId(command.actor);
    const approvalRequest = await session.approval.createAndSubmit({
      requestType: JOURNAL_VOUCHER_APPROVAL_REQUEST_TYPE,
      title: `Journal Voucher ${voucher.number}`,
      description: voucher.description,
      target: {
        entityType: JOURNAL_VOUCHER_APPROVAL_TARGET_TYPE,
        entityId: voucher.id,
        entityDisplayName: voucher.number,
      },
      scope: {
        companyId: voucher.companyId,
        branchId: voucher.branchId,
        fiscalYearId: voucher.fiscalYearId,
      },
      actor: command.actor,
      correlationId: normalizeOptional(command.correlationId),
    });

    assertApprovalMatchesVoucher(approvalRequest, voucher);
    if (approvalRequest.status !== "pending") {
      throw new JournalVoucherApprovalIntegrationError(
        "journal.approval-status-mismatch",
        "درخواست تأیید ایجادشده باید در وضعیت pending باشد.",
      );
    }

    const transition = transitionJournalVoucher(voucher, {
      action: "submit_for_approval",
      actorId,
      occurredAt: command.occurredAt,
    });
    const cycle: JournalVoucherApprovalCycle = Object.freeze({
      approvalRequestId: approvalRequest.id,
      voucherId: voucher.id,
      submittedContentVersion: voucher.version,
      isCurrent: true,
    });

    await session.saveVoucher(transition.voucher, command.expectedVersion);
    await session.saveApprovalCycle(cycle);

    return Object.freeze({
      voucher: transition.voucher,
      approvalRequest,
      cycle,
    });
  });
}

export async function decideJournalVoucherApproval(
  command: DecideJournalVoucherApprovalCommand,
  dependencies: JournalVoucherApprovalIntegrationDependencies,
): Promise<JournalVoucherApprovalIntegrationResult> {
  return dependencies.unitOfWork.run(async (session) => {
    const voucher = await requireVoucher(
      session,
      command.voucherId,
      command.companyId,
    );
    assertVersion(voucher, command.expectedVoucherVersion);

    const cycle = await session.getCurrentApprovalCycle(voucher.id);
    if (!cycle?.isCurrent) {
      throw new JournalVoucherApprovalIntegrationError(
        "journal.approval-cycle-missing",
        "چرخه تأیید جاری برای سند پیدا نشد.",
      );
    }

    const approvalRequest = await session.approval.applyDecision({
      approvalRequestId: cycle.approvalRequestId,
      expectedVersion: command.expectedApprovalVersion,
      decision: command.decision,
      actor: command.actor,
      comment: normalizeOptional(command.comment),
      correlationId: normalizeOptional(command.correlationId),
    });

    assertApprovalMatchesVoucher(approvalRequest, voucher);
    assertApprovalDecisionStatus(command.decision, approvalRequest.status);

    const transition = transitionJournalVoucher(voucher, {
      action: lifecycleActionForDecision(command.decision),
      actorId: requireActorId(command.actor),
      occurredAt: command.occurredAt,
    });

    await session.saveVoucher(
      transition.voucher,
      command.expectedVoucherVersion,
    );

    const shouldRemainCurrent = command.decision === "approve";
    const updatedCycle: JournalVoucherApprovalCycle = Object.freeze({
      ...cycle,
      isCurrent: shouldRemainCurrent,
    });

    if (shouldRemainCurrent) {
      await session.saveApprovalCycle(updatedCycle);
    } else {
      await session.closeApprovalCycle(cycle.approvalRequestId);
    }

    return Object.freeze({
      voucher: transition.voucher,
      approvalRequest,
      cycle: updatedCycle,
    });
  });
}

export function assertCurrentApprovalForPosting(
  voucher: JournalVoucher,
  approvalRequest: ApprovalRequest,
  cycle: JournalVoucherApprovalCycle,
): void {
  if (!cycle.isCurrent || cycle.voucherId !== voucher.id) {
    throw new JournalVoucherApprovalIntegrationError(
      "journal.approval-cycle-missing",
      "تأیید جاری معتبر برای این سند وجود ندارد.",
    );
  }
  assertApprovalMatchesVoucher(approvalRequest, voucher);
  if (approvalRequest.id !== cycle.approvalRequestId || approvalRequest.status !== "approved") {
    throw new JournalVoucherApprovalIntegrationError(
      "journal.approval-status-mismatch",
      "درخواست تأیید جاری سند در وضعیت approved نیست.",
    );
  }
}

function lifecycleActionForDecision(
  decision: JournalVoucherApprovalDecision,
): JournalVoucherLifecycleAction {
  switch (decision) {
    case "approve":
      return "approval_approved";
    case "reject":
      return "approval_rejected";
    case "return-to-draft":
      return "approval_returned";
    case "cancel":
      return "approval_cancelled";
  }
}

function assertApprovalDecisionStatus(
  decision: JournalVoucherApprovalDecision,
  status: ApprovalRequest["status"],
): void {
  const expected = {
    approve: "approved",
    reject: "rejected",
    "return-to-draft": "draft",
    cancel: "cancelled",
  } as const;

  if (status !== expected[decision]) {
    throw new JournalVoucherApprovalIntegrationError(
      "journal.approval-status-mismatch",
      `نتیجه Approval با عملیات ${decision} سازگار نیست.`,
    );
  }
}

function assertApprovalMatchesVoucher(
  approval: ApprovalRequest,
  voucher: JournalVoucher,
): void {
  if (
    approval.requestType !== JOURNAL_VOUCHER_APPROVAL_REQUEST_TYPE ||
    approval.target.entityType !== JOURNAL_VOUCHER_APPROVAL_TARGET_TYPE ||
    approval.target.entityId !== voucher.id ||
    approval.scope.companyId !== voucher.companyId ||
    approval.scope.branchId !== voucher.branchId ||
    approval.scope.fiscalYearId !== voucher.fiscalYearId
  ) {
    throw new JournalVoucherApprovalIntegrationError(
      "journal.approval-target-mismatch",
      "درخواست تأیید با دامنه یا هویت سند حسابداری منطبق نیست.",
    );
  }
}

async function requireVoucher(
  session: JournalVoucherApprovalSession,
  voucherId: string,
  companyId: string,
): Promise<JournalVoucher> {
  const voucher = await session.getVoucher(voucherId);
  if (!voucher || voucher.companyId !== companyId) {
    throw new JournalVoucherApprovalIntegrationError(
      "journal.not-found",
      "سند حسابداری موردنظر پیدا نشد.",
    );
  }
  return voucher;
}

function assertVersion(voucher: JournalVoucher, expectedVersion: number): void {
  if (voucher.version !== expectedVersion) {
    throw new JournalVoucherApprovalIntegrationError(
      "journal.version-conflict",
      "نسخه سند حسابداری تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
    );
  }
}

function requireActorId(actor: ApprovalActor): string {
  const id = actor.id?.trim();
  if (!id) {
    throw new JournalVoucherApprovalIntegrationError(
      "journal.approval-target-mismatch",
      "عملیات چرخه تأیید سند حسابداری به عامل کاربری دارای شناسه نیاز دارد.",
    );
  }
  return id;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
