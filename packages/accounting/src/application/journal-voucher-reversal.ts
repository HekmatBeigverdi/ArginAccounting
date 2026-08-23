import type { NumberSeries } from "@argin/platform";

import type { Account } from "../domain/account.ts";
import {
  createJournalVoucher,
  type JournalVoucher,
} from "../domain/journal-voucher.ts";
import {
  transitionJournalVoucher,
  JournalVoucherLifecycleError,
} from "../domain/journal-voucher-lifecycle.ts";
import {
  assertJournalVoucherEligibility,
  JournalVoucherEligibilityError,
  type JournalFiscalContext,
} from "../validation/journal-voucher-eligibility.ts";
import {
  assertValidJournalVoucherDimensions,
  JournalVoucherDimensionValidationError,
} from "../validation/journal-voucher-dimension-validation.ts";
import type {
  JournalVoucherAccountReader,
  JournalVoucherDimensionReader,
  JournalVoucherFiscalContextReader,
  JournalVoucherIdentifierGenerator,
} from "../contracts/journal-voucher-runtime.ts";
import { reserveJournalVoucherNumber } from "./journal-voucher-numbering.ts";

export interface ReverseJournalVoucherCommand {
  readonly originalVoucherId: string;
  readonly companyId: string;
  readonly expectedVersion: number;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly reversalDate: string;
  readonly requestId: string;
  readonly correlationId?: string | null;
  readonly causationId?: string | null;
  readonly reason: string;
  readonly replacementVoucherId?: string | null;
}

export interface JournalVoucherReversalLineage {
  readonly originalVoucherId: string;
  readonly reversalVoucherId: string;
  readonly replacementVoucherId: string | null;
  readonly requestId: string;
  readonly reversedBy: string;
  readonly reversedAt: string;
  readonly reason: string;
}

export interface JournalVoucherReversalRecord {
  readonly originalVoucher: JournalVoucher;
  readonly reversalVoucher: JournalVoucher;
  readonly lineage: JournalVoucherReversalLineage;
}

export interface JournalVoucherReversalResult extends JournalVoucherReversalRecord {
  readonly replayed: boolean;
}

export interface JournalVoucherReversalSession {
  getVoucher(voucherId: string): Promise<JournalVoucher | null>;
  getReversalByRequestId(
    companyId: string,
    requestId: string,
  ): Promise<JournalVoucherReversalRecord | null>;
  getReversalLineageByOriginalVoucherId(
    originalVoucherId: string,
  ): Promise<JournalVoucherReversalLineage | null>;
  saveReversal(input: {
    readonly originalVoucher: JournalVoucher;
    readonly expectedOriginalVersion: number;
    readonly reversalVoucher: JournalVoucher;
    readonly lineage: JournalVoucherReversalLineage;
  }): Promise<void>;
}

export interface JournalVoucherReversalUnitOfWork {
  run<T>(work: (session: JournalVoucherReversalSession) => Promise<T>): Promise<T>;
}

export interface JournalVoucherReversalDependencies {
  readonly accounts: JournalVoucherAccountReader;
  readonly fiscalContext: JournalVoucherFiscalContextReader;
  readonly dimensions: JournalVoucherDimensionReader;
  readonly identifiers: JournalVoucherIdentifierGenerator;
  readonly numberSeries: NumberSeries;
  readonly unitOfWork: JournalVoucherReversalUnitOfWork;
}

export type JournalVoucherReversalErrorCode =
  | "journal.not-found"
  | "journal.version-conflict"
  | "journal.not-posted"
  | "journal.already-reversed"
  | "journal.reversal-idempotency-conflict"
  | "journal.reversal-request-id-required"
  | "journal.reversal-reason-required"
  | "journal.reversal-fiscal-context-not-found"
  | "journal.reversal-validation-failed"
  | "journal.replacement-invalid";

export class JournalVoucherReversalError extends Error {
  constructor(
    readonly code: JournalVoucherReversalErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = Object.freeze({}),
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "JournalVoucherReversalError";
  }
}

export async function reverseJournalVoucher(
  command: ReverseJournalVoucherCommand,
  dependencies: JournalVoucherReversalDependencies,
): Promise<JournalVoucherReversalResult> {
  const requestId = requireIdentifier(
    command.requestId,
    "journal.reversal-request-id-required",
    "شناسه درخواست برگشت سند الزامی است.",
  );
  const actorId = requireIdentifier(
    command.actorId,
    "journal.reversal-validation-failed",
    "عامل برگشت سند الزامی است.",
  );
  const reason = normalizeReason(command.reason);

  const replay = await dependencies.unitOfWork.run((session) =>
    session.getReversalByRequestId(command.companyId, requestId),
  );
  if (replay) {
    if (replay.lineage.originalVoucherId !== command.originalVoucherId) {
      throw new JournalVoucherReversalError(
        "journal.reversal-idempotency-conflict",
        "شناسه درخواست برگشت قبلاً برای سند دیگری استفاده شده است.",
      );
    }
    return Object.freeze({ ...replay, replayed: true });
  }

  const original = await dependencies.unitOfWork.run((session) =>
    session.getVoucher(command.originalVoucherId),
  );
  assertOwnedOriginal(original, command.companyId, command.originalVoucherId);
  assertExpectedVersion(original, command.expectedVersion);
  if (original.status !== "posted") {
    throw new JournalVoucherReversalError(
      original.status === "reversed" ? "journal.already-reversed" : "journal.not-posted",
      original.status === "reversed"
        ? "سند حسابداری قبلاً برگشت شده است."
        : "فقط سند ثبت‌نهایی‌شده قابل برگشت است.",
      { status: original.status },
    );
  }

  const fiscal = await dependencies.fiscalContext.resolve(
    original.companyId,
    command.reversalDate,
  );
  if (!fiscal) {
    throw new JournalVoucherReversalError(
      "journal.reversal-fiscal-context-not-found",
      "سال یا دوره مالی معتبر برای تاریخ برگشت سند پیدا نشد.",
    );
  }

  await validateReversalEligibility(original, command.reversalDate, fiscal, dependencies);
  const replacementVoucherId = await validateReplacement(
    command.replacementVoucherId,
    original,
    dependencies.unitOfWork,
  );

  const reserved = await reserveJournalVoucherNumber(dependencies.numberSeries, {
    companyId: original.companyId,
    branchId: original.branchId,
    fiscalYearId: fiscal.fiscalYearId,
  });

  const reversalId = dependencies.identifiers.generate();
  const createdAt = normalizeTimestamp(command.occurredAt);
  const draftReversal = createJournalVoucher({
    id: reversalId,
    companyId: original.companyId,
    branchId: original.branchId,
    number: reserved.formattedValue,
    reference: `REV:${original.number}`,
    voucherDate: command.reversalDate,
    fiscalYearId: fiscal.fiscalYearId,
    fiscalPeriodId: fiscal.fiscalPeriodId,
    description: `برگشت سند ${original.number} — ${reason}`,
    currency: original.currency,
    source: {
      type: "system",
      sourceId: original.id,
      requestId,
      correlationId: normalizeOptional(command.correlationId),
      causationId: normalizeOptional(command.causationId),
    },
    lines: original.lines.map((line) => ({
      id: dependencies.identifiers.generate(),
      order: line.order,
      accountId: line.accountId,
      description: line.description,
      debit: line.credit.amount,
      credit: line.debit.amount,
      dimensionAssignments: line.dimensionAssignments,
    })),
    createdAt,
  });

  const reversalVoucher: JournalVoucher = Object.freeze({
    ...draftReversal,
    status: "posted",
    updatedAt: createdAt,
  });

  // The inverse voucher is generated from the immutable posted original, but
  // current account/dimension/fiscal rules are still authoritative at the
  // reversal date.
  await validateReversalVoucher(reversalVoucher, fiscal, dependencies);

  let originalTransition;
  try {
    originalTransition = transitionJournalVoucher(original, {
      action: "reverse",
      actorId,
      occurredAt: createdAt,
    });
  } catch (error) {
    if (error instanceof JournalVoucherLifecycleError) {
      throw new JournalVoucherReversalError(
        "journal.not-posted",
        error.message,
        { lifecycleCode: error.code },
        { cause: error },
      );
    }
    throw error;
  }

  const lineage: JournalVoucherReversalLineage = Object.freeze({
    originalVoucherId: original.id,
    reversalVoucherId: reversalVoucher.id,
    replacementVoucherId,
    requestId,
    reversedBy: actorId,
    reversedAt: originalTransition.evidence.occurredAt,
    reason,
  });

  return dependencies.unitOfWork.run(async (session) => {
    const existingByRequest = await session.getReversalByRequestId(
      command.companyId,
      requestId,
    );
    if (existingByRequest) {
      if (existingByRequest.lineage.originalVoucherId !== original.id) {
        throw new JournalVoucherReversalError(
          "journal.reversal-idempotency-conflict",
          "شناسه درخواست برگشت قبلاً برای سند دیگری استفاده شده است.",
        );
      }
      return Object.freeze({ ...existingByRequest, replayed: true });
    }

    const current = await session.getVoucher(original.id);
    assertOwnedOriginal(current, command.companyId, original.id);
    assertExpectedVersion(current, command.expectedVersion);
    if (current.status !== "posted") {
      throw new JournalVoucherReversalError(
        current.status === "reversed" ? "journal.already-reversed" : "journal.not-posted",
        "سند دیگر در وضعیت قابل برگشت نیست.",
        { status: current.status },
      );
    }

    const existingLineage = await session.getReversalLineageByOriginalVoucherId(original.id);
    if (existingLineage) {
      throw new JournalVoucherReversalError(
        "journal.already-reversed",
        "برای این سند قبلاً سند برگشت ثبت شده است.",
        { reversalVoucherId: existingLineage.reversalVoucherId },
      );
    }

    await session.saveReversal({
      originalVoucher: originalTransition.voucher,
      expectedOriginalVersion: command.expectedVersion,
      reversalVoucher,
      lineage,
    });

    return Object.freeze({
      originalVoucher: originalTransition.voucher,
      reversalVoucher,
      lineage,
      replayed: false,
    });
  });
}

async function validateReversalEligibility(
  original: JournalVoucher,
  reversalDate: string,
  fiscal: JournalFiscalContext,
  dependencies: Pick<
    JournalVoucherReversalDependencies,
    "accounts" | "dimensions"
  >,
): Promise<void> {
  const synthetic: JournalVoucher = Object.freeze({
    ...original,
    voucherDate: reversalDate,
    fiscalYearId: fiscal.fiscalYearId,
    fiscalPeriodId: fiscal.fiscalPeriodId,
  });
  const accounts = await loadAndValidateAccounts(synthetic, fiscal, dependencies.accounts);
  await validateDimensions(synthetic, accounts, dependencies.dimensions);
}

async function validateReversalVoucher(
  voucher: JournalVoucher,
  fiscal: JournalFiscalContext,
  dependencies: Pick<
    JournalVoucherReversalDependencies,
    "accounts" | "dimensions"
  >,
): Promise<void> {
  if (
    voucher.totalDebit.amount <= 0 ||
    voucher.totalDebit.amount !== voucher.totalCredit.amount ||
    voucher.totalDebit.amount !== voucher.lines.reduce((sum, line) => sum + line.debit.amount, 0)
  ) {
    throw new JournalVoucherReversalError(
      "journal.reversal-validation-failed",
      "سند برگشت باید دقیقاً متوازن و معکوس اثر حسابداری سند اصلی باشد.",
    );
  }
  const accounts = await loadAndValidateAccounts(voucher, fiscal, dependencies.accounts);
  await validateDimensions(voucher, accounts, dependencies.dimensions);
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
      throw new JournalVoucherReversalError(
        "journal.reversal-validation-failed",
        "یکی از حساب‌های سند برای برگشت پیدا نشد.",
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
        throw new JournalVoucherReversalError(
          "journal.reversal-validation-failed",
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
      throw new JournalVoucherReversalError(
        "journal.reversal-validation-failed",
        error.message,
        { issues: error.issues },
        { cause: error },
      );
    }
    throw error;
  }
}

async function validateReplacement(
  value: string | null | undefined,
  original: JournalVoucher,
  unitOfWork: JournalVoucherReversalUnitOfWork,
): Promise<string | null> {
  const replacementId = normalizeOptional(value);
  if (!replacementId) return null;
  if (replacementId === original.id) {
    throw new JournalVoucherReversalError(
      "journal.replacement-invalid",
      "سند اصلی نمی‌تواند به‌عنوان سند جایگزین خودش ثبت شود.",
    );
  }
  const replacement = await unitOfWork.run((session) => session.getVoucher(replacementId));
  if (!replacement || replacement.companyId !== original.companyId) {
    throw new JournalVoucherReversalError(
      "journal.replacement-invalid",
      "سند جایگزین معتبر در همان شرکت پیدا نشد.",
    );
  }
  if (replacement.status === "reversed") {
    throw new JournalVoucherReversalError(
      "journal.replacement-invalid",
      "سند برگشت‌شده نمی‌تواند سند جایگزین باشد.",
    );
  }
  return replacement.id;
}

function assertOwnedOriginal(
  voucher: JournalVoucher | null,
  companyId: string,
  voucherId: string,
): asserts voucher is JournalVoucher {
  if (!voucher || voucher.companyId !== companyId) {
    throw new JournalVoucherReversalError(
      "journal.not-found",
      "سند حسابداری موردنظر پیدا نشد.",
      { voucherId, companyId },
    );
  }
}

function assertExpectedVersion(voucher: JournalVoucher, expectedVersion: number): void {
  if (voucher.version !== expectedVersion) {
    throw new JournalVoucherReversalError(
      "journal.version-conflict",
      "نسخه سند حسابداری تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
      { expectedVersion, actualVersion: voucher.version },
    );
  }
}

function normalizeReason(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > 500) {
    throw new JournalVoucherReversalError(
      "journal.reversal-reason-required",
      "دلیل برگشت سند باید بین ۱ تا ۵۰۰ نویسه باشد.",
    );
  }
  return normalized;
}

function requireIdentifier(
  value: string,
  code: JournalVoucherReversalErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 128) {
    throw new JournalVoucherReversalError(code, message);
  }
  return normalized;
}

function normalizeTimestamp(value: string): string {
  const normalized = value.trim();
  const date = new Date(normalized);
  if (normalized.length === 0 || Number.isNaN(date.getTime())) {
    throw new JournalVoucherReversalError(
      "journal.reversal-validation-failed",
      "زمان برگشت سند معتبر نیست.",
    );
  }
  return date.toISOString();
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
