import type {
  FiscalPeriodRepository
} from "../contracts/fiscal-period-repository";

import type {
  HistoricalLockRepository
} from "../contracts/historical-lock-repository";

import type {
  HistoricalLockScope
} from "../domain/historical-lock";

import {
  FiscalValidationError
} from "../validation/fiscal-validation-error";

import {
  compareIsoDates,
  isIsoDate
} from "../validation/iso-date";

export interface ValidateOperationDateInput {
  companyId: string;
  branchId: string | null;
  fiscalYearId: string;
  operationDate: string;
  scope: HistoricalLockScope;
}

export async function validateOperationDate(
  fiscalPeriods: FiscalPeriodRepository,
  historicalLocks: HistoricalLockRepository,
  input: ValidateOperationDateInput
): Promise<void> {
  if (!isIsoDate(input.operationDate)) {
    throw new FiscalValidationError([
      {
        field: "operationDate",
        message: "تاریخ عملیات معتبر نیست."
      }
    ]);
  }

  const period = await fiscalPeriods.findByDate(
    input.fiscalYearId,
    input.operationDate
  );

  if (period === null) {
    throw new FiscalValidationError([
      {
        field: "operationDate",
        message:
          "تاریخ عملیات در هیچ دوره مالی تعریف‌شده‌ای قرار ندارد."
      }
    ]);
  }

  if (period.status === "locked") {
    throw new FiscalValidationError([
      {
        field: "operationDate",
        message:
          "دوره مالی مربوط به این تاریخ قفل شده است."
      }
    ]);
  }

  if (period.status === "closed") {
    throw new FiscalValidationError([
      {
        field: "operationDate",
        message:
          "دوره مالی مربوط به این تاریخ بسته شده است."
      }
    ]);
  }

  const locks =
    await historicalLocks.findActiveLocks(
      input.companyId,
      input.branchId,
      input.scope
    );

  const blockingLock = locks.find((lock) => {
    return (
      compareIsoDates(
        input.operationDate,
        lock.lockedThroughDate
      ) <= 0
    );
  });

  if (blockingLock) {
    throw new FiscalValidationError([
      {
        field: "operationDate",
        message:
          `عملیات تا تاریخ ${blockingLock.lockedThroughDate} قفل شده است.`
      }
    ]);
  }
}
