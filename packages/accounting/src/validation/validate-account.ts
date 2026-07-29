import type {
  Account,
} from "../domain/account.ts";
import type {
  AccountValidationIssue,
} from "./account-validation-error.ts";

export function validateAccount(
  account: Account,
): readonly AccountValidationIssue[] {
  const issues: AccountValidationIssue[] = [];

  requireText(account.id, "id", "شناسه حساب", issues);
  requireText(
    account.companyId,
    "companyId",
    "شناسه شرکت",
    issues,
  );
  requireText(account.code, "code", "کد حساب", issues);
  requireText(account.name, "name", "عنوان حساب", issues);
  requireText(
    account.createdAt,
    "createdAt",
    "زمان ایجاد",
    issues,
  );
  requireText(
    account.updatedAt,
    "updatedAt",
    "زمان آخرین تغییر",
    issues,
  );

  if (
    account.parentId !== null &&
    account.parentId === account.id
  ) {
    issues.push({
      field: "parentId",
      message: "حساب نمی‌تواند والد خودش باشد.",
    });
  }

  if (
    !Number.isSafeInteger(account.displayOrder) ||
    account.displayOrder < 0
  ) {
    issues.push({
      field: "displayOrder",
      message:
        "ترتیب نمایش باید یک عدد صحیح نامنفی باشد.",
    });
  }

  if (
    !Number.isSafeInteger(account.version) ||
    account.version < 1
  ) {
    issues.push({
      field: "version",
      message: "نسخه حساب باید یک عدد صحیح مثبت باشد.",
    });
  }

  if (
    account.level !== "subsidiary" &&
    account.postingAllowed
  ) {
    issues.push({
      field: "postingAllowed",
      message:
        "ثبت سند فقط روی حساب سطح معین مجاز است.",
    });
  }

  if (
    account.revaluationEnabled &&
    !account.currencyEnabled
  ) {
    issues.push({
      field: "revaluationEnabled",
      message:
        "فعال‌سازی تسعیر فقط برای حساب ارزی مجاز است.",
    });
  }

  return Object.freeze(issues);
}

function requireText(
  value: string,
  field: AccountValidationIssue["field"],
  label: string,
  issues: AccountValidationIssue[],
): void {
  if (value.trim().length === 0) {
    issues.push({
      field,
      message: `${label} الزامی است.`,
    });
  }
}
