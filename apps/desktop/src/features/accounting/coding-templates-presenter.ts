import type { CodingTemplatePreviewIssueCode } from "@argin/accounting";

const labels: Record<string, string> = {
  service: "خدماتی", trading: "بازرگانی", manufacturing: "تولیدی", custom: "سفارشی",
  draft: "پیش‌نویس", published: "منتشرشده", retired: "بازنشسته",
  built_in: "سیستمی", create: "ایجاد", compatible_existing: "سازگار با اطلاعات موجود",
  conflict: "تعارض", skipped: "نادیده‌گرفته‌شده", invalid: "نامعتبر",
  applied: "اعمال‌شده", previewed: "پیش‌نمایش‌شده", rejected: "ردشده",
};

export const codingTemplateLabel = (value: string): string => labels[value] ?? value;

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
