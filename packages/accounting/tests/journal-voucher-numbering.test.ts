import assert from "node:assert/strict";
import test from "node:test";

import {
  DefaultNumberSeries,
  InMemoryNumberSeriesStore,
} from "@argin/platform";

import {
  DEFAULT_JOURNAL_VOUCHER_NUMBER_SERIES_DEFINITION,
  JOURNAL_VOUCHER_NUMBER_SERIES_TYPE,
  createJournalVoucherNumberSeriesScope,
  reserveJournalVoucherNumber,
} from "../src/application/journal-voucher-numbering.ts";

function createSeries() {
  return new DefaultNumberSeries(
    new InMemoryNumberSeriesStore(),
    [DEFAULT_JOURNAL_VOUCHER_NUMBER_SERIES_DEFINITION],
  );
}

test("reserves deterministic padded journal voucher numbers", async () => {
  const series = createSeries();

  const first = await reserveJournalVoucherNumber(series, {
    companyId: "company-1",
    branchId: "branch-1",
    fiscalYearId: "fy-1405",
  });
  const second = await reserveJournalVoucherNumber(series, {
    companyId: "company-1",
    branchId: "branch-1",
    fiscalYearId: "fy-1405",
  });

  assert.equal(first.seriesType, JOURNAL_VOUCHER_NUMBER_SERIES_TYPE);
  assert.equal(first.sequence, 1);
  assert.equal(first.formattedValue, "000001");
  assert.equal(second.sequence, 2);
  assert.equal(second.formattedValue, "000002");
});

test("keeps counters isolated by company, branch and fiscal year", async () => {
  const series = createSeries();

  const scopes = [
    { companyId: "company-1", branchId: "branch-1", fiscalYearId: "fy-1405" },
    { companyId: "company-1", branchId: "branch-2", fiscalYearId: "fy-1405" },
    { companyId: "company-1", branchId: "branch-1", fiscalYearId: "fy-1406" },
    { companyId: "company-2", branchId: "branch-1", fiscalYearId: "fy-1405" },
  ] as const;

  const numbers = await Promise.all(
    scopes.map((scope) => reserveJournalVoucherNumber(series, scope)),
  );

  assert.deepEqual(
    numbers.map((number) => number.formattedValue),
    ["000001", "000001", "000001", "000001"],
  );
});

test("uses company/fiscal-year scope when voucher has no branch", async () => {
  const series = createSeries();

  const first = await reserveJournalVoucherNumber(series, {
    companyId: "company-1",
    branchId: null,
    fiscalYearId: "fy-1405",
  });
  const branchSpecific = await reserveJournalVoucherNumber(series, {
    companyId: "company-1",
    branchId: "branch-1",
    fiscalYearId: "fy-1405",
  });

  assert.equal(first.formattedValue, "000001");
  assert.equal(branchSpecific.formattedValue, "000001");
  assert.equal("branchId" in first.scope, false);
});

test("concurrent reservations receive distinct numbers in the same scope", async () => {
  const series = createSeries();

  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      reserveJournalVoucherNumber(series, {
        companyId: "company-1",
        branchId: "branch-1",
        fiscalYearId: "fy-1405",
      }),
    ),
  );

  const values = results.map((result) => result.formattedValue);
  assert.equal(new Set(values).size, 20);
  assert.deepEqual(
    values.slice().sort(),
    Array.from({ length: 20 }, (_, index) =>
      String(index + 1).padStart(6, "0"),
    ),
  );
});

test("retrying number allocation advances instead of duplicating a prior reservation", async () => {
  const series = createSeries();
  const scope = {
    companyId: "company-1",
    branchId: "branch-1",
    fiscalYearId: "fy-1405",
  } as const;

  const firstAttempt = await reserveJournalVoucherNumber(series, scope);
  const retryAttempt = await reserveJournalVoucherNumber(series, scope);

  assert.notEqual(firstAttempt.formattedValue, retryAttempt.formattedValue);
  assert.equal(firstAttempt.formattedValue, "000001");
  assert.equal(retryAttempt.formattedValue, "000002");
});

test("normalizes and validates journal voucher numbering scope", () => {
  assert.deepEqual(
    createJournalVoucherNumberSeriesScope({
      companyId: " company-1 ",
      branchId: " branch-1 ",
      fiscalYearId: " fy-1405 ",
    }),
    {
      companyId: "company-1",
      branchId: "branch-1",
      fiscalYearId: "fy-1405",
    },
  );

  assert.throws(
    () =>
      createJournalVoucherNumberSeriesScope({
        companyId: " ",
        branchId: null,
        fiscalYearId: "fy-1405",
      }),
    TypeError,
  );
});
