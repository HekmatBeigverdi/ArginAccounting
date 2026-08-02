import type {
  AccountingDimensionMember,
} from "../domain/accounting-dimension-member.ts";
import type {
  AccountingDimensionMemberValidationIssue,
} from "./accounting-dimension-member-validation-error.ts";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_.-]{0,49}$/;

export function validateAccountingDimensionMember(
  member: AccountingDimensionMember,
): readonly AccountingDimensionMemberValidationIssue[] {
  const issues:
    AccountingDimensionMemberValidationIssue[] = [];

  requireText(member.id, "id", "شناسه عضو بُعد", issues);
  requireText(
    member.companyId,
    "companyId",
    "شناسه شرکت",
    issues,
  );
  requireText(
    member.dimensionTypeId,
    "dimensionTypeId",
    "شناسه نوع بُعد",
    issues,
  );
  requireText(member.code, "code", "کد عضو بُعد", issues);
  requireText(member.name, "name", "عنوان عضو بُعد", issues);
  requireText(
    member.createdAt,
    "createdAt",
    "زمان ایجاد",
    issues,
  );
  requireText(
    member.updatedAt,
    "updatedAt",
    "زمان آخرین تغییر",
    issues,
  );

  if (
    member.code.length > 0 &&
    !CODE_PATTERN.test(member.code)
  ) {
    issues.push({
      field: "code",
      message:
        "کد عضو بُعد باید حداکثر ۵۰ نویسه و شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.",
    });
  }

  if (member.name.length > 200) {
    issues.push({
      field: "name",
      message:
        "عنوان عضو بُعد نمی‌تواند بیش از ۲۰۰ نویسه باشد.",
    });
  }

  if (
    member.englishName !== null &&
    member.englishName.length > 200
  ) {
    issues.push({
      field: "englishName",
      message:
        "عنوان انگلیسی عضو بُعد نمی‌تواند بیش از ۲۰۰ نویسه باشد.",
    });
  }

  if (
    member.parentId !== null &&
    member.parentId === member.id
  ) {
    issues.push({
      field: "parentId",
      message:
        "عضو بُعد نمی‌تواند والد خودش باشد.",
    });
  }

  validateEffectiveDate(
    member.validFrom,
    "validFrom",
    "تاریخ شروع اعتبار",
    issues,
  );
  validateEffectiveDate(
    member.validTo,
    "validTo",
    "تاریخ پایان اعتبار",
    issues,
  );

  if (
    member.validFrom !== null &&
    member.validTo !== null &&
    isValidIsoDate(member.validFrom) &&
    isValidIsoDate(member.validTo) &&
    member.validFrom > member.validTo
  ) {
    issues.push({
      field: "validTo",
      message:
        "تاریخ پایان اعتبار نمی‌تواند پیش از تاریخ شروع اعتبار باشد.",
    });
  }

  if (
    !Number.isSafeInteger(member.displayOrder) ||
    member.displayOrder < 0
  ) {
    issues.push({
      field: "displayOrder",
      message:
        "ترتیب نمایش باید یک عدد صحیح نامنفی باشد.",
    });
  }

  if (
    member.source !== "manual" &&
    member.sourceReferenceId === null
  ) {
    issues.push({
      field: "sourceReferenceId",
      message:
        "برای عضو بُعد سیستمی یا ماژولی، شناسه منبع الزامی است.",
    });
  }

  if (
    !Number.isSafeInteger(member.version) ||
    member.version < 1
  ) {
    issues.push({
      field: "version",
      message:
        "نسخه عضو بُعد باید یک عدد صحیح مثبت باشد.",
    });
  }

  return Object.freeze(issues);
}

function requireText(
  value: string,
  field: AccountingDimensionMemberValidationIssue["field"],
  label: string,
  issues: AccountingDimensionMemberValidationIssue[],
): void {
  if (value.trim().length === 0) {
    issues.push({
      field,
      message: `${label} الزامی است.`,
    });
  }
}

function validateEffectiveDate(
  value: string | null,
  field: "validFrom" | "validTo",
  label: string,
  issues: AccountingDimensionMemberValidationIssue[],
): void {
  if (value !== null && !isValidIsoDate(value)) {
    issues.push({
      field,
      message: `${label} باید تاریخ معتبر با قالب YYYY-MM-DD باشد.`,
    });
  }
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
