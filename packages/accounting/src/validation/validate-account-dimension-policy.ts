import type {
  AccountDimensionPolicy,
} from "../domain/account-dimension-policy.ts";
import type {
  AccountDimensionPolicyValidationIssue,
} from "./account-dimension-policy-validation-error.ts";

const VALID_REQUIREMENTS = new Set<unknown>([
  "required",
  "optional",
  "forbidden",
]);

export function validateAccountDimensionPolicy(
  policy: AccountDimensionPolicy,
): readonly AccountDimensionPolicyValidationIssue[] {
  const issues: AccountDimensionPolicyValidationIssue[] =
    [];

  requireText(policy.id, "id", "شناسه سیاست", issues);
  requireText(
    policy.companyId,
    "companyId",
    "شناسه شرکت",
    issues,
  );
  requireText(
    policy.accountId,
    "accountId",
    "شناسه حساب",
    issues,
  );
  requireText(
    policy.dimensionTypeId,
    "dimensionTypeId",
    "شناسه نوع بُعد",
    issues,
  );
  requireText(
    policy.createdAt,
    "createdAt",
    "زمان ایجاد",
    issues,
  );
  requireText(
    policy.updatedAt,
    "updatedAt",
    "زمان آخرین تغییر",
    issues,
  );

  if (!VALID_REQUIREMENTS.has(policy.requirement)) {
    issues.push({
      field: "requirement",
      message:
        "الزام بُعد باید یکی از مقادیر اجباری، اختیاری یا ممنوع باشد.",
    });
  }

  if (
    !Number.isSafeInteger(policy.version) ||
    policy.version < 1
  ) {
    issues.push({
      field: "version",
      message:
        "نسخه سیاست ارتباط حساب و بُعد باید یک عدد صحیح مثبت باشد.",
    });
  }

  return Object.freeze(issues);
}

function requireText(
  value: string,
  field: AccountDimensionPolicyValidationIssue["field"],
  label: string,
  issues: AccountDimensionPolicyValidationIssue[],
): void {
  if (value.trim().length === 0) {
    issues.push({
      field,
      message: `${label} الزامی است.`,
    });
  }
}
