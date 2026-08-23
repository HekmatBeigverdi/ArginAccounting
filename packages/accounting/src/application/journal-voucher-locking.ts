import type { ApprovalActor } from "@argin/audit";

import {
  transitionJournalVoucher,
  JournalVoucherLifecycleError,
} from "../domain/journal-voucher-lifecycle.ts";
import type { JournalVoucher } from "../domain/journal-voucher.ts";
import type {
  JournalVoucherApprovalCycle,
} from "./journal-voucher-approval-integration.ts";

export type JournalVoucherLockReason =
  | "approval_pending"
  | "approved"
  | "posted"
  | "reversed";

export type JournalVoucherLockingErrorCode =
  | "journal.not-found"
  | "journal.version-conflict"
  | "journal.locked"
  | "journal.amendment-not-allowed"
  | "journal.approval-cycle-missing"
  | "journal.amendment-reason-required";

export class JournalVoucherLockingError extends Error {
  constructor(
    readonly code: JournalVoucherLockingErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = Object.freeze({}),
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "JournalVoucherLockingError";
  }
}

export interface JournalVoucherAmendmentEvidence {
  readonly voucherId: string;
  readonly approvalRequestId: string;
  readonly previousVersion: number;
  readonly reopenedVersion: number;
  readonly reopenedBy: string;
  readonly reopenedAt: string;
  readonly reason: string;
}

export interface ReopenApprovedJournalVoucherForAmendmentCommand {
  readonly voucherId: string;
  readonly companyId: string;
  readonly expectedVersion: number;
  readonly actor: ApprovalActor;
  readonly occurredAt: string;
  readonly reason: string;
}

export interface JournalVoucherAmendmentSession {
  getVoucher(voucherId: string): Promise<JournalVoucher | null>;
  saveVoucher(voucher: JournalVoucher, expectedVersion: number): Promise<void>;
  getCurrentApprovalCycle(voucherId: string): Promise<JournalVoucherApprovalCycle | null>;
  closeApprovalCycle(approvalRequestId: string): Promise<void>;
  saveAmendmentEvidence(evidence: JournalVoucherAmendmentEvidence): Promise<void>;
}

export interface JournalVoucherAmendmentUnitOfWork {
  run<T>(work: (session: JournalVoucherAmendmentSession) => Promise<T>): Promise<T>;
}

export interface JournalVoucherAmendmentDependencies {
  readonly unitOfWork: JournalVoucherAmendmentUnitOfWork;
}

export interface JournalVoucherAmendmentResult {
  readonly voucher: JournalVoucher;
  readonly evidence: JournalVoucherAmendmentEvidence;
}

export function isJournalVoucherEditable(voucher: JournalVoucher): boolean {
  return voucher.status === "draft";
}

export function getJournalVoucherLockReason(
  voucher: JournalVoucher,
): JournalVoucherLockReason | null {
  switch (voucher.status) {
    case "draft":
      return null;
    case "pending_approval":
      return "approval_pending";
    case "approved":
      return "approved";
    case "posted":
      return "posted";
    case "reversed":
      return "reversed";
  }
}

export function assertJournalVoucherDraftEditable(voucher: JournalVoucher): void {
  const lockReason = getJournalVoucherLockReason(voucher);
  if (lockReason === null) return;

  throw new JournalVoucherLockingError(
    "journal.locked",
    "ویرایش یا حذف عادی سند فقط در وضعیت پیش‌نویس مجاز است.",
    {
      status: voucher.status,
      lockReason,
    },
  );
}

export async function reopenApprovedJournalVoucherForAmendment(
  command: ReopenApprovedJournalVoucherForAmendmentCommand,
  dependencies: JournalVoucherAmendmentDependencies,
): Promise<JournalVoucherAmendmentResult> {
  return dependencies.unitOfWork.run(async (session) => {
    const voucher = await session.getVoucher(command.voucherId);
    if (!voucher || voucher.companyId !== command.companyId) {
      throw new JournalVoucherLockingError(
        "journal.not-found",
        "سند حسابداری موردنظر پیدا نشد.",
      );
    }

    if (voucher.version !== command.expectedVersion) {
      throw new JournalVoucherLockingError(
        "journal.version-conflict",
        "نسخه سند حسابداری تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
        {
          expectedVersion: command.expectedVersion,
          actualVersion: voucher.version,
        },
      );
    }

    if (voucher.status !== "approved") {
      throw new JournalVoucherLockingError(
        "journal.amendment-not-allowed",
        "فقط سند تأییدشده و ثبت‌نهایی‌نشده از مسیر اصلاح کنترل‌شده قابل بازگشایی است.",
        { status: voucher.status },
      );
    }

    const reason = normalizeAmendmentReason(command.reason);
    const actorId = command.actor.id?.trim();
    if (!actorId) {
      throw new JournalVoucherLockingError(
        "journal.amendment-not-allowed",
        "بازگشایی سند برای اصلاح به عامل کاربری دارای شناسه نیاز دارد.",
      );
    }

    const cycle = await session.getCurrentApprovalCycle(voucher.id);
    if (!cycle?.isCurrent) {
      throw new JournalVoucherLockingError(
        "journal.approval-cycle-missing",
        "چرخه تأیید جاری سند برای بازگشایی کنترل‌شده پیدا نشد.",
      );
    }

    let transition;
    try {
      transition = transitionJournalVoucher(voucher, {
        action: "reopen_for_amendment",
        actorId,
        occurredAt: command.occurredAt,
      });
    } catch (error) {
      if (error instanceof JournalVoucherLifecycleError) {
        throw new JournalVoucherLockingError(
          "journal.amendment-not-allowed",
          error.message,
          { lifecycleCode: error.code },
          { cause: error },
        );
      }
      throw error;
    }

    const evidence: JournalVoucherAmendmentEvidence = Object.freeze({
      voucherId: voucher.id,
      approvalRequestId: cycle.approvalRequestId,
      previousVersion: voucher.version,
      reopenedVersion: transition.voucher.version,
      reopenedBy: actorId,
      reopenedAt: transition.evidence.occurredAt,
      reason,
    });

    await session.saveVoucher(transition.voucher, command.expectedVersion);
    await session.closeApprovalCycle(cycle.approvalRequestId);
    await session.saveAmendmentEvidence(evidence);

    return Object.freeze({
      voucher: transition.voucher,
      evidence,
    });
  });
}

function normalizeAmendmentReason(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    throw new JournalVoucherLockingError(
      "journal.amendment-reason-required",
      "دلیل بازگشایی سند برای اصلاح الزامی است.",
    );
  }
  if (normalized.length > 500) {
    throw new JournalVoucherLockingError(
      "journal.amendment-reason-required",
      "دلیل بازگشایی سند نمی‌تواند بیشتر از ۵۰۰ نویسه باشد.",
    );
  }
  return normalized;
}
