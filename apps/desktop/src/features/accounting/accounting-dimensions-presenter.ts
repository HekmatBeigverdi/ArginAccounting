import type {
  AccountDimensionRequirement,
  AccountingDimensionsErrorCode,
} from "@argin/accounting";

export const dimensionRequirementLabels: Readonly<
  Record<AccountDimensionRequirement, string>
> = {
  required: "اجباری",
  optional: "اختیاری",
  forbidden: "ممنوع",
};

const errorMessages: Partial<Record<AccountingDimensionsErrorCode, string>> = {
  PERMISSION_DENIED:
    "شما مجوز انجام این عملیات در ابعاد حسابداری را ندارید.",
  DIMENSION_TYPE_NOT_FOUND:
    "نوع بُعد انتخاب‌شده یافت نشد؛ فهرست را تازه‌سازی کنید.",
  DIMENSION_MEMBER_NOT_FOUND:
    "عضو انتخاب‌شده یافت نشد؛ فهرست را تازه‌سازی کنید.",
  DIMENSION_POLICY_NOT_FOUND:
    "سیاست انتخاب‌شده یافت نشد؛ فهرست را تازه‌سازی کنید.",
  ACCOUNT_NOT_FOUND:
    "حساب انتخاب‌شده یافت نشد یا متعلق به شرکت جاری نیست.",
  DUPLICATE_DIMENSION_TYPE_CODE:
    "این کد نوع بُعد قبلاً در شرکت استفاده شده است.",
  DUPLICATE_DIMENSION_MEMBER_CODE:
    "این کد عضو در نوع بُعد انتخاب‌شده تکراری است.",
  DUPLICATE_ACCOUNT_DIMENSION_POLICY:
    "برای این حساب و نوع بُعد قبلاً سیاست تعریف شده است.",
  DIMENSION_MEMBER_TREE_CYCLE:
    "انتخاب والد باعث ایجاد چرخه در ساختار اعضا می‌شود.",
  DIMENSION_MEMBER_PARENT_MISMATCH: "عضو والد باید از همین نوع بُعد باشد.",
  DIMENSION_TYPE_HAS_ACTIVE_MEMBERS:
    "ابتدا اعضای فعال این نوع بُعد را غیرفعال کنید.",
  DIMENSION_MEMBER_HAS_ACTIVE_CHILDREN:
    "ابتدا زیرمجموعه‌های فعال این عضو را غیرفعال کنید.",
  DIMENSION_TYPE_IN_USE:
    "نوع بُعد استفاده‌شده را نمی‌توان حذف کرد؛ آن را غیرفعال کنید.",
  DIMENSION_MEMBER_IN_USE:
    "عضو استفاده‌شده را نمی‌توان حذف کرد؛ آن را غیرفعال کنید.",
  VERSION_MISMATCH:
    "اطلاعات توسط کاربر دیگری تغییر کرده است؛ " +
    "فهرست را تازه‌سازی کنید.",
};

export function getAccountingDimensionsErrorMessage(error: unknown): string {
  if (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    const message = errorMessages[error.code as AccountingDimensionsErrorCode];
    if (message !== undefined) return message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "عملیات ابعاد حسابداری با خطا مواجه شد.";
}
