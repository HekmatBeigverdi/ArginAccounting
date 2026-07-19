import type {
  NumberSeriesRepository
} from "../contracts/number-series-repository";

import {
  FiscalValidationError
} from "../validation/fiscal-validation-error";

export interface GenerateDocumentNumberInput {
  companyId: string;
  branchId: string | null;
  fiscalYearId: string | null;
  entityType: string;
}

export async function generateDocumentNumber(
  repository: NumberSeriesRepository,
  input: GenerateDocumentNumberInput
): Promise<string> {
  const series = await repository.findApplicable(
    input.companyId,
    input.branchId,
    input.fiscalYearId,
    input.entityType
  );

  if (series === null) {
    throw new FiscalValidationError([
      {
        field: "numberSeries",
        message:
          "سری شماره‌گذاری مناسب برای این سند تعریف نشده است."
      }
    ]);
  }

  const reservation =
    await repository.reserveNext(series.id);

  const numberPart =
    reservation.reservedNumber
      .toString()
      .padStart(series.paddingLength, "0");

  return [
    series.prefix,
    numberPart,
    series.suffix
  ].join("");
}
