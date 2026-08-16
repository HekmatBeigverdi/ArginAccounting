import { JournalVoucherValidationError } from "./journal-voucher-validation-error.ts";

const MAX_VOUCHER_NUMBER_LENGTH = 64;
const MAX_REFERENCE_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 500;

declare const journalVoucherNumberBrand: unique symbol;

export type JournalVoucherNumber = string & {
  readonly [journalVoucherNumberBrand]: "JournalVoucherNumber";
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function createJournalVoucherNumber(value: string): JournalVoucherNumber {
  const normalized = normalizeWhitespace(value);

  if (normalized.length === 0) {
    throw new JournalVoucherValidationError(
      "number_required",
      "number",
      "شماره سند حسابداری الزامی است.",
    );
  }

  if (normalized.length > MAX_VOUCHER_NUMBER_LENGTH) {
    throw new JournalVoucherValidationError(
      "number_too_long",
      "number",
      "شماره سند حسابداری نمی‌تواند بیشتر از ۶۴ نویسه باشد.",
    );
  }

  return normalized as JournalVoucherNumber;
}

export function normalizeJournalVoucherReference(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > MAX_REFERENCE_LENGTH) {
    throw new JournalVoucherValidationError(
      "text_too_long",
      "reference",
      "مرجع سند حسابداری نمی‌تواند بیشتر از ۱۲۸ نویسه باشد.",
    );
  }

  return normalized;
}

export function normalizeJournalVoucherDescription(
  value: string | null | undefined,
  field = "description",
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > MAX_DESCRIPTION_LENGTH) {
    throw new JournalVoucherValidationError(
      "text_too_long",
      field,
      "شرح سند حسابداری نمی‌تواند بیشتر از ۵۰۰ نویسه باشد.",
    );
  }

  return normalized;
}
