import {
  JournalVoucherApplicationError,
  type JournalVoucherDto,
  type JournalVoucherListItemDto,
  type JournalVoucherStatus,
} from "@argin/accounting/journal";

const persianDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

const rialNumber = new Intl.NumberFormat("fa-IR", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

export interface JournalVoucherPresentedError {
  readonly message: string;
  readonly technical: string | null;
}

export function formatJournalVoucherDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return persianDate.format(date);
}

export function formatJournalRials(amount: number): string {
  return `${rialNumber.format(amount)} ریال`;
}

export function journalVoucherStatusLabel(
  status: JournalVoucherStatus = "draft",
): string {
  switch (status) {
    case "draft": return "پیش‌نویس";
    case "pending_approval": return "در انتظار تأیید";
    case "approved": return "تأییدشده";
    case "posted": return "ثبت نهایی";
    case "reversed": return "برگشت‌شده";
  }
}

export function journalVoucherSourceLabel(
  source: JournalVoucherDto["sourceType"],
): string {
  switch (source) {
    case "manual": return "دستی";
    case "opening_balance": return "افتتاحیه";
    case "migration": return "انتقال اطلاعات";
    case "integration": return "یکپارچه‌سازی";
    case "system": return "سیستمی";
    case "source_document": return "سند مبنا";
  }
}

export function presentJournalVoucherError(
  error: unknown,
): JournalVoucherPresentedError {
  if (error instanceof JournalVoucherApplicationError) {
    return Object.freeze({ message: error.message, technical: null });
  }

  const technical = error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
  return Object.freeze({
    message: "عملیات سند حسابداری انجام نشد. جزئیات فنی را بررسی کنید.",
    technical,
  });
}

export function parseRialInput(value: string): number {
  const latin = value
    .replace(/[۰-۹]/gu, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/gu, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬,\s]/gu, "");
  if (latin === "") return 0;
  const amount = Number(latin);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : Number.NaN;
}

export function journalVoucherSearchText(
  item: JournalVoucherListItemDto,
): string {
  return [item.number, item.reference ?? "", item.description ?? ""]
    .join(" ")
    .toLocaleLowerCase("fa");
}
