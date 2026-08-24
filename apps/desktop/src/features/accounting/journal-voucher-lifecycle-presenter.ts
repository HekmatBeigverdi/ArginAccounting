import type {
  JournalVoucherLifecycleActionCapability,
  JournalVoucherLifecycleDto,
  JournalVoucherStatus,
} from "@argin/accounting/journal";
import {
  permissionForCapability,
} from "@argin/accounting/journal";

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

export function journalVoucherLifecycleStatusLabel(
  status: JournalVoucherStatus,
): string {
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
      return permission === null || fullAccess || grantedPermissions.has(permission);
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

function presentAction(
  action: JournalVoucherLifecycleActionCapability,
): JournalVoucherLifecycleActionView {
  switch (action) {
    case "edit":
      return view(action, "ویرایش", null, false);
    case "delete":
      return view(action, "حذف پیش‌نویس", "این پیش‌نویس حذف شود؟", true);
    case "submit_for_approval":
      return view(action, "ارسال برای تأیید", "سند برای گردش تأیید ارسال شود؟", true);
    case "approve":
      return view(action, "تأیید", "این سند تأیید شود؟", true);
    case "reject":
      return view(action, "رد", "سند رد و به پیش‌نویس بازگردانده شود؟", true);
    case "return_to_draft":
      return view(action, "بازگشت برای اصلاح", "سند برای اصلاح به پیش‌نویس بازگردد؟", true);
    case "cancel_approval":
      return view(action, "لغو گردش تأیید", "گردش تأیید این سند لغو شود؟", true);
    case "reopen_for_amendment":
      return view(action, "بازگشایی برای اصلاح", "تأیید فعلی باطل و سند برای اصلاح بازگشایی شود؟", true);
    case "post":
      return view(action, "ثبت نهایی", "ثبت نهایی قابل ویرایش مستقیم نیست. ادامه می‌دهید؟", true);
    case "reverse":
      return view(action, "برگشت سند", "برای اصلاح سند ثبت‌شده، سند برگشتی مستقل ایجاد شود؟", true);
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
