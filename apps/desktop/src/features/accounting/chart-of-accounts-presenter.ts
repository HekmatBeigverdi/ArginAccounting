import type {
  Account,
  AccountLevel,
  AccountTreeNode,
  ChartOfAccountsErrorCode
} from "@argin/accounting";

export const accountLevelLabels: Readonly<Record<AccountLevel, string>> = {
  group: "گروه",
  general: "کل",
  subsidiary: "معین"
};

export function flattenAccountTree(
  nodes: readonly AccountTreeNode[],
  depth = 0
): readonly { account: Account; depth: number }[] {
  return nodes.flatMap((node) => [
    { account: node.account, depth },
    ...flattenAccountTree(node.children, depth + 1)
  ]);
}

const errorMessages: Partial<Record<ChartOfAccountsErrorCode, string>> = {
  PERMISSION_DENIED:
    "شما مجوز انجام این عملیات در کدینگ حساب‌ها را ندارید.",
  ACCOUNT_NOT_FOUND:
    "حساب انتخاب‌شده یافت نشد؛ فهرست را تازه‌سازی کنید.",
  CODING_SETTINGS_NOT_FOUND:
    "تنظیمات کدینگ این شرکت هنوز ایجاد نشده است.",
  DUPLICATE_ACCOUNT_CODE:
    "این کد حساب قبلاً در شرکت استفاده شده است.",
  ACCOUNT_TREE_CYCLE:
    "جابه‌جایی انتخاب‌شده در ساختار حساب‌ها چرخه ایجاد می‌کند.",
  VERSION_MISMATCH:
    "اطلاعات توسط کاربر دیگری تغییر کرده است؛ فهرست را تازه‌سازی کنید.",
  ACCOUNT_HAS_CHILDREN:
    "حساب دارای زیرمجموعه را نمی‌توان حذف کرد.",
  ACCOUNT_HAS_FINANCIAL_ACTIVITY:
    "حساب دارای گردش مالی را نمی‌توان حذف کرد؛ آن را غیرفعال کنید.",
  ACCOUNT_CODE_CHANGE_AFTER_USE_NOT_ALLOWED:
    "تغییر کد حساب استفاده‌شده در تنظیمات این شرکت مجاز نیست.",
  ACCOUNT_HAS_ACTIVE_CHILDREN:
    "ابتدا زیرحساب‌های فعال را غیرفعال کنید."
};

export function getAccountingErrorMessage(error: unknown): string {
  if (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    const mapped = errorMessages[
      error.code as ChartOfAccountsErrorCode
    ];
    if (mapped !== undefined) return mapped;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "عملیات کدینگ حساب‌ها با خطا مواجه شد.";
}
