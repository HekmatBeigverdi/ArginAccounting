import type {
  CreateFiscalYearInput
} from "../domain/fiscal-year";

import type {
  FiscalUnitOfWork
} from "../contracts/fiscal-unit-of-work";

import {
  FiscalValidationError
} from "../validation/fiscal-validation-error";

import {
  compareIsoDates,
  isIsoDate
} from "../validation/iso-date";

import {
  validateFiscalYearInput
} from "../validation/validate-fiscal-year";

import type {
  CreateFiscalYearCommand
} from "./create-fiscal-year-command";

export interface CreateFiscalYearResult {
  fiscalYearId: string;
  fiscalPeriodIds: string[];
}

function validatePeriods(
  command: CreateFiscalYearCommand
): void {
  const issues: Array<{
    field: string;
    message: string;
  }> = [];

  if (command.periods.length === 0) {
    issues.push({
      field: "periods",
      message: "حداقل یک دوره مالی باید تعریف شود."
    });
  }

  const sortedPeriods = [...command.periods].sort(
    (first, second) =>
      first.sequence - second.sequence
  );

  for (let index = 0; index < sortedPeriods.length; index++) {
    const period = sortedPeriods[index];

    if (!period) {
      continue;
    }

    if (
      !isIsoDate(period.startDate) ||
      !isIsoDate(period.endDate)
    ) {
      issues.push({
        field: "periods",
        message: `تاریخ دوره ${period.title} معتبر نیست.`
      });

      continue;
    }

    if (
      compareIsoDates(
        period.startDate,
        period.endDate
      ) > 0
    ) {
      issues.push({
        field: "periods",
        message:
          `تاریخ پایان دوره ${period.title} قبل از تاریخ شروع است.`
      });
    }

    if (
      compareIsoDates(
        period.startDate,
        command.startDate
      ) < 0 ||
      compareIsoDates(
        period.endDate,
        command.endDate
      ) > 0
    ) {
      issues.push({
        field: "periods",
        message:
          `دوره ${period.title} خارج از محدوده سال مالی است.`
      });
    }

    const previousPeriod = sortedPeriods[index - 1];

    if (
      previousPeriod &&
      compareIsoDates(
        period.startDate,
        previousPeriod.endDate
      ) <= 0
    ) {
      issues.push({
        field: "periods",
        message:
          `دوره ${period.title} با دوره قبلی هم‌پوشانی دارد.`
      });
    }
  }

  if (issues.length > 0) {
    throw new FiscalValidationError(issues);
  }
}

export async function createFiscalYear(
  unitOfWork: FiscalUnitOfWork,
  command: CreateFiscalYearCommand
): Promise<CreateFiscalYearResult> {
  const fiscalYearInput: CreateFiscalYearInput = {
    companyId: command.companyId,
    code: command.code,
    title: command.title,
    startDate: command.startDate,
    endDate: command.endDate,
    createMonthlyPeriods: false,
    makeCurrent: command.makeCurrent
  };

  const issues =
    validateFiscalYearInput(fiscalYearInput);

  if (issues.length > 0) {
    throw new FiscalValidationError(issues);
  }

  validatePeriods(command);

  return unitOfWork.transaction(async (repositories) => {
    const overlap =
      await repositories.fiscalYears.findOverlapping(
        command.companyId,
        command.startDate,
        command.endDate
      );

    if (overlap !== null) {
      throw new FiscalValidationError([
        {
          field: "startDate",
          message:
            "بازه این سال مالی با سال مالی دیگری هم‌پوشانی دارد."
        }
      ]);
    }

    const fiscalYear =
      await repositories.fiscalYears.create({
        ...fiscalYearInput,
        code: command.code.trim(),
        title: command.title.trim()
      });

    const fiscalPeriods =
      await repositories.fiscalPeriods.createMany(
        command.periods.map((period) => ({
          fiscalYearId: fiscalYear.id,
          sequence: period.sequence,
          code: period.code,
          title: period.title,
          startDate: period.startDate,
          endDate: period.endDate
        }))
      );

    if (command.makeCurrent) {
      await repositories.fiscalYears.setCurrent(
        command.companyId,
        fiscalYear.id
      );
    }

    return {
      fiscalYearId: fiscalYear.id,
      fiscalPeriodIds:
        fiscalPeriods.map((period) => period.id)
    };
  });
}
