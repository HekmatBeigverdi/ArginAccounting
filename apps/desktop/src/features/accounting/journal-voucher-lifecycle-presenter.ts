import type {
  JournalVoucherLifecycleActionCapability,
  JournalVoucherLifecycleDto,
  JournalVoucherStatus,
} from "@argin/accounting/journal";
import { permissionForCapability } from "@argin/accounting/journal";

export interface JournalVoucherLifecycleActionView {
  readonly action: JournalVoucherLifecycleActionCapability;
  readonly label: string;
  readonly confirmation: string | null;
  readonly consequential: boolean;
}

export interface JournalVoucherLifecycleViewModel {
  readonly status: JournalVoucherStatus;
  readonly statusLabel: string;
  readonly statusDescription: string;
  readonly tone: "neutral" | "warning" | "positive" | "final" | "muted";
  readonly versionLabel: string;
  readonly actions: readonly JournalVoucherLifecycleActionView[];
  readonly locked: boolean;
}

export interface JournalVoucherLifecyclePresentedFailure {
  readonly kind: "business" | "technical";
  readonly title: string;
  readonly message: string;
  readonly technical: string | null;
}

export function journalVoucherLifecycleStatusLabel(status: JournalVoucherStatus): string {
  switch (status) {
    case "draft": return "پیش‌نویس";
    case "pending_approval": return "در انتظار تأیید";
    case "approved": return "تأییدشده";
    case "posted": return "ثبت نهایی";
    case "reversed": return "برگشت‌شده";
  }
}

export function presentJournalVoucherLifecycle(
  lifecycle: JournalVoucherLifecycleDto,
  grantedPermissions: ReadonlySet<string>,
): JournalVoucherLifecycleViewModel {
  const fullAccess = grantedPermissions.has("system.full-access");
  const actions = lifecycle.capabilities.actions
    .filter((action) => {
      const permission = permissionForCapability(action);
      return fullAccess || grantedPermissions.has(permission);
    })
    .map(presentAction);

  return Object.freeze({
    status: lifecycle.status,
    statusLabel: journalVoucherLifecycleStatusLabel(lifecycle.status),
    statusDescription: statusDescription(lifecycle.status),
    tone: statusTone(lifecycle.status),
    versionLabel: `نسخه ${lifecycle.version.toLocaleString("fa-IR")}`,
    actions: Object.freeze(actions),
    locked: !lifecycle.capabilities.editable,
  });
}

export function presentJournalVoucherLifecycleFailure(
  error: unknown,
): JournalVoucherLifecyclePresentedFailure {
  const code = lifecycleErrorCode(error);
  if (code) {
    return Object.freeze({
      kind: "business",
      title: businessFailureTitle(code),
      message: businessFailureMessage(code, error),
      technical: technicalFailureDetails(error, code),
    });
  }

  return Object.freeze({
    kind: "technical",
    title: "خطای فنی",
    message: "عملیات چرخه عمر سند انجام نشد. جزئیات فنی برای بررسی نگه‌داری شده است.",
    technical: technicalFailureDetails(error),
  });
}

function presentAction(action: JournalVoucherLifecycleActionCapability): JournalVoucherLifecycleActionView {
  switch (action) {
    case "edit": return view(action, "ویرایش", null, false);
    case "delete": return view(action, "حذف پیش‌نویس", "این پیش‌نویس حذف شود؟", true);
    case "submit_for_approval": return view(action, "ارسال برای تأیید", "سند برای گردش تأیید ارسال شود؟", true);
    case "approve": return view(action, "تأیید", "این سند تأیید شود؟", true);
    case "reject": return view(action, "رد", "سند رد و به پیش‌نویس بازگردانده شود؟", true);
    case "return_to_draft": return view(action, "بازگشت برای اصلاح", "سند برای اصلاح به پیش‌نویس بازگردد؟", true);
    case "cancel_approval": return view(action, "لغو گردش تأیید", "گردش تأیید این سند لغو شود؟", true);
    case "reopen_for_amendment": return view(action, "بازگشایی برای اصلاح", "تأیید فعلی باطل و سند برای اصلاح بازگشایی شود؟", true);
    case "post": return view(action, "ثبت نهایی", "ثبت نهایی، اطلاعات حسابداری سند را تغییرناپذیر می‌کند. ادامه می‌دهید؟", true);
    case "reverse": return view(action, "برگشت سند", "یک سند برگشتی مستقل با اثر معکوس ایجاد می‌شود و سند اصلی برگشت‌شده خواهد شد. ادامه می‌دهید؟", true);
  }
}

function view(
  action: JournalVoucherLifecycleActionCapability,
  label: string,
  confirmation: string | null,
  consequential: boolean,
): JournalVoucherLifecycleActionView {
  return Object.freeze({ action, label, confirmation, consequential });
}

function statusDescription(status: JournalVoucherStatus): string {
  switch (status) {
    case "draft": return "سند قابل ویرایش است و هنوز وارد گردش تأیید نشده است.";
    case "pending_approval": return "سند قفل است و منتظر تصمیم گردش تأیید می‌باشد.";
    case "approved": return "سند تأیید شده اما هنوز ثبت نهایی نشده است.";
    case "posted": return "سند ثبت نهایی شده و اطلاعات حسابداری آن تغییرناپذیر است.";
    case "reversed": return "اثر این سند با یک سند برگشتی مستقل خنثی شده است.";
  }
}

function statusTone(status: JournalVoucherStatus): JournalVoucherLifecycleViewModel["tone"] {
  switch (status) {
    case "draft": return "neutral";
    case "pending_approval": return "warning";
    case "approved": return "positive";
    case "posted": return "final";
    case "reversed": return "muted";
  }
}

function lifecycleErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.startsWith("journal.") ? code : null;
}

function technicalFailureDetails(error: unknown, code?: string): string {
  const message = error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
  const stack = error instanceof Error && error.stack ? `\n${error.stack}` : "";
  return `${code ? `code=${code}\n` : ""}${message}${stack}`;
}

function businessFailureTitle(code: string): string {
  switch (code) {
    case "journal.version-conflict": return "سند توسط کاربر دیگری تغییر کرده است";
    case "journal.unauthorized": return "دسترسی مجاز نیست";
    case "journal.segregation-of-duties-violation": return "تفکیک وظایف اجازه این عملیات را نمی‌دهد";
    case "journal.approval-cycle-exists": return "گردش تأیید فعال وجود دارد";
    case "journal.approval-cycle-missing": return "تأیید معتبر پیدا نشد";
    case "journal.approval-status-mismatch": return "وضعیت گردش تأیید معتبر نیست";
    case "journal.approval-version-conflict": return "درخواست تأیید تغییر کرده است";
    case "journal.approval-content-version-mismatch": return "سند پس از تأیید تغییر کرده است";
    case "journal.posting-validation-failed": return "سند آماده ثبت نهایی نیست";
    case "journal.reversal-validation-failed": return "برگشت سند قابل انجام نیست";
    case "journal.already-reversed": return "سند قبلاً برگشت شده است";
    case "journal.persistence-failed": return "ذخیره اطلاعات چرخه عمر انجام نشد";
    default: return "عملیات چرخه عمر پذیرفته نشد";
  }
}

function businessFailureMessage(code: string, error: unknown): string {
  switch (code) {
    case "journal.version-conflict":
      return "نسخه نمایش‌داده‌شده قدیمی است. وضعیت سند را تازه‌سازی کنید و دوباره اقدام کنید.";
    case "journal.unauthorized":
      return "مجوز لازم برای انجام این عملیات به کاربر جاری اختصاص داده نشده است.";
    case "journal.segregation-of-duties-violation":
      return "کاربری که سند را برای تأیید ارسال کرده است نمی‌تواند همان چرخه را تأیید کند.";
    case "journal.approval-cycle-exists":
      return "برای این سند یک چرخه تأیید جاری وجود دارد. وضعیت سند و درخواست تأیید را تازه‌سازی کنید.";
    case "journal.approval-cycle-missing":
      return "چرخه تأیید جاری و معتبر برای این سند وجود ندارد.";
    case "journal.approval-status-mismatch":
      return "وضعیت درخواست تأیید با وضعیت مورد انتظار سند هماهنگ نیست.";
    case "journal.approval-version-conflict":
      return "درخواست تأیید از زمان نمایش تغییر کرده است. صفحه را تازه‌سازی و دوباره اقدام کنید.";
    case "journal.approval-content-version-mismatch":
      return "محتوای سند با نسخه‌ای که تأیید شده مطابقت ندارد و باید دوباره وارد گردش تأیید شود.";
    case "journal.posting-validation-failed":
      return "اعتبارسنجی نهایی حساب‌ها، ابعاد، تراز یا دوره مالی موفق نبود. سند را بررسی و دوباره تلاش کنید.";
    case "journal.reversal-validation-failed":
      return "شرایط حسابداری یا دوره مالی برای ایجاد سند برگشتی معتبر نیست.";
    case "journal.already-reversed":
      return "برای این سند قبلاً سند برگشتی ثبت شده است.";
    case "journal.persistence-failed":
      return "ذخیره‌سازی چرخه عمر سند در پایگاه داده انجام نشد. جزئیات فنی را برای بررسی ارسال کنید.";
    default:
      return error instanceof Error ? error.message : "عملیات با قواعد چرخه عمر سند سازگار نیست.";
  }
}
