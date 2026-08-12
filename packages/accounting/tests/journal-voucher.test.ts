import assert from "node:assert/strict";
import test from "node:test";

import {
  createJournalVoucher,
  type CreateJournalVoucherInput,
} from "../src/domain/journal-voucher.ts";
import {
  createJournalLineId,
  createJournalVoucherId,
} from "../src/domain/journal-voucher-identity.ts";
import {
  createJournalVoucherNumber,
  normalizeJournalVoucherDescription,
  normalizeJournalVoucherReference,
} from "../src/domain/journal-voucher-text.ts";
import {
  JournalVoucherValidationError,
} from "../src/domain/journal-voucher-validation-error.ts";

function validVoucher(
  overrides: Partial<CreateJournalVoucherInput> = {},
): CreateJournalVoucherInput {
  return {
    id: "voucher-1",
    companyId: "company-1",
    branchId: "branch-1",
    number: "JV-000001",
    reference: "REF-01",
    voucherDate: "2026-08-12",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-05",
    description: "ثبت دریافت نقدی",
    currency: "IRR",
    source: {
      type: "manual",
      requestId: "request-1",
      correlationId: "correlation-1",
    },
    lines: [
      {
        id: "line-1",
        order: 2,
        accountId: "account-credit",
        debit: 0,
        credit: 1_000_000,
      },
      {
        id: "line-2",
        order: 1,
        accountId: "account-debit",
        debit: 1_000_000,
        credit: 0,
      },
    ],
    createdAt: "2026-08-12T04:30:00.000Z",
    ...overrides,
  };
}

test("normalizes voucher identifiers, number and text value objects", () => {
  assert.equal(createJournalVoucherId(" voucher-1 "), "voucher-1");
  assert.equal(createJournalLineId(" line-1 "), "line-1");
  assert.equal(createJournalVoucherNumber(" JV-  0001 "), "JV- 0001");
  assert.equal(
    normalizeJournalVoucherDescription("  دریافت   وجه نقد  "),
    "دریافت وجه نقد",
  );
  assert.equal(normalizeJournalVoucherReference("   "), null);
});

test("creates an immutable balanced draft voucher with deterministic line order", () => {
  const voucher = createJournalVoucher(validVoucher());

  assert.equal(voucher.status, "draft");
  assert.equal(voucher.currency, "IRR");
  assert.equal(voucher.totalDebit.amount, 1_000_000);
  assert.equal(voucher.totalCredit.amount, 1_000_000);
  assert.deepEqual(voucher.lines.map((line) => line.order), [1, 2]);
  assert.equal(voucher.version, 1);
  assert.equal(voucher.updatedAt, voucher.createdAt);
  assert.ok(Object.isFrozen(voucher));
  assert.ok(Object.isFrozen(voucher.lines));
});

test("defaults currency to Iranian Rial and source to manual", () => {
  const input = validVoucher();
  delete (input as { currency?: string }).currency;
  delete (input as { source?: object }).source;

  const voucher = createJournalVoucher(input);

  assert.equal(voucher.currency, "IRR");
  assert.equal(voucher.source.type, "manual");
  assert.equal(voucher.source.sourceId, null);
});

test("rejects vouchers with fewer than two effective lines", () => {
  assert.throws(
    () => createJournalVoucher(validVoucher({ lines: [validVoucher().lines[0]!] })),
    (error: unknown) =>
      error instanceof JournalVoucherValidationError &&
      error.code === "minimum_lines_required",
  );
});

test("rejects zero-zero and debit-credit lines", () => {
  for (const [debit, credit] of [[0, 0], [100, 100]]) {
    assert.throws(
      () => createJournalVoucher(validVoucher({
        lines: [
          { ...validVoucher().lines[0]!, debit, credit },
          validVoucher().lines[1]!,
        ],
      })),
      (error: unknown) =>
        error instanceof JournalVoucherValidationError &&
        error.code === "line_side_invalid",
    );
  }
});

test("rejects negative, fractional and unsafe line amounts", () => {
  for (const debit of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => createJournalVoucher(validVoucher({
        lines: [
          { ...validVoucher().lines[1]!, debit },
          validVoucher().lines[0]!,
        ],
      })),
      (error: unknown) =>
        error instanceof JournalVoucherValidationError &&
        error.code === "line_amount_invalid",
    );
  }
});

test("rejects duplicate or invalid line ordering", () => {
  assert.throws(
    () => createJournalVoucher(validVoucher({
      lines: [
        { ...validVoucher().lines[0]!, order: 1 },
        { ...validVoucher().lines[1]!, order: 1 },
      ],
    })),
    (error: unknown) =>
      error instanceof JournalVoucherValidationError &&
      error.code === "line_order_duplicate",
  );

  assert.throws(
    () => createJournalVoucher(validVoucher({
      lines: [
        { ...validVoucher().lines[0]!, order: 0 },
        validVoucher().lines[1]!,
      ],
    })),
    (error: unknown) =>
      error instanceof JournalVoucherValidationError &&
      error.code === "line_order_invalid",
  );
});

test("rejects an unbalanced voucher", () => {
  assert.throws(
    () => createJournalVoucher(validVoucher({
      lines: [
        validVoucher().lines[0]!,
        { ...validVoucher().lines[1]!, debit: 900_000 },
      ],
    })),
    (error: unknown) =>
      error instanceof JournalVoucherValidationError &&
      error.code === "voucher_unbalanced",
  );
});

test("rejects invalid Gregorian voucher dates", () => {
  for (const voucherDate of ["1405/05/21", "2026-02-30", "2026-13-01"]) {
    assert.throws(
      () => createJournalVoucher(validVoucher({ voucherDate })),
      (error: unknown) =>
        error instanceof JournalVoucherValidationError &&
        error.code === "date_invalid",
    );
  }
});

test("rejects invalid optimistic versions and currency codes", () => {
  assert.throws(
    () => createJournalVoucher(validVoucher({ version: 0 })),
    (error: unknown) =>
      error instanceof JournalVoucherValidationError &&
      error.code === "version_invalid",
  );

  assert.throws(
    () => createJournalVoucher(validVoucher({ currency: "rial" })),
    (error: unknown) =>
      error instanceof JournalVoucherValidationError &&
      error.code === "currency_invalid",
  );
});
