import type { Account } from "../domain/account.ts";

export type JournalFiscalYearStatus =
  | "draft"
  | "open"
  | "closing"
  | "closed";

export type JournalFiscalPeriodStatus =
  | "open"
  | "locked"
  | "closed";

export interface JournalFiscalContext {
  readonly companyId: string;
  readonly fiscalYearId: string;
  readonly fiscalYearStartDate: string;
  readonly fiscalYearEndDate: string;
  readonly fiscalYearStatus: JournalFiscalYearStatus;
  readonly fiscalPeriodId: string;
  readonly fiscalPeriodStartDate: string;
  readonly fiscalPeriodEndDate: string;
  readonly fiscalPeriodStatus: JournalFiscalPeriodStatus;
}

export type JournalVoucherEligibilityCode =
  | "account_company_mismatch"
  | "account_inactive"
  | "account_not_subsidiary"
  | "account_not_postable"
  | "fiscal_company_mismatch"
  | "fiscal_year_not_open"
  | "fiscal_period_not_open"
  | "voucher_date_outside_fiscal_year"
  | "voucher_date_outside_fiscal_period";

export interface JournalVoucherEligibilityIssue {
  readonly code: JournalVoucherEligibilityCode;
  readonly field: "accountId" | "companyId" | "voucherDate" | "fiscalYearId" | "fiscalPeriodId";
  readonly message: string;
}

export interface ValidateJournalVoucherEligibilityInput {
  readonly companyId: string;
  readonly voucherDate: string;
  readonly account: Account;
  readonly fiscal: JournalFiscalContext;
}

export function validateJournalVoucherEligibility(
  input: ValidateJournalVoucherEligibilityInput,
): readonly JournalVoucherEligibilityIssue[] {
  const issues: JournalVoucherEligibilityIssue[] = [];

  if (input.account.companyId !== input.companyId) {
    issues.push({
      code: "account_company_mismatch",
      field: "accountId",
      message: "حساب انتخاب‌شده متعلق به شرکت سند حسابداری نیست.",
    });
  }

  if (input.account.status !== "active") {
    issues.push({
      code: "account_inactive",
      field: "accountId",
      message: "ثبت سند روی حساب غیرفعال مجاز نیست.",
    });
  }

  if (input.account.level !== "subsidiary") {
    issues.push({
      code: "account_not_subsidiary",
      field: "accountId",
      message: "ثبت سند فقط روی حساب سطح معین مجاز است.",
    });
  }

  if (!input.account.postingAllowed) {
    issues.push({
      code: "account_not_postable",
      field: "accountId",
      message: "حساب انتخاب‌شده برای ثبت سند فعال نشده است.",
    });
  }

  if (input.fiscal.companyId !== input.companyId) {
    issues.push({
      code: "fiscal_company_mismatch",
      field: "companyId",
      message: "سال مالی انتخاب‌شده متعلق به شرکت سند نیست.",
    });
  }

  if (input.fiscal.fiscalYearStatus !== "open") {
    issues.push({
      code: "fiscal_year_not_open",
      field: "fiscalYearId",
      message: "ثبت یا ویرایش سند فقط در سال مالی باز مجاز است.",
    });
  }

  if (input.fiscal.fiscalPeriodStatus !== "open") {
    issues.push({
      code: "fiscal_period_not_open",
      field: "fiscalPeriodId",
      message: "ثبت یا ویرایش سند فقط در دوره مالی باز مجاز است.",
    });
  }

  if (!isDateInside(input.voucherDate, input.fiscal.fiscalYearStartDate, input.fiscal.fiscalYearEndDate)) {
    issues.push({
      code: "voucher_date_outside_fiscal_year",
      field: "voucherDate",
      message: "تاریخ سند خارج از محدوده سال مالی انتخاب‌شده است.",
    });
  }

  if (!isDateInside(input.voucherDate, input.fiscal.fiscalPeriodStartDate, input.fiscal.fiscalPeriodEndDate)) {
    issues.push({
      code: "voucher_date_outside_fiscal_period",
      field: "voucherDate",
      message: "تاریخ سند خارج از محدوده دوره مالی انتخاب‌شده است.",
    });
  }

  return Object.freeze(issues);
}

export function assertJournalVoucherEligibility(
  input: ValidateJournalVoucherEligibilityInput,
): void {
  const issues = validateJournalVoucherEligibility(input);
  if (issues.length > 0) {
    throw new JournalVoucherEligibilityError(issues);
  }
}

export class JournalVoucherEligibilityError extends Error {
  readonly issues: readonly JournalVoucherEligibilityIssue[];

  constructor(issues: readonly JournalVoucherEligibilityIssue[]) {
    super(issues[0]?.message ?? "اعتبارسنجی حساب و دوره مالی سند ناموفق بود.");
    this.name = "JournalVoucherEligibilityError";
    this.issues = Object.freeze([...issues]);
  }
}

function isDateInside(value: string, start: string, end: string): boolean {
  return value >= start && value <= end;
}
