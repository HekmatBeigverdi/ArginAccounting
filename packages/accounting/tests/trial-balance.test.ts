import assert from "node:assert/strict";
import test from "node:test";

import type { Account } from "../src/domain/account.ts";
import { normalizeAccountingReportQuery } from "../src/reporting.ts";
import { createTrialBalance } from "../src/trial-balance.ts";
import type { AccountingReportJournalLineFact } from "../src/reporting-balance.ts";

function account(id: string, parentId: string | null, postingAllowed: boolean): Account {
  return {
    id,
    companyId: "company-1",
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

function fact(id: string, accountId: string, debit: number, credit: number): AccountingReportJournalLineFact {
  return {
    companyId: "company-1",
    currency: "IRR",
    branchId: "branch-1",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "fp-1",
    voucherId: `v-${id}`,
    journalLineId: id,
    voucherDate: "2026-04-10",
    accountId,
    debit,
    credit,
    isPostedFact: true,
  };
}

const accounts = [
  account("group", null, false),
  account("general", "group", false),
  account("cash", "general", true),
  account("sales", "general", true),
  account("unused", "general", true),
];

function query(includeZeroBalances = false) {
  return normalizeAccountingReportQuery({
    companyId: "company-1",
    currency: "IRR",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
    includeZeroBalances,
  });
}

test("projects trial balance from the canonical balance engine", () => {
  const result = createTrialBalance(query(), accounts, [
    fact("1", "cash", 1000, 0),
    fact("2", "sales", 0, 1000),
  ], 6);

  assert.equal(result.mode, 6);
  assert.equal(result.isBalanced, true);
  assert.deepEqual(result.totals, {
    openingDebit: 0,
    openingCredit: 0,
    periodDebit: 1000,
    periodCredit: 1000,
    endingDebit: 1000,
    endingCredit: 1000,
  });
  assert.equal(result.rows.some((row) => row.accountId === "unused"), false);
});

test("keeps zero-balance rows only when explicitly requested", () => {
  const hidden = createTrialBalance(query(false), accounts, [], 2);
  const visible = createTrialBalance(query(true), accounts, [], 2);

  assert.equal(hidden.rows.length, 0);
  assert.equal(visible.rows.length, accounts.length);
  assert.equal(visible.isBalanced, true);
});

test("supports 2, 4, 6 and 8-column projection modes over the same values", () => {
  for (const mode of [2, 4, 6, 8] as const) {
    const result = createTrialBalance(query(), accounts, [
      fact("1", "cash", 500, 0),
      fact("2", "sales", 0, 500),
    ], mode);
    assert.equal(result.mode, mode);
    assert.equal(result.isBalanced, true);
    assert.equal(result.totals.periodDebit, 500);
    assert.equal(result.totals.periodCredit, 500);
  }
});
