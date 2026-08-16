import assert from "node:assert/strict";
import test from "node:test";

import { JournalVoucherApplicationError } from "../src/application/journal-voucher-application-error.ts";
import { normalizeJournalVoucherSearchQuery } from "../src/contracts/normalize-journal-voucher-query.ts";

test("normalizes journal search pagination and trims filters", () => {
  const query = normalizeJournalVoucherSearchQuery({
    companyId: " company-1 ",
    branchId: " branch-1 ",
    number: " 000123 ",
    text: "  بانک ",
    page: 2,
    pageSize: 25,
  });

  assert.equal(query.companyId, "company-1");
  assert.equal(query.branchId, "branch-1");
  assert.equal(query.number, "000123");
  assert.equal(query.text, "بانک");
  assert.equal(query.page, 2);
  assert.equal(query.pageSize, 25);
  assert.equal(query.offset, 25);
});

test("preserves explicit unscoped branch as null", () => {
  const query = normalizeJournalVoucherSearchQuery({
    companyId: "company-1",
    branchId: null,
  });

  assert.equal(query.branchId, null);
  assert.equal(query.page, 1);
  assert.equal(query.pageSize, 50);
  assert.equal(query.offset, 0);
});

test("rejects invalid pagination", () => {
  for (const input of [
    { companyId: "company-1", page: 0 },
    { companyId: "company-1", pageSize: 0 },
    { companyId: "company-1", pageSize: 501 },
  ]) {
    assert.throws(
      () => normalizeJournalVoucherSearchQuery(input),
      (error: unknown) =>
        error instanceof JournalVoucherApplicationError &&
        error.code === "journal.invalid-query",
    );
  }
});

test("rejects invalid or reversed date ranges", () => {
  assert.throws(
    () => normalizeJournalVoucherSearchQuery({
      companyId: "company-1",
      dateFrom: "2026-02-30",
    }),
    JournalVoucherApplicationError,
  );

  assert.throws(
    () => normalizeJournalVoucherSearchQuery({
      companyId: "company-1",
      dateFrom: "2026-08-12",
      dateTo: "2026-08-11",
    }),
    JournalVoucherApplicationError,
  );
});

test("application errors preserve stable code and diagnostic details", () => {
  const error = new JournalVoucherApplicationError(
    "journal.version-conflict",
    "نسخه سند تغییر کرده است.",
    { voucherId: "voucher-1", expectedVersion: 2 },
  );

  assert.equal(error.code, "journal.version-conflict");
  assert.deepEqual(error.details, {
    voucherId: "voucher-1",
    expectedVersion: 2,
  });
});
