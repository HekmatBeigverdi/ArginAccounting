import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountingReportQueryError,
  normalizeAccountingReportQuery,
} from "../src/reporting.ts";

test("normalizes the shared report query with deterministic defaults", () => {
  const query = normalizeAccountingReportQuery({
    companyId: " company-1 ",
    period: { fromDate: "2026-03-21", toDate: "2027-03-20" },
  });

  assert.equal(query.companyId, "company-1");
  assert.deepEqual(query.branch, { mode: "all" });
  assert.deepEqual(query.period, {
    fromDate: "2026-03-21",
    toDate: "2027-03-20",
  });
  assert.deepEqual(query.accounts, {
    includeDescendants: false,
    accountIds: [],
  });
  assert.deepEqual(query.dimensions, []);
  assert.equal(query.includeZeroBalances, false);
  assert.deepEqual(query.sort, []);
  assert.equal(query.paging.page, 1);
  assert.equal(query.paging.offset, 0);
  assert.ok(Object.isFrozen(query));
});

test("normalizes explicit branch, fiscal, account, dimension, sort and trace filters", () => {
  const query = normalizeAccountingReportQuery({
    companyId: "company-1",
    branch: { mode: "branch", branchId: " branch-1 " },
    period: {
      fromDate: "2026-03-21",
      toDate: "2026-06-21",
      fiscalYearId: " fy-1 ",
      fiscalPeriodId: " fp-1 ",
    },
    accounts: { accountId: " account-1 " },
    dimensions: [
      { dimensionTypeId: " cost-center ", memberIds: [" m-1 ", "m-1", "m-2"] },
    ],
    includeZeroBalances: true,
    sort: [{ field: "voucherDate", direction: "desc" }],
    paging: { page: 3, pageSize: 25 },
    trace: { voucherId: " voucher-1 ", journalLineId: " line-1 " },
  });

  assert.deepEqual(query.branch, { mode: "branch", branchId: "branch-1" });
  assert.equal(query.period.fiscalYearId, "fy-1");
  assert.equal(query.period.fiscalPeriodId, "fp-1");
  assert.deepEqual(query.accounts, {
    accountId: "account-1",
    includeDescendants: true,
    accountIds: [],
  });
  assert.deepEqual(query.dimensions, [
    { dimensionTypeId: "cost-center", memberIds: ["m-1", "m-2"] },
  ]);
  assert.deepEqual(query.sort, [{ field: "voucherDate", direction: "desc" }]);
  assert.deepEqual(query.paging, { page: 3, pageSize: 25, offset: 50 });
  assert.deepEqual(query.trace, { voucherId: "voucher-1", journalLineId: "line-1" });
});

test("rejects invalid report periods", () => {
  assert.throws(
    () => normalizeAccountingReportQuery({
      companyId: "company-1",
      period: { fromDate: "2026-04-01", toDate: "2026-03-01" },
    }),
    (error) => error instanceof AccountingReportQueryError && error.code === "report.invalid-period",
  );

  assert.throws(
    () => normalizeAccountingReportQuery({
      companyId: "company-1",
      period: {
        fromDate: "2026-03-21",
        toDate: "2026-04-21",
        fiscalPeriodId: "period-1",
      },
    }),
    (error) => error instanceof AccountingReportQueryError && error.code === "report.invalid-period",
  );
});

test("rejects ambiguous account and duplicate dimension filters", () => {
  assert.throws(
    () => normalizeAccountingReportQuery({
      companyId: "company-1",
      period: { fromDate: "2026-03-21", toDate: "2026-04-21" },
      accounts: { accountId: "a1", accountIds: ["a2"] },
    }),
    (error) => error instanceof AccountingReportQueryError && error.code === "report.invalid-account-filter",
  );

  assert.throws(
    () => normalizeAccountingReportQuery({
      companyId: "company-1",
      period: { fromDate: "2026-03-21", toDate: "2026-04-21" },
      dimensions: [
        { dimensionTypeId: "d1", memberIds: ["m1"] },
        { dimensionTypeId: "d1", memberIds: ["m2"] },
      ],
    }),
    (error) => error instanceof AccountingReportQueryError && error.code === "report.invalid-dimension-filter",
  );
});

test("requires voucher trace identity before line trace identity", () => {
  assert.throws(
    () => normalizeAccountingReportQuery({
      companyId: "company-1",
      period: { fromDate: "2026-03-21", toDate: "2026-04-21" },
      trace: { journalLineId: "line-1" },
    }),
    (error) => error instanceof AccountingReportQueryError && error.code === "report.invalid-query",
  );
});
