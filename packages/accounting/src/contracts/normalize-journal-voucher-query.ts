import {
  QUERY_PAGE_SIZE_DEFAULT,
  QUERY_PAGE_SIZE_MAXIMUM,
} from "@argin/platform";
import type {
  JournalVoucherSearchQuery,
  NormalizedJournalVoucherSearchQuery,
} from "./journal-voucher-repository.ts";
import { JournalVoucherApplicationError } from "../application/journal-voucher-application-error.ts";

export function normalizeJournalVoucherSearchQuery(
  query: JournalVoucherSearchQuery,
): NormalizedJournalVoucherSearchQuery {
  const companyId = requireText(query.companyId, "companyId");
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? QUERY_PAGE_SIZE_DEFAULT;

  if (!Number.isSafeInteger(page) || page < 1) {
    throw invalidQuery("page", "شماره صفحه باید عدد صحیح مثبت باشد.");
  }
  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > QUERY_PAGE_SIZE_MAXIMUM
  ) {
    throw invalidQuery(
      "pageSize",
      `اندازه صفحه باید بین ۱ و ${QUERY_PAGE_SIZE_MAXIMUM} باشد.`,
    );
  }

  const dateFrom = normalizeOptionalText(query.dateFrom);
  const dateTo = normalizeOptionalText(query.dateTo);
  if (dateFrom !== undefined && !isIsoDate(dateFrom)) {
    throw invalidQuery("dateFrom", "تاریخ شروع جستجو معتبر نیست.");
  }
  if (dateTo !== undefined && !isIsoDate(dateTo)) {
    throw invalidQuery("dateTo", "تاریخ پایان جستجو معتبر نیست.");
  }
  if (dateFrom !== undefined && dateTo !== undefined && dateFrom > dateTo) {
    throw invalidQuery(
      "dateRange",
      "تاریخ شروع جستجو نمی‌تواند بعد از تاریخ پایان باشد.",
    );
  }

  return Object.freeze({
    companyId,
    branchId:
      query.branchId === null
        ? null
        : normalizeOptionalText(query.branchId),
    fiscalYearId: normalizeOptionalText(query.fiscalYearId),
    fiscalPeriodId: normalizeOptionalText(query.fiscalPeriodId),
    accountId: normalizeOptionalText(query.accountId),
    sourceType: normalizeOptionalText(query.sourceType),
    reference: normalizeOptionalText(query.reference),
    number: normalizeOptionalText(query.number),
    dateFrom,
    dateTo,
    text: normalizeOptionalText(query.text),
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  });
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw invalidQuery(field, "مقدار الزامی جستجو وارد نشده است.");
  }
  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function invalidQuery(
  field: string,
  message: string,
): JournalVoucherApplicationError {
  return new JournalVoucherApplicationError(
    "journal.invalid-query",
    message,
    { field },
  );
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
