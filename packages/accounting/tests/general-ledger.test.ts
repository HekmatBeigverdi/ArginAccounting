import assert from "node:assert/strict";
import test from "node:test";

import type { Account } from "../src/domain/account.ts";
import {
  createGeneralLedger,
  GeneralLedgerError,
  type GeneralLedgerJournalLineFact,
} from "../src/general-ledger.ts";
import { normalizeAccountingReportQuery } from "../src/reporting.ts";

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
  overrides: Partial<GeneralLedgerJournalLineFact> = {},
): GeneralLedgerJournalLineFact {
  return {
    companyId: "company-1",
    currency: "IRR",
    branchId: "branch-1",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "fp-1",
    voucherId: `voucher-${id}`,
    journalLineId: `line-${id}`,
    voucherDate: "2026-04-10",
    voucherNumber: id,
    lineOrder: 1,
    accountId: "cash",
    debit: 100,
    credit: 0,
    isPostedFact: true,
    voucherDescription: null,
    lineDescription: null,
    ...overrides,
  };
}

const accounts = [
  account("group", null, false),
  account("general", "group", false),
  account("cash", "general", true),
  account("bank", "general", true),
  account("unused", "general", true),
];

function query(accountId = "cash") {
  return normalizeAccountingReportQuery({
    companyId: "company-1",
    currency: "IRR",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
    accounts: { accountId, includeDescendants: false },
  });
}

test("builds opening balance, deterministic movements and running balance", () => {
  const result = createGeneralLedger(query(), accounts, [
    fact("opening", {
      voucherDate: "2026-03-20",
      voucherNumber: "1",
      debit: 500,
      credit: 0,
    }),
    fact("later-number", {
      voucherDate: "2026-04-10",
      voucherNumber: "10",
      lineOrder: 1,
      debit: 0,
      credit: 50,
      lineDescription: "  پرداخت  ",
    }),
    fact("earlier-number", {
      voucherDate: "2026-04-10",
      voucherNumber: "2",
      lineOrder: 2,
      debit: 200,
      credit: 0,
      voucherDescription: "دریافت",
    }),
    fact("first-line", {
      voucherDate: "2026-04-10",
      voucherNumber: "2",
      lineOrder: 1,
      debit: 0,
      credit: 100,
      lineDescription: "اصلاح",
    }),
  ]);

  assert.equal(result.sections.length, 1);
  const section = result.sections[0]!;
  assert.deepEqual(section.openingBalance, { debit: 500, credit: 0 });
  assert.equal(section.openingNet, 500);
  assert.deepEqual(
    section.movements.map((row) => [row.voucherNumber, row.lineOrder]),
    [["2", 1], ["2", 2], ["10", 1]],
  );
  assert.deepEqual(
    section.movements.map((row) => row.runningNet),
    [400, 600, 550],
  );
  assert.equal(section.movements[0]!.description, "اصلاح");
  assert.equal(section.movements[1]!.description, "دریافت");
  assert.equal(section.movements[2]!.description, "پرداخت");
  assert.deepEqual(section.endingBalance, { debit: 550, credit: 0 });
  assert.equal(section.periodDebit, 200);
  assert.equal(section.periodCredit, 150);
  assert.equal(section.movements[0]!.voucherId, "voucher-first-line");
  assert.equal(section.movements[0]!.journalLineId, "line-first-line");
});

test("aggregates a parent ledger from posting descendants without synthetic parent movement", () => {
  const result = createGeneralLedger(query("general"), accounts, [
    fact("cash", { accountId: "cash", debit: 300, credit: 0 }),
    fact("bank", { accountId: "bank", debit: 0, credit: 120, voucherNumber: "2" }),
  ]);

  const section = result.sections[0]!;
  assert.deepEqual(section.postingAccountIds, ["cash", "bank"]);
  assert.deepEqual(section.movements.map((row) => row.postingAccountId), ["cash", "bank"]);
  assert.equal(section.periodDebit, 300);
  assert.equal(section.periodCredit, 120);
  assert.equal(section.endingNet, 180);
});

test("respects posted, branch, currency and fiscal-period scope", () => {
  const scopedQuery = normalizeAccountingReportQuery({
    companyId: "company-1",
    currency: "IRR",
    branch: { mode: "branch", branchId: "branch-1" },
    period: {
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
      fiscalYearId: "fy-1",
      fiscalPeriodId: "fp-1",
    },
    accounts: { accountId: "cash", includeDescendants: false },
  });

  const result = createGeneralLedger(scopedQuery, accounts, [
    fact("match", { debit: 100, credit: 0 }),
    fact("draft", { debit: 500, credit: 0, isPostedFact: false }),
    fact("branch", { debit: 700, credit: 0, branchId: "branch-2" }),
    fact("currency", { debit: 900, credit: 0, currency: "USD" }),
    fact("period", { debit: 1100, credit: 0, fiscalPeriodId: "fp-2" }),
  ]);

  const section = result.sections[0]!;
  assert.equal(section.movements.length, 1);
  assert.equal(section.movements[0]!.journalLineId, "line-match");
  assert.equal(section.endingNet, 100);
});

test("keeps reversed original and inverse movements as separate traceable facts", () => {
  const result = createGeneralLedger(query(), accounts, [
    fact("original", { debit: 250, credit: 0, voucherNumber: "5" }),
    fact("reversal", { debit: 0, credit: 250, voucherNumber: "6" }),
  ]);

  const section = result.sections[0]!;
  assert.equal(section.movements.length, 2);
  assert.deepEqual(section.movements.map((row) => row.runningNet), [250, 0]);
  assert.equal(section.endingNet, 0);
});

test("rejects detail facts without deterministic voucher number or line order", () => {
  assert.throws(
    () => createGeneralLedger(query(), accounts, [
      fact("bad", { voucherNumber: " ", lineOrder: 0 }),
    ]),
    (error: unknown) =>
      error instanceof GeneralLedgerError &&
      error.code === "report.general-ledger.invalid-detail-fact",
  );
});
