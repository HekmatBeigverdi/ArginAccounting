import type {
  CreateFiscalYearInput
} from "../domain/fiscal-year";

import {
  compareIsoDates,
  isIsoDate
} from "./iso-date";

import type {
  FiscalValidationIssue
} from "./fiscal-validation-error";

export function validateFiscalYearInput(
  input: CreateFiscalYearInput
): FiscalValidationIssue[] {
  const issues: FiscalValidationIssue[] = [];

  if (input.companyId.trim().length === 0) {
    issues.push({
      field: "companyId",
      message: "انتخاب شرکت الزامی است."
    });
  }

  if (input.code.trim().length === 0) {
    issues.push({
      field: "code",
      message: "کد سال مالی الزامی است."
    });
  }

  if (input.title.trim().length === 0) {
    issues.push({
      field: "title",
      message: "عنوان سال مالی الزامی است."
    });
  }

  if (!isIsoDate(input.startDate)) {
    issues.push({
      field: "startDate",
      message: "تاریخ شروع سال مالی معتبر نیست."
    });
  }

  if (!isIsoDate(input.endDate)) {
    issues.push({
      field: "endDate",
      message: "تاریخ پایان سال مالی معتبر نیست."
    });
  }

  if (
    isIsoDate(input.startDate) &&
    isIsoDate(input.endDate) &&
    compareIsoDates(
      input.startDate,
      input.endDate
    ) >= 0
  ) {
    issues.push({
      field: "endDate",
      message:
        "تاریخ پایان باید بعد از تاریخ شروع سال مالی باشد."
    });
  }

  return issues;
}
