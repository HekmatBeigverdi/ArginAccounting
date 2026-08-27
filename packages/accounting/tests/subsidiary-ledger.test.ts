import assert from "node:assert/strict";
import test from "node:test";

import type { Account } from "../src/domain/account.ts";
import type { GeneralLedgerJournalLineFact } from "../src/general-ledger.ts";
import { normalizeAccountingReportQuery } from "../src/reporting.ts";
import { createSubsidiaryLedger } from "../src/subsidiary-ledger.ts";

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

function fact(
  id: string,
  accountId: string,
  voucherDate: string,
  debit: number,
  credit: number,
  extra: Partial<GeneralLedgerJournalLineFact> = {},
): GeneralLedgerJournalLineFact {
  return {
    companyId: "company-1",
    currency: "IRR",
    branchId: "branch-1",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "fp-1",
    voucherId: `v-${id}`,
    journalLineId: id,
    voucherDate,
    accountId,
    debit,
    credit,
    isPostedFact: true,
    voucherNumber: id,
    lineOrder: 1,
    ...extra,
  };
}

const accounts = [
  account("group", null, false),
  account("general", "group", false),
  account("cash", "general", true),
  account("bank", "general", true),
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

test("creates posting-account turnover sections with opening, movement and ending balances", () => {
  const result = createSubsidiaryLedger(query(), accounts, [
    fact("1", "cash", "2026-03-20", 300, 0),
    fact("2", "cash", "2026-04-05", 200, 0),
    fact("3", "cash", "2026-04-10", 0, 50),
  ]);

  assert.deepEqual(result.accounts.map((section) => section.accountId), ["cash"]);
  const cash = result.accounts[0]!;
  assert.equal(cash.turnover.openingNet, 300);
  assert.equal(cash.turnover.periodDebit, 200);
  assert.equal(cash.turnover.periodCredit, 50);
  assert.equal(cash.turnover.endingNet, 450);
  assert.equal(cash.turnover.movementCount, 2);
  assert.deepEqual(cash.movements.map((movement) => movement.runningNet), [500, 450]);
});

test("preserves normalized dimension assignments on each detailed movement", () => {
  const result = createSubsidiaryLedger(query(), accounts, [
    fact("10", "cash", "2026-04-05", 100, 0, {
      dimensions: [
        { dimensionTypeId: "project", memberId: "p-2" },
        { dimensionTypeId: "cost-center", memberId: "cc-1" },
      ],
    }),
  ]);

  assert.deepEqual(result.accounts[0]!.movements[0]!.dimensions, [
    { dimensionTypeId: "cost-center", memberId: "cc-1" },
    { dimensionTypeId: "project", memberId: "p-2" },
  ]);
});

test("expands a selected parent to posting descendants without emitting parent sections", () => {
  const selected = normalizeAccountingReportQuery({
    companyId: "company-1",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
    accounts: { accountId: "general", includeDescendants: true },
  });

  const result = createSubsidiaryLedger(selected, accounts, [
    fact("1", "cash", "2026-04-05", 100, 0),
    fact("2", "bank", "2026-04-06", 0, 40),
  ]);

  assert.deepEqual(result.accounts.map((section) => section.accountId), ["cash", "bank"]);
  assert.equal(result.accounts.some((section) => section.accountId === "general"), false);
});

test("respects explicit posting account list and zero-balance visibility", () => {
  const selected = normalizeAccountingReportQuery({
    companyId: "company-1",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
    accounts: { accountIds: ["cash", "unused"] },
    includeZeroBalances: true,
  });

  const result = createSubsidiaryLedger(selected, accounts, [
    fact("1", "cash", "2026-04-05", 100, 0),
  ]);

  assert.deepEqual(result.accounts.map((section) => section.accountId), ["cash", "unused"]);
  assert.equal(result.accounts[1]!.turnover.movementCount, 0);
  assert.equal(result.accounts[1]!.turnover.endingNet, 0);
});

test("inherits posted, branch and dimension filtering from the canonical ledger scope", () => {
  const selected = normalizeAccountingReportQuery({
    companyId: "company-1",
    branch: { mode: "branch", branchId: "branch-1" },
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
    dimensions: [{ dimensionTypeId: "cost-center", memberIds: ["cc-1"] }],
  });

  const result = createSubsidiaryLedger(selected, accounts, [
    fact("match", "cash", "2026-04-05", 100, 0, {
      dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-1" }],
    }),
    fact("draft", "cash", "2026-04-06", 200, 0, {
      isPostedFact: false,
      dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-1" }],
    }),
    fact("other-branch", "cash", "2026-04-07", 300, 0, {
      branchId: "branch-2",
      dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-1" }],
    }),
    fact("other-dimension", "cash", "2026-04-08", 400, 0, {
      dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-2" }],
    }),
  ]);

  assert.equal(result.accounts.length, 1);
  assert.equal(result.accounts[0]!.turnover.periodDebit, 100);
  assert.deepEqual(result.accounts[0]!.movements.map((movement) => movement.journalLineId), ["match"]);
});
