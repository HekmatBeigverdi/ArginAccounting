import type { ApprovalRequest } from "@argin/audit";

import type { Account } from "../domain/account.ts";
import {
  transitionJournalVoucher,
  JournalVoucherLifecycleError,
} from "../domain/journal-voucher-lifecycle.ts";
import type { JournalVoucher } from "../domain/journal-voucher.ts";
import {
  assertValidJournalVoucherDimensions,
  JournalVoucherDimensionValidationError,
} from "../validation/journal-voucher-dimension-validation.ts";
import {
  assertJournalVoucherEligibility,
  JournalVoucherEligibilityError,
  type JournalFiscalContext,
} from "../validation/journal-voucher-eligibility.ts";
import type {
  JournalVoucherAccountReader,
  JournalVoucherDimensionReader,
  JournalVoucherFiscalContextReader,
} from "../contracts/journal-voucher-runtime.ts";
import {
  assertCurrentApprovalForPosting,
  type JournalVoucherApprovalCycle,
} from "./journal-voucher-approval-integration.ts";

export interface PostJournalVoucherCommand {
  readonly voucherId: string;
  readonly companyId: string;
  readonly expectedVersion: number;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly postingReference?: string | null;
}

export interface JournalVoucherPostingEvidence {
  readonly voucherId: string;
  readonly approvalRequestId: string;
  readonly submittedContentVersion: number;
  readonly postedVersion: number;
  readonly postedBy: string;
  readonly postedAt: string;
  readonly postingReference: string | null;
}

export interface JournalVoucherPostingSession {
  getVoucher(voucherId: string): Promise<JournalVoucher | null>;
  getCurrentApprovalCycle(voucherId: string): Promise<JournalVoucherApprovalCycle | null>;
  getApprovalRequest(approvalRequestId: string): Promise<ApprovalRequest | null>;
  savePostedVoucher(
    voucher: JournalVoucher,
    expectedVersion: number,
    evidence: JournalVoucherPostingEvidence,
  ): Promise<void>;
}

export interface JournalVoucherPostingUnitOfWork {
  run<T>(work: (session: JournalVoucherPostingSession) => Promise<T>): Promise<T>;
}

export interface JournalVoucherPostingDependencies {
  readonly accounts: JournalVoucherAccountReader;
  readonly fiscalContext: JournalVoucherFiscalContextReader;
  readonly dimensions: JournalVoucherDimensionReader;
  readonly unitOfWork: JournalVoucherPostingUnitOfWork;
}

export interface JournalVoucherPostingResult {
  readonly voucher: JournalVoucher;
  readonly evidence: JournalVoucherPostingEvidence;
}

export type JournalVoucherPostingErrorCode =
  | "journal.not-found"
  | "journal.version-conflict"
  | "journal.not-approved"
  | "journal.approval-missing"
  | "journal.approval-content-version-mismatch"
  | "journal.fiscal-context-not-found"
  | "journal.posting-validation-failed"
  | "journal.posting-reference-invalid";

export class JournalVoucherPostingError extends Error {
  constructor(
    readonly code: JournalVoucherPostingErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = Object.freeze({}),
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "JournalVoucherPostingError";
  }
}

export async function postJournalVoucher(
  command: PostJournalVoucherCommand,
  dependencies: JournalVoucherPostingDependencies,
): Promise<JournalVoucherPostingResult> {
  return dependencies.unitOfWork.run(async (session) => {
    const voucher = await session.getVoucher(command.voucherId);
    if (!voucher || voucher.companyId !== command.companyId) {
      throw new JournalVoucherPostingError(
        "journal.not-found",
        "سند حسابداری موردنظر پیدا نشد.",
      );
    }

    if (voucher.version !== command.expectedVersion) {
      throw new JournalVoucherPostingError(
        "journal.version-conflict",
        "سند حسابداری توسط عملیات دیگری تغییر کرده است. اطلاعات را تازه‌سازی کنید.",
        {
          expectedVersion: command.expectedVersion,
          actualVersion: voucher.version,
        },
      );
    }

    if (voucher.status !== "approved") {
      throw new JournalVoucherPostingError(
        "journal.not-approved",
        "فقط سند تأییدشده قابل ثبت نهایی است.",
        { status: voucher.status },
      );
    }

    const cycle = await session.getCurrentApprovalCycle(voucher.id);
    if (!cycle?.isCurrent) {
      throw new JournalVoucherPostingError(
        "journal.approval-missing",
        "تأیید جاری معتبر برای ثبت نهایی سند وجود ندارد.",
      );
    }

    const approvalRequest = await session.getApprovalRequest(cycle.approvalRequestId);
    if (!approvalRequest) {
      throw new JournalVoucherPostingError(
        "journal.approval-missing",
        "درخواست تأیید جاری سند پیدا نشد.",
      );
    }

    try {
      assertCurrentApprovalForPosting(voucher, approvalRequest, cycle);
    } catch (error) {
      throw new JournalVoucherPostingError(
        "journal.approval-missing",
        "مدرک تأیید جاری سند برای ثبت نهایی معتبر نیست.",
        {},
        { cause: error },
      );
    }

    // In the accepted lifecycle, submit and approve are the only two state
    // transitions between the submitted content version and an approved
    // voucher. Any additional version change means the approval cannot be
    // treated as evidence for the exact submitted content.
    const expectedApprovedVersion = cycle.submittedContentVersion + 2;
    if (voucher.version !== expectedApprovedVersion) {
      throw new JournalVoucherPostingError(
        "journal.approval-content-version-mismatch",
        "نسخه سند با محتوای تأییدشده منطبق نیست و باید دوباره تأیید شود.",
        {
          submittedContentVersion: cycle.submittedContentVersion,
          expectedApprovedVersion,
          actualVersion: voucher.version,
        },
      );
    }

    await revalidateForFinalPosting(voucher, dependencies);

    let transition;
    try {
      transition = transitionJournalVoucher(voucher, {
        action: "post",
        actorId: command.actorId,
        occurredAt: command.occurredAt,
      });
    } catch (error) {
      if (error instanceof JournalVoucherLifecycleError) {
        throw new JournalVoucherPostingError(
          "journal.not-approved",
          error.message,
          { lifecycleCode: error.code },
          { cause: error },
        );
      }
      throw error;
    }

    const evidence: JournalVoucherPostingEvidence = Object.freeze({
      voucherId: voucher.id,
      approvalRequestId: approvalRequest.id,
      submittedContentVersion: cycle.submittedContentVersion,
      postedVersion: transition.voucher.version,
      postedBy: command.actorId.trim(),
      postedAt: transition.evidence.occurredAt,
      postingReference: normalizePostingReference(command.postingReference),
    });

    await session.savePostedVoucher(
      transition.voucher,
      command.expectedVersion,
      evidence,
    );

    return Object.freeze({
      voucher: transition.voucher,
      evidence,
    });
  });
}

export function assertJournalVoucherAccountingFactsMutable(
  voucher: JournalVoucher,
): void {
  if (voucher.status === "posted" || voucher.status === "reversed") {
    throw new JournalVoucherPostingError(
      "journal.posting-validation-failed",
      "اطلاعات حسابداری سند ثبت نهایی‌شده یا برگشت‌شده قابل ویرایش یا حذف مستقیم نیست.",
      { status: voucher.status },
    );
  }
}

async function revalidateForFinalPosting(
  voucher: JournalVoucher,
  dependencies: Pick<
    JournalVoucherPostingDependencies,
    "accounts" | "fiscalContext" | "dimensions"
  >,
): Promise<void> {
  assertDoubleEntryStillBalanced(voucher);

  const fiscal = await dependencies.fiscalContext.resolve(
    voucher.companyId,
    voucher.voucherDate,
  );
  if (!fiscal) {
    throw new JournalVoucherPostingError(
      "journal.fiscal-context-not-found",
      "سال یا دوره مالی معتبر برای تاریخ سند پیدا نشد.",
    );
  }

  assertFiscalIdentity(voucher, fiscal);
  const accounts = await loadAndValidateAccounts(voucher, fiscal, dependencies.accounts);
  await validateDimensions(voucher, accounts, dependencies.dimensions);
}

function assertDoubleEntryStillBalanced(voucher: JournalVoucher): void {
  if (
    voucher.totalDebit.currency !== voucher.totalCredit.currency ||
    voucher.totalDebit.amount <= 0 ||
    voucher.totalDebit.amount !== voucher.totalCredit.amount ||
    voucher.lines.length < 2
  ) {
    throw new JournalVoucherPostingError(
      "journal.posting-validation-failed",
      "سند برای ثبت نهایی باید حداقل دو سطر مؤثر و جمع بدهکار و بستانکار برابر داشته باشد.",
    );
  }
}

function assertFiscalIdentity(
  voucher: JournalVoucher,
  fiscal: JournalFiscalContext,
): void {
  if (
    fiscal.fiscalYearId !== voucher.fiscalYearId ||
    fiscal.fiscalPeriodId !== voucher.fiscalPeriodId
  ) {
    throw new JournalVoucherPostingError(
      "journal.posting-validation-failed",
      "سال یا دوره مالی جاری با دامنه ثبت‌شده سند منطبق نیست.",
      {
        voucherFiscalYearId: voucher.fiscalYearId,
        resolvedFiscalYearId: fiscal.fiscalYearId,
        voucherFiscalPeriodId: voucher.fiscalPeriodId,
        resolvedFiscalPeriodId: fiscal.fiscalPeriodId,
      },
    );
  }
}

async function loadAndValidateAccounts(
  voucher: JournalVoucher,
  fiscal: JournalFiscalContext,
  reader: JournalVoucherAccountReader,
): Promise<readonly Account[]> {
  const accountIds = [...new Set(voucher.lines.map((line) => line.accountId))];
  const accounts: Account[] = [];

  for (const accountId of accountIds) {
    const account = await reader.findById(accountId);
    if (!account) {
      throw new JournalVoucherPostingError(
        "journal.posting-validation-failed",
        "یکی از حساب‌های سند برای ثبت نهایی پیدا نشد.",
        { accountId },
      );
    }

    try {
      assertJournalVoucherEligibility({
        companyId: voucher.companyId,
        voucherDate: voucher.voucherDate,
        account,
        fiscal,
      });
    } catch (error) {
      if (error instanceof JournalVoucherEligibilityError) {
        throw new JournalVoucherPostingError(
          "journal.posting-validation-failed",
          error.message,
          { accountId, issues: error.issues },
          { cause: error },
        );
      }
      throw error;
    }
    accounts.push(account);
  }

  return Object.freeze(accounts);
}

async function validateDimensions(
  voucher: JournalVoucher,
  accounts: readonly Account[],
  reader: JournalVoucherDimensionReader,
): Promise<void> {
  const accountIds = accounts.map((account) => account.id);
  const memberIds = [...new Set(voucher.lines.flatMap((line) =>
    line.dimensionAssignments.flatMap((assignment) => assignment.memberIds)
  ))];

  const [policies, dimensionTypes, members] = await Promise.all([
    reader.findPoliciesForAccounts(voucher.companyId, accountIds),
    reader.findTypesByCompanyId(voucher.companyId),
    reader.findMembersByIds(memberIds),
  ]);

  try {
    assertValidJournalVoucherDimensions({
      voucher,
      policies,
      dimensionTypes,
      members,
    });
  } catch (error) {
    if (error instanceof JournalVoucherDimensionValidationError) {
      throw new JournalVoucherPostingError(
        "journal.posting-validation-failed",
        error.message,
        { issues: error.issues },
        { cause: error },
      );
    }
    throw error;
  }
}

function normalizePostingReference(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > 128) {
    throw new JournalVoucherPostingError(
      "journal.posting-reference-invalid",
      "شناسه مرجع ثبت نهایی نمی‌تواند بیش از ۱۲۸ نویسه باشد.",
    );
  }
  return normalized;
}
