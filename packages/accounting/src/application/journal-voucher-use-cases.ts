import type { Account } from "../domain/account.ts";
import {
  createJournalVoucher,
  type JournalVoucher,
} from "../domain/journal-voucher.ts";
import { rehydrateJournalVoucher } from "../domain/rehydrate-journal-voucher.ts";
import { JournalVoucherValidationError } from "../domain/journal-voucher-validation-error.ts";
import type {
  JournalVoucherRuntimeDependencies,
  JournalVoucherUnitOfWorkRepositories,
} from "../contracts/journal-voucher-runtime.ts";
import {
  assertJournalVoucherEligibility,
  JournalVoucherEligibilityError,
  type JournalFiscalContext,
} from "../validation/journal-voucher-eligibility.ts";
import {
  assertValidJournalVoucherDimensions,
  JournalVoucherDimensionValidationError,
} from "../validation/journal-voucher-dimension-validation.ts";
import {
  reserveJournalVoucherNumber,
} from "./journal-voucher-numbering.ts";
import {
  JournalVoucherApplicationError,
} from "./journal-voucher-application-error.ts";
import type {
  CreateJournalVoucherCommand,
  DeleteJournalVoucherDraftCommand,
  JournalVoucherLineInput,
  UpdateJournalVoucherDraftCommand,
} from "./journal-voucher-contracts.ts";

const CREATE_PERMISSION = "accounting.journal-vouchers.create";
const UPDATE_DRAFT_PERMISSION = "accounting.journal-vouchers.update-draft";
const DELETE_DRAFT_PERMISSION = "accounting.journal-vouchers.delete-draft";

export interface JournalVoucherMutationResult {
  readonly voucher: JournalVoucher;
  readonly replayed: boolean;
}

export async function createJournalVoucherDraft(
  command: CreateJournalVoucherCommand,
  dependencies: JournalVoucherRuntimeDependencies,
): Promise<JournalVoucherMutationResult> {
  await assertAuthorized(dependencies, CREATE_PERMISSION);

  const requestId = normalizeOptionalIdentifier(command.context.requestId);
  if (requestId) {
    const replay = await dependencies.unitOfWork.run(({ journals }) =>
      journals.findByRequestId(command.context.companyId, requestId),
    );
    if (replay) return Object.freeze({ voucher: replay, replayed: true });
  }

  const fiscal = await resolveFiscalContext(
    dependencies,
    command.context.companyId,
    command.voucherDate,
  );
  const accounts = await loadEligibleAccounts(
    dependencies,
    command.context.companyId,
    command.voucherDate,
    fiscal,
    command.lines,
  );

  try {
    return await dependencies.unitOfWork.run(async ({ journals }) => {
      if (requestId) {
        const replay = await journals.findByRequestId(
          command.context.companyId,
          requestId,
        );
        if (replay) return Object.freeze({ voucher: replay, replayed: true });
      }

      const reserved = await reserveJournalVoucherNumber(
        dependencies.numberSeries,
        {
          companyId: command.context.companyId,
          ...(command.context.branchId === undefined
            ? {}
            : { branchId: command.context.branchId ?? undefined }),
          fiscalYearId: fiscal.fiscalYearId,
        },
      );
      const now = dependencies.clock.now().toISOString();
      const voucher = createJournalVoucher({
        id: dependencies.identifiers.generate(),
        companyId: command.context.companyId,
        branchId: command.context.branchId ?? null,
        number: reserved.voucherNumber,
        reference: command.reference,
        voucherDate: command.voucherDate,
        fiscalYearId: fiscal.fiscalYearId,
        fiscalPeriodId: fiscal.fiscalPeriodId,
        description: command.description,
        currency: command.currency,
        source: {
          type: command.sourceType ?? "manual",
          sourceId: command.sourceId ?? null,
          requestId,
          correlationId: normalizeOptionalIdentifier(command.context.correlationId),
          causationId: normalizeOptionalIdentifier(command.context.causationId),
        },
        lines: materializeLines(command.lines, dependencies),
        createdAt: now,
      });

      await validateDimensions(dependencies, voucher, accounts);
      await journals.create(voucher);
      return Object.freeze({ voucher, replayed: false });
    });
  } catch (error) {
    throw mapMutationError(error);
  }
}

export async function updateJournalVoucherDraft(
  command: UpdateJournalVoucherDraftCommand,
  dependencies: JournalVoucherRuntimeDependencies,
): Promise<JournalVoucherMutationResult> {
  await assertAuthorized(dependencies, UPDATE_DRAFT_PERMISSION);

  const existing = await dependencies.unitOfWork.run(({ journals }) =>
    journals.findById(command.voucherId),
  );
  assertOwnedVoucher(existing, command.context.companyId, command.voucherId);
  assertExpectedVersion(existing, command.expectedVersion);

  const fiscal = await resolveFiscalContext(
    dependencies,
    command.context.companyId,
    command.voucherDate,
  );
  const accounts = await loadEligibleAccounts(
    dependencies,
    command.context.companyId,
    command.voucherDate,
    fiscal,
    command.lines,
  );

  try {
    return await dependencies.unitOfWork.run(async ({ journals }) => {
      const current = await journals.findById(command.voucherId);
      assertOwnedVoucher(current, command.context.companyId, command.voucherId);
      assertExpectedVersion(current, command.expectedVersion);

      const updated = rehydrateJournalVoucher({
        id: current.id,
        companyId: current.companyId,
        branchId: current.branchId,
        number: current.number,
        reference: command.reference,
        voucherDate: command.voucherDate,
        fiscalYearId: fiscal.fiscalYearId,
        fiscalPeriodId: fiscal.fiscalPeriodId,
        description: command.description,
        currency: current.currency,
        source: current.source,
        lines: materializeLines(command.lines, dependencies),
        createdAt: current.createdAt,
        updatedAt: dependencies.clock.now().toISOString(),
        version: current.version + 1,
      });

      await validateDimensions(dependencies, updated, accounts);
      await journals.update(updated, command.expectedVersion);
      return Object.freeze({ voucher: updated, replayed: false });
    });
  } catch (error) {
    throw mapMutationError(error);
  }
}

export async function deleteJournalVoucherDraft(
  command: DeleteJournalVoucherDraftCommand,
  dependencies: JournalVoucherRuntimeDependencies,
): Promise<JournalVoucher> {
  await assertAuthorized(dependencies, DELETE_DRAFT_PERMISSION);

  try {
    return await dependencies.unitOfWork.run(async ({ journals }) => {
      const current = await journals.findById(command.voucherId);
      assertOwnedVoucher(current, command.context.companyId, command.voucherId);
      assertExpectedVersion(current, command.expectedVersion);
      await journals.deleteDraft(
        current.id,
        current.companyId,
        command.expectedVersion,
      );
      return current;
    });
  } catch (error) {
    throw mapMutationError(error);
  }
}

async function assertAuthorized(
  dependencies: JournalVoucherRuntimeDependencies,
  permission: string,
): Promise<void> {
  if (!(await dependencies.authorizer.hasPermission(permission))) {
    throw new JournalVoucherApplicationError(
      "journal.unauthorized",
      "شما مجوز انجام این عملیات روی سند حسابداری را ندارید.",
      { permission },
    );
  }
}

async function resolveFiscalContext(
  dependencies: JournalVoucherRuntimeDependencies,
  companyId: string,
  voucherDate: string,
): Promise<JournalFiscalContext> {
  const fiscal = await dependencies.fiscalContext.resolve(companyId, voucherDate);
  if (!fiscal) {
    throw new JournalVoucherApplicationError(
      "journal.fiscal-context-not-found",
      "سال یا دوره مالی معتبر برای تاریخ سند پیدا نشد.",
      { companyId, voucherDate },
    );
  }
  return fiscal;
}

async function loadEligibleAccounts(
  dependencies: JournalVoucherRuntimeDependencies,
  companyId: string,
  voucherDate: string,
  fiscal: JournalFiscalContext,
  lines: readonly JournalVoucherLineInput[],
): Promise<readonly Account[]> {
  const accountIds = [...new Set(lines.map(({ accountId }) => accountId.trim()))];
  const accounts: Account[] = [];
  for (const accountId of accountIds) {
    const account = await dependencies.accounts.findById(accountId);
    if (!account) {
      throw new JournalVoucherApplicationError(
        "journal.account-not-found",
        "حساب انتخاب‌شده برای یکی از سطرهای سند پیدا نشد.",
        { accountId },
      );
    }
    try {
      assertJournalVoucherEligibility({
        companyId,
        voucherDate,
        account,
        fiscal,
      });
    } catch (error) {
      if (error instanceof JournalVoucherEligibilityError) {
        throw new JournalVoucherApplicationError(
          "journal.validation-failed",
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
  dependencies: JournalVoucherRuntimeDependencies,
  voucher: JournalVoucher,
  accounts: readonly Account[],
): Promise<void> {
  const accountIds = accounts.map(({ id }) => id);
  const memberIds = [...new Set(voucher.lines.flatMap((line) =>
    line.dimensionAssignments.flatMap((assignment) => assignment.memberIds)
  ))];
  const [policies, dimensionTypes, members] = await Promise.all([
    dependencies.dimensions.findPoliciesForAccounts(voucher.companyId, accountIds),
    dependencies.dimensions.findTypesByCompanyId(voucher.companyId),
    dependencies.dimensions.findMembersByIds(memberIds),
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
      throw new JournalVoucherApplicationError(
        "journal.dimension-validation-failed",
        error.message,
        { issues: error.issues },
        { cause: error },
      );
    }
    throw error;
  }
}

function materializeLines(
  lines: readonly JournalVoucherLineInput[],
  dependencies: JournalVoucherRuntimeDependencies,
) {
  return lines.map((line) => ({
    id: normalizeOptionalIdentifier(line.id) ?? dependencies.identifiers.generate(),
    order: line.order,
    accountId: line.accountId,
    description: line.description,
    debit: line.debit,
    credit: line.credit,
    dimensionAssignments: line.dimensionAssignments,
  }));
}

function assertOwnedVoucher(
  voucher: JournalVoucher | null,
  companyId: string,
  voucherId: string,
): asserts voucher is JournalVoucher {
  if (!voucher || voucher.companyId !== companyId) {
    throw new JournalVoucherApplicationError(
      "journal.not-found",
      "سند حسابداری موردنظر پیدا نشد.",
      { voucherId, companyId },
    );
  }
}

function assertExpectedVersion(
  voucher: JournalVoucher,
  expectedVersion: number,
): void {
  if (voucher.version !== expectedVersion) {
    throw new JournalVoucherApplicationError(
      "journal.version-conflict",
      "سند حسابداری توسط عملیات دیگری تغییر کرده است. اطلاعات را تازه‌سازی کنید.",
      {
        voucherId: voucher.id,
        expectedVersion,
        actualVersion: voucher.version,
      },
    );
  }
}

function normalizeOptionalIdentifier(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function mapMutationError(error: unknown): unknown {
  if (error instanceof JournalVoucherApplicationError) return error;
  if (error instanceof JournalVoucherValidationError) {
    return new JournalVoucherApplicationError(
      "journal.validation-failed",
      error.message,
      { code: error.code, field: error.field },
      { cause: error },
    );
  }
  if (error instanceof Error && /concurr|version/i.test(`${error.name} ${error.message}`)) {
    return new JournalVoucherApplicationError(
      "journal.version-conflict",
      "سند حسابداری توسط عملیات دیگری تغییر کرده است. اطلاعات را تازه‌سازی کنید.",
      {},
      { cause: error },
    );
  }
  return error;
}
