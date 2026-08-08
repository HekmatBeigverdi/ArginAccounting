import type {
  CreateCompanyInput
} from "../domain/company";
import {
  isCompanyActivityType
} from "../domain/company-activity-type";

import type {
  CompanyValidationIssue
} from "./company-validation-error";

export function validateCompanyInput(
  input: CreateCompanyInput
): CompanyValidationIssue[] {
  const issues: CompanyValidationIssue[] = [];

  const code = input.code.trim();
  const legalName = input.legalName.trim();

  if (!isCompanyActivityType(input.activityType)) {
    issues.push({
      field: "activityType",
      message: "نوع فعالیت شرکت معتبر نیست."
    });
  }

  if (code.length === 0) {
    issues.push({
      field: "code",
      message: "کد شرکت الزامی است."
    });
  }

  if (code.length > 20) {
    issues.push({
      field: "code",
      message: "کد شرکت نمی‌تواند بیشتر از ۲۰ کاراکتر باشد."
    });
  }

  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    issues.push({
      field: "code",
      message:
        "کد شرکت فقط می‌تواند شامل حروف انگلیسی، عدد، خط تیره و زیرخط باشد."
    });
  }

  if (legalName.length === 0) {
    issues.push({
      field: "legalName",
      message: "نام قانونی شرکت الزامی است."
    });
  }

  if (legalName.length > 200) {
    issues.push({
      field: "legalName",
      message:
        "نام قانونی شرکت نمی‌تواند بیشتر از ۲۰۰ کاراکتر باشد."
    });
  }

  if (
    input.nationalId &&
    !/^[0-9]{11}$/.test(input.nationalId)
  ) {
    issues.push({
      field: "nationalId",
      message: "شناسه ملی شرکت باید ۱۱ رقم باشد."
    });
  }

  return issues;
}
