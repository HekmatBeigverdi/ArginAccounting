import {
  IRR,
  Money,
  normalizeCurrencyCode,
  type CurrencyCode,
  type MoneyValue,
} from "@argin/platform";

import type {
  AccountingDimensionAssignment,
} from "./accounting-dimension-assignment.ts";
import {
  createJournalLineId,
  createJournalVoucherId,
  type JournalLineId,
  type JournalVoucherId,
} from "./journal-voucher-identity.ts";
import {
  createJournalVoucherNumber,
  normalizeJournalVoucherDescription,
  normalizeJournalVoucherReference,
  type JournalVoucherNumber,
} from "./journal-voucher-text.ts";
import { JournalVoucherValidationError } from "./journal-voucher-validation-error.ts";

export type JournalVoucherStatus = "draft";

export type JournalVoucherSourceType =
  | "manual"
  | "opening_balance"
  | "migration"
  | "integration"
  | "system"
  | "source_document";

export interface JournalVoucherSource {
  readonly type: JournalVoucherSourceType;
  readonly sourceId: string | null;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly causationId: string | null;
}

export interface JournalLine {
  readonly id: JournalLineId;
  readonly order: number;
  readonly accountId: string;
  readonly description: string | null;
  readonly debit: MoneyValue;
  readonly credit: MoneyValue;
  readonly dimensionAssignments: readonly AccountingDimensionAssignment[];
}

export interface JournalVoucher {
  readonly id: JournalVoucherId;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly number: JournalVoucherNumber;
  readonly reference: string | null;
  readonly voucherDate: string;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
  readonly description: string | null;
  readonly status: JournalVoucherStatus;
  readonly currency: CurrencyCode;
  readonly source: JournalVoucherSource;
  readonly lines: readonly JournalLine[];
  readonly totalDebit: MoneyValue;
  readonly totalCredit: MoneyValue;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface CreateJournalLineInput {
  readonly id: string;
  readonly order: number;
  readonly accountId: string;
  readonly description?: string | null;
  readonly debit: number;
  readonly credit: number;
  readonly dimensionAssignments?: readonly AccountingDimensionAssignment[];
}

export interface CreateJournalVoucherInput {
  readonly id: string;
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly number: string;
  readonly reference?: string | null;
  readonly voucherDate: string;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
  readonly description?: string | null;
  readonly currency?: CurrencyCode;
  readonly source?: Partial<JournalVoucherSource> & {
    readonly type?: JournalVoucherSourceType;
  };
  readonly lines: readonly CreateJournalLineInput[];
  readonly createdAt: string;
  readonly version?: number;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertIdentifier(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new JournalVoucherValidationError(
      "identifier_required",
      field,
      "شناسه مرتبط با سند حسابداری الزامی است.",
    );
  }

  if (normalized.length > 128) {
    throw new JournalVoucherValidationError(
      "identifier_too_long",
      field,
      "شناسه مرتبط با سند حسابداری نمی‌تواند بیشتر از ۱۲۸ نویسه باشد.",
    );
  }

  return normalized;
}

function assertIsoDate(value: string): string {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new JournalVoucherValidationError(
      "date_invalid",
      "voucherDate",
      "تاریخ سند حسابداری باید با قالب YYYY-MM-DD ثبت شود.",
    );
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new JournalVoucherValidationError(
      "date_invalid",
      "voucherDate",
      "تاریخ سند حسابداری معتبر نیست.",
    );
  }

  return value;
}

function normalizeCurrency(currency: CurrencyCode | undefined): CurrencyCode {
  try {
    return normalizeCurrencyCode(currency ?? IRR.code);
  } catch {
    throw new JournalVoucherValidationError(
      "currency_invalid",
      "currency",
      "کد ارز سند حسابداری معتبر نیست.",
    );
  }
}

function createAmount(
  amount: number,
  currency: CurrencyCode,
  field: string,
): MoneyValue {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new JournalVoucherValidationError(
      "line_amount_invalid",
      field,
      "مبلغ بدهکار و بستانکار باید عدد صحیح، امن و نامنفی باشد.",
    );
  }

  return Money.create(amount, currency).toValue();
}

function createJournalLine(
  input: CreateJournalLineInput,
  currency: CurrencyCode,
): JournalLine {
  if (!Number.isSafeInteger(input.order) || input.order < 1) {
    throw new JournalVoucherValidationError(
      "line_order_invalid",
      "line.order",
      "ترتیب سطر سند حسابداری باید عدد صحیح مثبت باشد.",
    );
  }

  const debit = createAmount(input.debit, currency, "line.debit");
  const credit = createAmount(input.credit, currency, "line.credit");
  const hasDebit = debit.amount > 0;
  const hasCredit = credit.amount > 0;

  if (hasDebit === hasCredit) {
    throw new JournalVoucherValidationError(
      "line_side_invalid",
      "line.amount",
      "هر سطر سند باید فقط در یکی از طرف‌های بدهکار یا بستانکار مبلغ مثبت داشته باشد.",
    );
  }

  return Object.freeze({
    id: createJournalLineId(input.id),
    order: input.order,
    accountId: assertIdentifier(input.accountId, "line.accountId"),
    description: normalizeJournalVoucherDescription(
      input.description,
      "line.description",
    ),
    debit,
    credit,
    dimensionAssignments: Object.freeze([
      ...(input.dimensionAssignments ?? []),
    ]),
  });
}

function createSource(
  source: CreateJournalVoucherInput["source"],
): JournalVoucherSource {
  return Object.freeze({
    type: source?.type ?? "manual",
    sourceId: source?.sourceId
      ? assertIdentifier(source.sourceId, "source.sourceId")
      : null,
    requestId: source?.requestId
      ? assertIdentifier(source.requestId, "source.requestId")
      : null,
    correlationId: source?.correlationId
      ? assertIdentifier(source.correlationId, "source.correlationId")
      : null,
    causationId: source?.causationId
      ? assertIdentifier(source.causationId, "source.causationId")
      : null,
  });
}

export function createJournalVoucher(
  input: CreateJournalVoucherInput,
): JournalVoucher {
  const currency = normalizeCurrency(input.currency);
  const version = input.version ?? 1;

  if (!Number.isSafeInteger(version) || version < 1) {
    throw new JournalVoucherValidationError(
      "version_invalid",
      "version",
      "نسخه سند حسابداری باید عدد صحیح مثبت باشد.",
    );
  }

  if (input.lines.length < 2) {
    throw new JournalVoucherValidationError(
      "minimum_lines_required",
      "lines",
      "سند حسابداری باید حداقل دو سطر موثر داشته باشد.",
    );
  }

  const lines = input.lines.map((line) => createJournalLine(line, currency));
  const orders = new Set<number>();

  for (const line of lines) {
    if (orders.has(line.order)) {
      throw new JournalVoucherValidationError(
        "line_order_duplicate",
        "line.order",
        "ترتیب سطرهای سند حسابداری باید یکتا باشد.",
      );
    }
    orders.add(line.order);
  }

  const orderedLines = [...lines].sort((left, right) => left.order - right.order);
  const totalDebitMoney = orderedLines.reduce(
    (total, line) => total.add(Money.from(line.debit)),
    Money.zero(currency),
  );
  const totalCreditMoney = orderedLines.reduce(
    (total, line) => total.add(Money.from(line.credit)),
    Money.zero(currency),
  );

  if (!totalDebitMoney.equals(totalCreditMoney)) {
    throw new JournalVoucherValidationError(
      "voucher_unbalanced",
      "lines",
      "جمع بدهکار و بستانکار سند حسابداری باید برابر باشد.",
    );
  }

  const createdAt = assertIdentifier(input.createdAt, "createdAt");

  return Object.freeze({
    id: createJournalVoucherId(input.id),
    companyId: assertIdentifier(input.companyId, "companyId"),
    branchId: input.branchId
      ? assertIdentifier(input.branchId, "branchId")
      : null,
    number: createJournalVoucherNumber(input.number),
    reference: normalizeJournalVoucherReference(input.reference),
    voucherDate: assertIsoDate(input.voucherDate),
    fiscalYearId: assertIdentifier(input.fiscalYearId, "fiscalYearId"),
    fiscalPeriodId: assertIdentifier(input.fiscalPeriodId, "fiscalPeriodId"),
    description: normalizeJournalVoucherDescription(input.description),
    status: "draft" as const,
    currency,
    source: createSource(input.source),
    lines: Object.freeze(orderedLines),
    totalDebit: totalDebitMoney.toValue(),
    totalCredit: totalCreditMoney.toValue(),
    createdAt,
    updatedAt: createdAt,
    version,
  });
}
