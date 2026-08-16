import { JournalVoucherValidationError } from "./journal-voucher-validation-error.ts";

const MAX_IDENTIFIER_LENGTH = 128;

declare const journalVoucherIdBrand: unique symbol;
declare const journalLineIdBrand: unique symbol;

export type JournalVoucherId = string & {
  readonly [journalVoucherIdBrand]: "JournalVoucherId";
};

export type JournalLineId = string & {
  readonly [journalLineIdBrand]: "JournalLineId";
};

function createIdentifier(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new JournalVoucherValidationError(
      "identifier_required",
      field,
      "شناسه سند حسابداری الزامی است.",
    );
  }

  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw new JournalVoucherValidationError(
      "identifier_too_long",
      field,
      "شناسه سند حسابداری نمی‌تواند بیشتر از ۱۲۸ نویسه باشد.",
    );
  }

  return normalized;
}

export function createJournalVoucherId(value: string): JournalVoucherId {
  return createIdentifier(value, "id") as JournalVoucherId;
}

export function createJournalLineId(value: string): JournalLineId {
  return createIdentifier(value, "line.id") as JournalLineId;
}
