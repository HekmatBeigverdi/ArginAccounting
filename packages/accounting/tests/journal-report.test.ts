import assert from "node:assert/strict";
import test from "node:test";

import type { Account } from "../src/domain/account.ts";
import { createJournalReport, type JournalReportJournalLineFact } from "../src/journal-report.ts";
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
  accountId: string,
  voucherDate: string,
  debit: number,
  credit: number,
  extra: Partial<JournalReportJournalLineFact> = {},
): JournalReportJournalLineFact {
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
  account("sales", "general", true),
];

function query() {
  return normalizeAccountingReportQuery({
    companyId: "company-1",
    currency: "IRR",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
  });
}

test("creates a chronologically ordered journal report with balanced totals", () => {
  const result = createJournalReport(query(), accounts, [
    fact("10", "sales", "2026-04-10", 0, 100, { voucherNumber: "10", lineOrder: 2 }),
    fact("2", "cash", "2026-04-10", 100, 0, { voucherNumber: "2", lineOrder: 1 }),
  ]);

  assert.deepEqual(result.rows.map((row) => row.voucherNumber), ["2", "10"]);
  assert.deepEqual(result.totals, { debit: 100, credit: 100 });
  assert.equal(result.isBalanced, true);
});

test("preserves account, description, dimension and trace identities", () => {
  const result = createJournalReport(query(), accounts, [
    fact("1", "cash", "2026-04-05", 100, 0, {
      voucherDescription: "voucher",
      lineDescription: " line description ",
      voucherReference: " ref-1 ",
      dimensions: [
        { dimensionTypeId: "project", memberId: "p-1" },
        { dimensionTypeId: "cost-center", memberId: "cc-1" },
      ],
    }),
  ]);

  const row = result.rows[0]!;
  assert.equal(row.voucherId, "v-1");
  assert.equal(row.journalLineId, "1");
  assert.equal(row.accountId, "cash");
  assert.equal(row.description, "line description");
  assert.equal(row.voucherReference, "ref-1");
  assert.deepEqual(row.dimensions, [
    { dimensionTypeId: "cost-center", memberId: "cc-1" },
    { dimensionTypeId: "project", memberId: "p-1" },
  ]);
});

test("respects posted, branch, date, dimension and account hierarchy filters", () => {
  const selected = normalizeAccountingReportQuery({
    companyId: "company-1",
    branch: { mode: "branch", branchId: "branch-1" },
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
    accounts: { accountId: "general", includeDescendants: true },
    dimensions: [{ dimensionTypeId: "cost-center", memberIds: ["cc-1"] }],
  });

  const result = createJournalReport(selected, accounts, [
    fact("match", "cash", "2026-04-05", 100, 0, {
      dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-1" }],
    }),
    fact("draft", "cash", "2026-04-05", 200, 0, {
      isPostedFact: false,
      dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-1" }],
    }),
    fact("branch", "cash", "2026-04-05", 300, 0, {
      branchId: "branch-2",
      dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-1" }],
    }),
    fact("dimension", "cash", "2026-04-05", 400, 0, {
      dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-2" }],
    }),
    fact("before", "cash", "2026-03-31", 500, 0, {
      dimensions: [{ dimensionTypeId: "cost-center", memberId: "cc-1" }],
    }),
  ]);

  assert.deepEqual(result.rows.map((row) => row.journalLineId), ["match"]);
});

test("keeps reversal original and inverse as separate chronological facts", () => {
  const result = createJournalReport(query(), accounts, [
    fact("original", "cash", "2026-04-05", 250, 0, { voucherNumber: "1" }),
    fact("reversal", "cash", "2026-04-08", 0, 250, { voucherNumber: "2" }),
  ]);

  assert.deepEqual(result.rows.map((row) => row.journalLineId), ["original", "reversal"]);
  assert.deepEqual(result.totals, { debit: 250, credit: 250 });
  assert.equal(result.isBalanced, true);
});
