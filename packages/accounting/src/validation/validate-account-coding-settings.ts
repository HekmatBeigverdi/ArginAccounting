import type {
  AccountCodingSettings,
} from "../domain/account-coding-settings.ts";
import type {
  AccountCodingSettingsValidationIssue,
} from "./account-coding-settings-validation-error.ts";

const MAX_ACCOUNT_CODE_LENGTH = 30;

function validateCodeLength(
  field:
    | "groupCodeLength"
    | "generalCodeLength"
    | "subsidiaryCodeLength",
  value: number,
  issues: AccountCodingSettingsValidationIssue[],
): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_ACCOUNT_CODE_LENGTH
  ) {
    issues.push({
      field,
      message:
        "طول کد حساب باید یک عدد صحیح بین ۱ تا ۳۰ باشد.",
    });
  }
}

export function validateAccountCodingSettings(
  settings: AccountCodingSettings,
): AccountCodingSettingsValidationIssue[] {
  const issues: AccountCodingSettingsValidationIssue[] =
    [];

  if (settings.companyId.trim().length === 0) {
    issues.push({
      field: "companyId",
      message: "شناسه شرکت الزامی است.",
    });
  }

  validateCodeLength(
    "groupCodeLength",
    settings.groupCodeLength,
    issues,
  );
  validateCodeLength(
    "generalCodeLength",
    settings.generalCodeLength,
    issues,
  );
  validateCodeLength(
    "subsidiaryCodeLength",
    settings.subsidiaryCodeLength,
    issues,
  );

  const lengthsAreValid =
    issues.every(
      (issue) =>
        issue.field !== "groupCodeLength" &&
        issue.field !== "generalCodeLength" &&
        issue.field !== "subsidiaryCodeLength",
    );

  if (
    lengthsAreValid &&
    settings.enforceHierarchicalCodes &&
    !(
      settings.groupCodeLength <
        settings.generalCodeLength &&
      settings.generalCodeLength <
        settings.subsidiaryCodeLength
    )
  ) {
    issues.push({
      field: "subsidiaryCodeLength",
      message:
        "در کدینگ سلسله‌مراتبی، طول کد گروه، کل و معین باید به‌ترتیب افزایش یابد.",
    });
  }

  if (
    !Number.isSafeInteger(settings.version) ||
    settings.version < 1
  ) {
    issues.push({
      field: "version",
      message: "نسخه تنظیمات باید عدد صحیح مثبت باشد.",
    });
  }

  return issues;
}
