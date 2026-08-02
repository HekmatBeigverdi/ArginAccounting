import type {
  AccountingDimensionType,
} from "../domain/accounting-dimension-type.ts";
import type {
  AccountingDimensionTypeValidationIssue,
} from "./accounting-dimension-type-validation-error.ts";

const CODE_PATTERN = /^[A-Z][A-Z0-9_-]{0,49}$/;

export function validateAccountingDimensionType(
  dimensionType: AccountingDimensionType,
): readonly AccountingDimensionTypeValidationIssue[] {
  const issues:
    AccountingDimensionTypeValidationIssue[] = [];

  requireText(
    dimensionType.id,
    "id",
    "شناسه نوع بُعد",
    issues,
  );
  requireText(
    dimensionType.companyId,
    "companyId",
    "شناسه شرکت",
    issues,
  );
  requireText(
    dimensionType.code,
    "code",
    "کد نوع بُعد",
    issues,
  );
  requireText(
    dimensionType.name,
    "name",
    "عنوان نوع بُعد",
    issues,
  );
  requireText(
    dimensionType.createdAt,
    "createdAt",
    "زمان ایجاد",
    issues,
  );
  requireText(
    dimensionType.updatedAt,
    "updatedAt",
    "زمان آخرین تغییر",
    issues,
  );

  if (
    dimensionType.code.length > 0 &&
    !CODE_PATTERN.test(dimensionType.code)
  ) {
    issues.push({
      field: "code",
      message:
        "کد نوع بُعد باید با حرف انگلیسی آغاز شود و حداکثر ۵۰ نویسه شامل حروف انگلیسی، عدد، خط تیره یا زیرخط باشد.",
    });
  }

  if (dimensionType.name.length > 200) {
    issues.push({
      field: "name",
      message:
        "عنوان نوع بُعد نمی‌تواند بیش از ۲۰۰ نویسه باشد.",
    });
  }

  if (
    dimensionType.englishName !== null &&
    dimensionType.englishName.length > 200
  ) {
    issues.push({
      field: "englishName",
      message:
        "عنوان انگلیسی نوع بُعد نمی‌تواند بیش از ۲۰۰ نویسه باشد.",
    });
  }

  if (
    !Number.isSafeInteger(dimensionType.displayOrder) ||
    dimensionType.displayOrder < 0
  ) {
    issues.push({
      field: "displayOrder",
      message:
        "ترتیب نمایش باید یک عدد صحیح نامنفی باشد.",
    });
  }

  if (
    dimensionType.source !== "manual" &&
    dimensionType.sourceReferenceId === null
  ) {
    issues.push({
      field: "sourceReferenceId",
      message:
        "برای نوع بُعد سیستمی یا ماژولی، شناسه منبع الزامی است.",
    });
  }

  if (
    !Number.isSafeInteger(dimensionType.version) ||
    dimensionType.version < 1
  ) {
    issues.push({
      field: "version",
      message:
        "نسخه نوع بُعد باید یک عدد صحیح مثبت باشد.",
    });
  }

  return Object.freeze(issues);
}

function requireText(
  value: string,
  field:
    AccountingDimensionTypeValidationIssue["field"],
  label: string,
  issues: AccountingDimensionTypeValidationIssue[],
): void {
  if (value.trim().length === 0) {
    issues.push({
      field,
      message: `${label} الزامی است.`,
    });
  }
}
