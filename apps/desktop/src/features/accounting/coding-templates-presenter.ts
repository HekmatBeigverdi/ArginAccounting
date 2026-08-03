import type {
  CodingTemplateAccountItem,
  CodingTemplatePreviewAction,
  CodingTemplatePreviewIssue,
  CodingTemplatePreviewIssueCode,
  CodingTemplatePreviewPlan,
} from "@argin/accounting";

const labels: Record<string, string> = {
  service: "خدماتی", trading: "بازرگانی", manufacturing: "تولیدی", custom: "سفارشی",
  draft: "پیش‌نویس", published: "منتشرشده", retired: "بازنشسته",
  built_in: "سیستمی", create: "ایجاد", compatible_existing: "سازگار با اطلاعات موجود",
  conflict: "تعارض", skipped: "نادیده‌گرفته‌شده", invalid: "نامعتبر",
  applied: "اعمال‌شده", previewed: "پیش‌نمایش‌شده", rejected: "ردشده",
};

export const codingTemplateLabel = (value: string): string => labels[value] ?? value;

const accountLabels: Record<string, string> = {
  group: "گروه",
  general: "کل",
  subsidiary: "معین",
  debit: "بدهکار",
  credit: "بستانکار",
  mixed: "مختلط",
  none: "بدون ماهیت",
};

export const codingTemplateAccountLabel = (value: string): string =>
  accountLabels[value] ?? codingTemplateLabel(value);

export interface CodingTemplateAccountTreeNode {
  readonly account: Readonly<CodingTemplateAccountItem>;
  readonly action: CodingTemplatePreviewAction;
  readonly issues: readonly CodingTemplatePreviewIssue[];
  readonly children: readonly CodingTemplateAccountTreeNode[];
}

export function buildCodingTemplateAccountTree(
  accounts: readonly Readonly<CodingTemplateAccountItem>[],
  preview: Readonly<CodingTemplatePreviewPlan>,
): readonly CodingTemplateAccountTreeNode[] {
  const accountPlans = new Map(
    preview.items
      .filter((item) => item.itemType === "account")
      .map((item) => [item.logicalKey, item] as const),
  );
  const children = new Map<string | null, CodingTemplateAccountItem[]>();
  for (const account of accounts) {
    const siblings = children.get(account.parentLogicalKey) ?? [];
    siblings.push(account);
    children.set(account.parentLogicalKey, siblings);
  }
  const visit = (parent: string | null): readonly CodingTemplateAccountTreeNode[] =>
    (children.get(parent) ?? [])
      .sort((left, right) => left.displayOrder - right.displayOrder || left.code.localeCompare(right.code))
      .map((account) => {
        const plan = accountPlans.get(account.logicalKey);
        return Object.freeze({
          account,
          action: plan?.action ?? "invalid",
          issues: plan?.issues ?? [],
          children: visit(account.logicalKey),
        });
      });
  return visit(null);
}

export function formatJalaliDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
}

export function codingTemplateIssueMessage(code: CodingTemplatePreviewIssueCode | string): string {
  const messages: Record<string, string> = {
    company_scope_conflict: "این مورد متعلق به شرکت دیگری است.",
    duplicate_baseline_code: "کد در اطلاعات فعلی شرکت تکراری است.",
    duplicate_baseline_logical_key: "شناسه منطقی در اطلاعات فعلی تکراری است.",
    logical_key_conflict: "شناسه منطقی با قلم موجود تعارض دارد.",
    code_conflict: "کد با قلم دیگری در کدینگ شرکت تعارض دارد.",
    hierarchy_conflict: "ساختار والد و فرزند سازگار نیست.",
    classification_conflict: "طبقه‌بندی گزارش با حساب موجود تفاوت دارد.",
    account_behavior_conflict: "رفتار حساب با تعریف موجود تفاوت دارد.",
    dimension_definition_conflict: "تعریف بُعد حسابداری با اطلاعات موجود تعارض دارد.",
    policy_conflict: "سیاست اتصال حساب و بُعد تعارض دارد.",
    reference_conflict: "یکی از ارجاع‌های این قلم معتبر نیست.",
    invalid_template_item: "تعریف این قلم در الگو نامعتبر است.",
  };
  return messages[code] ?? "خطای ناشناخته در بررسی الگو رخ داد.";
}

export function codingTemplateIssueAction(issue: CodingTemplatePreviewIssue): string {
  const actions: Record<CodingTemplatePreviewIssueCode, string> = {
    company_scope_conflict: "شرکت فعال را دوباره بررسی کنید؛ این رکورد باید به همین شرکت تعلق داشته باشد.",
    duplicate_baseline_code: "در «کدینگ حساب‌ها» کد تکراری را جست‌وجو و یکی از حساب‌های تکراری را اصلاح یا غیرفعال کنید.",
    duplicate_baseline_logical_key: "این مورد نیازمند اصلاح شناسه داخلی حساب موجود است؛ با مدیر سیستم تماس بگیرید.",
    logical_key_conflict: "در «کدینگ حساب‌ها» حساب متناظر را پیدا کنید و کد آن را با کد پیشنهادی الگو هماهنگ کنید.",
    code_conflict: "در «کدینگ حساب‌ها» این کد را جست‌وجو کنید؛ کد حساب موجود را تغییر دهید یا حساب ناسازگار را غیرفعال کنید.",
    hierarchy_conflict: "والد و سطح حساب موجود را در «کدینگ حساب‌ها» با ساختار پیشنهادی هماهنگ کنید.",
    classification_conflict: "طبقه‌بندی گزارش حساب موجود را بررسی و با الگو هماهنگ کنید.",
    account_behavior_conflict: "ماهیت و تنظیمات رفتاری حساب موجود را بررسی و با الگو هماهنگ کنید.",
    dimension_definition_conflict: "تعریف بُعد موجود را در «ابعاد حسابداری» بررسی و اصلاح کنید.",
    policy_conflict: "سیاست اتصال حساب و بُعد را در «ابعاد حسابداری» بررسی و اصلاح کنید.",
    reference_conflict: "ارجاع‌های این مورد را بررسی کنید و سپس دوباره پیش‌نمایش بگیرید.",
    invalid_template_item: "این نسخه از الگو قابل اعمال نیست؛ نسخه دیگری انتخاب کنید یا الگو را اصلاح کنید.",
  };
  return actions[issue.code];
}

export function codingTemplateErrorMessage(reason: unknown): string {
  const code = reason instanceof Error ? reason.message : String(reason);
  const messages: Record<string, string> = {
    permission_denied: "برای انجام این عملیات مجوز کافی ندارید.",
    built_in_permission_required: "تغییر الگوی سیستمی به مجوز مدیر سیستم نیاز دارد.",
    stale_preview: "اطلاعات شرکت پس از پیش‌نمایش تغییر کرده است؛ دوباره پیش‌نمایش بگیرید.",
    preview_not_applicable: "تا زمان رفع تعارض‌ها امکان اعمال الگو وجود ندارد.",
    confirmation_required: "تأیید صریح عملیات الزامی است.",
    "coding-template-version-not-found": "نسخه انتخاب‌شده پیدا نشد.",
  };
  return messages[code] ?? "عملیات الگوی کدینگ انجام نشد. دوباره تلاش کنید.";
}
