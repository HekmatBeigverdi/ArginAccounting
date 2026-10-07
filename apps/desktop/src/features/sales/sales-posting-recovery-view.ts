import type {
  SalesPostingRecoverySnapshot,
  SalesPostingRetryAction,
} from "@argin/sales-posting";

export interface SalesPostingRecoveryViewModel {
  readonly statusLabel: string;
  readonly statusTone: "info" | "success" | "warning" | "error";
  readonly actionLabel: string | null;
  readonly explanation: string;
  readonly reasonLabel: string | null;
  readonly waitingLineIds: readonly string[];
  readonly journalVoucherId: string | null;
  readonly committedPostingVersion: number | null;
}

const PENDING_REASON_LABELS: Record<string, string> = {
  "waiting-for-issue": "در انتظار ایجاد حواله خروج انبار",
  "waiting-for-confirmation": "در انتظار قطعی‌شدن حواله خروج",
  "waiting-for-movement": "در انتظار ایجاد حرکت موجودی",
  "waiting-for-valuation": "در انتظار محاسبه بهای تمام‌شده",
};

const ERROR_LABELS: Record<string, string> = {
  "sales_posting.account_mapping_missing": "اتصال یکی از نقش‌های حسابداری به حساب تعریف نشده است.",
  "sales_posting.account_not_postable": "یکی از حساب‌های انتخاب‌شده اجازه ثبت مستقیم ندارد.",
  "sales_posting.posting_rule_ambiguous": "قواعد ثبت حسابداری دارای ابهام هستند.",
  "sales_posting.concurrency_conflict": "اطلاعات هم‌زمان تغییر کرده‌اند و باید از نسخه جدید دوباره تلاش شود.",
  "sales_posting.atomic_commit_conflict": "ثبت اتمیک با تغییر هم‌زمان مواجه شده است و باید دوباره تلاش شود.",
};

function actionLabel(action: SalesPostingRetryAction): string | null {
  switch (action) {
    case "wait":
      return null;
    case "retry":
      return "تلاش مجدد";
    case "replay":
      return "بازخوانی نتیجه ثبت‌شده";
    case "manual-review":
      return "بررسی دستی";
    case "none":
      return null;
  }
}

export function createSalesPostingRecoveryViewModel(
  recovery: SalesPostingRecoverySnapshot,
): SalesPostingRecoveryViewModel {
  if (recovery.status === "committed") {
    return Object.freeze({
      statusLabel: "ثبت حسابداری ایجاد شده",
      statusTone: "success",
      actionLabel: actionLabel(recovery.retryAction),
      explanation:
        "اثر حسابداری این سند قبلاً با موفقیت ثبت شده است. اجرای مجدد باید همان نتیجه قبلی را بازپخش کند.",
      reasonLabel: null,
      waitingLineIds: recovery.waitingLineIds,
      journalVoucherId: recovery.journalVoucherId,
      committedPostingVersion: recovery.committedPostingVersion,
    });
  }

  if (recovery.status === "pending") {
    return Object.freeze({
      statusLabel: "در انتظار تکمیل پیش‌نیازها",
      statusTone: "warning",
      actionLabel: actionLabel(recovery.retryAction),
      explanation:
        "سند فروش قطعی باقی می‌ماند و پس از آماده‌شدن پیش‌نیازهای انبار یا ارزش‌گذاری، ثبت حسابداری ادامه پیدا می‌کند.",
      reasonLabel:
        recovery.reason === null
          ? null
          : PENDING_REASON_LABELS[recovery.reason] ?? recovery.reason,
      waitingLineIds: recovery.waitingLineIds,
      journalVoucherId: null,
      committedPostingVersion: null,
    });
  }

  if (recovery.status === "blocked") {
    return Object.freeze({
      statusLabel: "نیازمند بررسی",
      statusTone: "error",
      actionLabel: actionLabel(recovery.retryAction),
      explanation:
        "ثبت حسابداری به دلیل یک خطای ساختاری یا تنظیماتی متوقف شده است و تا رفع علت نباید به‌صورت خودکار تکرار شود.",
      reasonLabel:
        recovery.reason === null
          ? null
          : ERROR_LABELS[recovery.reason] ?? recovery.reason,
      waitingLineIds: recovery.waitingLineIds,
      journalVoucherId: null,
      committedPostingVersion: null,
    });
  }

  return Object.freeze({
    statusLabel: "آماده ثبت حسابداری",
    statusTone: "info",
    actionLabel: actionLabel(recovery.retryAction),
    explanation:
      "پیش‌نیازهای ثبت حسابداری آماده است. در صورت داشتن مجوز، عملیات ثبت یا تلاش مجدد قابل اجراست.",
    reasonLabel:
      recovery.reason === null
        ? null
        : ERROR_LABELS[recovery.reason] ?? recovery.reason,
    waitingLineIds: recovery.waitingLineIds,
    journalVoucherId: null,
    committedPostingVersion: null,
  });
}
