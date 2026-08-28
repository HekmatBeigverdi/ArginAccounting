import assert from "node:assert/strict";
import test from "node:test";

import type { Account } from "../src/domain/account.ts";
import { normalizeAccountingReportQuery } from "../src/reporting.ts";
import {
  AccountingReportBalanceError,
  calculateAccountBalanceTurnover,
  type AccountingReportJournalLineFact,
} from "../src/reporting-balance.ts";

function account(id: string, parentId: string | null, postingAllowed: boolean, companyId = "company-1"): Account {
  return {
    id,
    companyId,
    parentId,
    level: postingAllowed ? "subsidiary" : parentId ? "general" : "group",
    code: id as Account["code"],
    name: id as Account["name"],
    englishName: null,
    nature: "uncontrolled",
    normalBalance: "debit",
    statementType: "balance_sheet",
    reportClassification: {} as Account["reportClassification"],
    postingAllowed,
    currencyEnabled: false,
    revaluationEnabled: false,
    trackingEnabled: false,
    dueDateEnabled: false,
    status: "active",
    displayOrder: 0,
    sourceType: "manual",
    sourceReferenceId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
}

function fact(
  overrides: Partial<AccountingReportJournalLineFact> &
    Pick<AccountingReportJournalLineFact, "journalLineId" | "voucherDate" | "accountId">,
): AccountingReportJournalLineFact {
  return {
    companyId: "company-1",
    currency: "IRR",
    branchId: "branch-1",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "fp-1",
    voucherId: `voucher-${overrides.journalLineId}`,
    debit: 0,
    credit: 100,
    isPostedFact: true,
    ...overrides,
  };
}

const accounts = [
  account("group", null, false),
  account("general", "group", false),
  account("cash", "general", true),
  account("bank", "general", true),
];

function baseQuery() {
  return normalizeAccountingReportQuery({
    companyId: "company-1",
    branch: { mode: "all" },
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
  });
}

test("computes opening, period and ending balances with debit-credit net semantics", () => {
  const rows = calculateAccountBalanceTurnover(baseQuery(), accounts, [
    fact({ journalLineId: "1", voucherDate: "2026-03-20", accountId: "cash", debit: 500, credit: 0 }),
    fact({ journalLineId: "2", voucherDate: "2026-03-25", accountId: "cash", debit: 0, credit: 100 }),
    fact({ journalLineId: "3", voucherDate: "2026-04-05", accountId: "cash", debit: 200, credit: 0 }),
    fact({ journalLineId: "4", voucherDate: "2026-04-10", accountId: "cash", debit: 0, credit: 50 }),
  ]);
  const cash = rows.find((row) => row.accountId === "cash")!;
  assert.deepEqual(cash.opening, { debit: 400, credit: 0 });
  assert.deepEqual(cash.period, { debit: 200, credit: 50 });
  assert.deepEqual(cash.ending, { debit: 550, credit: 0 });
  assert.equal(cash.openingNet, 400);
  assert.equal(cash.endingNet, 550);
});

test("aggregates parent accounts from distinct posting descendants without double counting", () => {
  const rows = calculateAccountBalanceTurnover(baseQuery(), accounts, [
    fact({ journalLineId: "1", voucherDate: "2026-04-05", accountId: "cash", debit: 300, credit: 0 }),
    fact({ journalLineId: "2", voucherDate: "2026-04-06", accountId: "bank", debit: 0, credit: 120 }),
  ]);
  const group = rows.find((row) => row.accountId === "group")!;
  const general = rows.find((row) => row.accountId === "general")!;
  assert.deepEqual(group.postingAccountIds, ["cash", "bank"]);
  assert.deepEqual(general.postingAccountIds, ["cash", "bank"]);
  assert.deepEqual(group.period, { debit: 300, credit: 120 });
  assert.equal(group.endingNet, 180);
  assert.equal(general.endingNet, 180);
});

test("nets a reversed original with its separate posted inverse", () => {
  const rows = calculateAccountBalanceTurnover(baseQuery(), accounts, [
    fact({ journalLineId: "original", voucherDate: "2026-04-05", accountId: "cash", debit: 250, credit: 0 }),
    fact({ journalLineId: "reversal", voucherDate: "2026-04-08", accountId: "cash", debit: 0, credit: 250 }),
  ]);
  const cash = rows.find((row) => row.accountId === "cash")!;
  assert.deepEqual(cash.period, { debit: 250, credit: 250 });
  assert.deepEqual(cash.ending, { debit: 0, credit: 0 });
  assert.equal(cash.hasPeriodMovement, true);
  assert.equal(cash.hasEndingBalance, false);
});

test("excludes unposted, other-branch, branchless and other-currency facts for a scoped report", () => {
  const query = normalizeAccountingReportQuery({
    companyId: "company-1",
    currency: "IRR",
    branch: { mode: "branch", branchId: "branch-1" },
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
  });
  const rows = calculateAccountBalanceTurnover(query, accounts, [
    fact({ journalLineId: "posted", voucherDate: "2026-04-05", accountId: "cash", debit: 100, credit: 0 }),
    fact({ journalLineId: "draft", voucherDate: "2026-04-05", accountId: "cash", debit: 500, credit: 0, isPostedFact: false }),
    fact({ journalLineId: "other-branch", voucherDate: "2026-04-05", accountId: "cash", debit: 700, credit: 0, branchId: "branch-2" }),
    fact({ journalLineId: "branchless", voucherDate: "2026-04-05", accountId: "cash", debit: 900, credit: 0, branchId: null }),
    fact({ journalLineId: "usd", voucherDate: "2026-04-05", accountId: "cash", debit: 1100, credit: 0, currency: "USD" }),
  ]);
  const cash = rows.find((row) => row.accountId === "cash")!;
  assert.deepEqual(cash.period, { debit: 100, credit: 0 });
});

test("keeps prior fiscal periods in opening while applying selected period to movement", () => {
  const query = normalizeAccountingReportQuery({
    companyId: "company-1",
    period: {
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
      fiscalYearId: "fy-1",
      fiscalPeriodId: "fp-2",
    },
  });
  const rows = calculateAccountBalanceTurnover(query, accounts, [
    fact({ journalLineId: "opening", voucherDate: "2026-03-25", accountId: "cash", debit: 300, credit: 0, fiscalPeriodId: "fp-1" }),
    fact({ journalLineId: "period", voucherDate: "2026-04-05", accountId: "cash", debit: 100, credit: 0, fiscalPeriodId: "fp-2" }),
    fact({ journalLineId: "wrong-period", voucherDate: "2026-04-06", accountId: "cash", debit: 200, credit: 0, fiscalPeriodId: "fp-3" }),
  ]);
  const cash = rows.find((row) => row.accountId === "cash")!;
  assert.deepEqual(cash.opening, { debit: 300, credit: 0 });
  assert.deepEqual(cash.period, { debit: 100, credit: 0 });
  assert.deepEqual(cash.ending, { debit: 400, credit: 0 });
});

test("applies dimension filters before balance computation", () => {
  const query = normalizeAccountingReportQuery({
    companyId: "company-1",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30", fiscalYearId: "fy-1" },
    dimensions: [{ dimensionTypeId: "cost-center", memberIds: ["cc-1"] }],
  });
  const rows = calculateAccountBalanceTurnover(query, accounts, [
    fact({ journalLineId: "match", voucherDate: "2026-04-05", accountId: "cash", debit: 100, credit: 0, dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-1" }] }),
    fact({ journalLineId: "wrong", voucherDate: "2026-04-05", accountId: "cash", debit: 200, credit: 0, dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-2" }] }),
  ]);
  const cash = rows.find((row) => row.accountId === "cash")!;
  assert.deepEqual(cash.period, { debit: 100, credit: 0 });
});

test("supports root account selection with and without descendant rows", () => {
  const withDescendants = normalizeAccountingReportQuery({
    companyId: "company-1",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
    accounts: { accountId: "general", includeDescendants: true },
  });
  const rootOnly = normalizeAccountingReportQuery({
    companyId: "company-1",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
    accounts: { accountId: "general", includeDescendants: false },
  });
  assert.deepEqual(calculateAccountBalanceTurnover(withDescendants, accounts, []).map((row) => row.accountId), ["general", "cash", "bank"]);
  assert.deepEqual(calculateAccountBalanceTurnover(rootOnly, accounts, []).map((row) => row.accountId), ["general"]);
});

test("rejects malformed amount facts before they can corrupt balances", () => {
  assert.throws(
    () => calculateAccountBalanceTurnover(baseQuery(), accounts, [
      fact({ journalLineId: "bad", voucherDate: "2026-04-05", accountId: "cash", debit: 100, credit: 10 }),
    ]),
    (error: unknown) => error instanceof AccountingReportBalanceError && error.code === "report.balance.invalid-fact",
  );
});

test("treats from/to dates as inclusive period boundaries and excludes facts after toDate", () => {
  const rows = calculateAccountBalanceTurnover(baseQuery(), accounts, [
    fact({ journalLineId: "opening", voucherDate: "2026-03-31", accountId: "cash", debit: 40, credit: 0 }),
    fact({ journalLineId: "from", voucherDate: "2026-04-01", accountId: "cash", debit: 60, credit: 0 }),
    fact({ journalLineId: "to", voucherDate: "2026-04-30", accountId: "cash", debit: 0, credit: 25 }),
    fact({ journalLineId: "after", voucherDate: "2026-05-01", accountId: "cash", debit: 999, credit: 0 }),
  ]);
  const cash = rows.find((row) => row.accountId === "cash")!;
  assert.deepEqual(cash.opening, { debit: 40, credit: 0 });
  assert.deepEqual(cash.period, { debit: 60, credit: 25 });
  assert.deepEqual(cash.ending, { debit: 75, credit: 0 });
});

test("isolates company and fiscal-year facts before opening and movement computation", () => {
  const query = normalizeAccountingReportQuery({
    companyId: "company-1",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30", fiscalYearId: "fy-1" },
  });
  const rows = calculateAccountBalanceTurnover(query, accounts, [
    fact({ journalLineId: "match", voucherDate: "2026-04-05", accountId: "cash", debit: 100, credit: 0 }),
    fact({ journalLineId: "foreign-company", voucherDate: "2026-04-05", accountId: "cash", debit: 500, credit: 0, companyId: "company-2" }),
    fact({ journalLineId: "foreign-year", voucherDate: "2026-04-05", accountId: "cash", debit: 700, credit: 0, fiscalYearId: "fy-2" }),
  ]);
  const cash = rows.find((row) => row.accountId === "cash")!;
  assert.deepEqual(cash.period, { debit: 100, credit: 0 });
});

test("represents negative opening and ending net amounts on the credit side", () => {
  const rows = calculateAccountBalanceTurnover(baseQuery(), accounts, [
    fact({ journalLineId: "opening-credit", voucherDate: "2026-03-20", accountId: "cash", debit: 0, credit: 300 }),
    fact({ journalLineId: "movement-debit", voucherDate: "2026-04-10", accountId: "cash", debit: 50, credit: 0 }),
  ]);
  const cash = rows.find((row) => row.accountId === "cash")!;
  assert.equal(cash.openingNet, -300);
  assert.deepEqual(cash.opening, { debit: 0, credit: 300 });
  assert.equal(cash.endingNet, -250);
  assert.deepEqual(cash.ending, { debit: 0, credit: 250 });
});
