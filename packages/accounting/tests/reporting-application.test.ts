import assert from "node:assert/strict";
import test from "node:test";

import type { Account } from "../src/domain/account.ts";
import {
  AccountingReportApplicationError,
  DefaultAccountingReportQueryService,
  toAccountingReportTraceIdentity,
  type AccountingReportDataReader,
  type AccountingReportDataSnapshot,
  type AccountingReportExecutionContext,
} from "../src/reporting-application.ts";

function account(id: string): Account {
  return {
    id,
    companyId: "company-1",
    parentId: null,
    level: "subsidiary",
    code: id as Account["code"],
    name: id as Account["name"],
    englishName: null,
    nature: "uncontrolled",
    normalBalance: "debit",
    statementType: "balance_sheet",
    reportClassification: {} as Account["reportClassification"],
    postingAllowed: true,
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

function snapshot(): AccountingReportDataSnapshot {
  const common = {
    companyId: "company-1",
    currency: "IRR",
    branchId: "branch-1",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "fp-1",
    voucherDate: "2026-04-10",
    isPostedFact: true,
  } as const;
  return {
    accounts: [account("cash"), account("sales")],
    balanceFacts: [
      { ...common, voucherId: "v1", journalLineId: "l1", accountId: "cash", debit: 100, credit: 0 },
      { ...common, voucherId: "v1", journalLineId: "l2", accountId: "sales", debit: 0, credit: 100 },
    ],
    ledgerFacts: [
      { ...common, voucherId: "v1", journalLineId: "l1", accountId: "cash", debit: 100, credit: 0, voucherNumber: "1", lineOrder: 1 },
      { ...common, voucherId: "v1", journalLineId: "l2", accountId: "sales", debit: 0, credit: 100, voucherNumber: "1", lineOrder: 2 },
    ],
    journalFacts: [
      { ...common, voucherId: "v1", journalLineId: "l1", accountId: "cash", debit: 100, credit: 0, voucherNumber: "1", lineOrder: 1 },
      { ...common, voucherId: "v1", journalLineId: "l2", accountId: "sales", debit: 0, credit: 100, voucherNumber: "1", lineOrder: 2 },
    ],
    dimensionTypes: [],
    dimensionMembers: [],
  };
}

class Reader implements AccountingReportDataReader {
  readonly contexts: AccountingReportExecutionContext[] = [];
  constructor(private readonly value: AccountingReportDataSnapshot = snapshot()) {}
  async read(context: AccountingReportExecutionContext): Promise<AccountingReportDataSnapshot> {
    this.contexts.push(context);
    return this.value;
  }
}

const report = {
  companyId: "company-1",
  period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
};

test("orchestrates canonical trial balance through persistence-neutral reader", async () => {
  const reader = new Reader();
  const service = new DefaultAccountingReportQueryService(reader);
  const result = await service.trialBalance({ report, mode: 6 });

  assert.equal(result.mode, 6);
  assert.equal(result.isBalanced, true);
  assert.equal(reader.contexts[0]!.kind, "trial-balance");
  assert.equal(reader.contexts[0]!.query.currency, "IRR");
});

test("returns stable journal paging metadata without changing canonical totals", async () => {
  const service = new DefaultAccountingReportQueryService(new Reader());
  const response = await service.journal({
    report: { ...report, paging: { page: 1, pageSize: 1 } },
  });

  assert.equal(response.result.totalDebit, 100);
  assert.equal(response.result.totalCredit, 100);
  assert.equal(response.page.totalItems, 2);
  assert.equal(response.page.totalPages, 2);
  assert.equal(response.page.items.length, 1);
  assert.equal(response.page.hasNextPage, true);
});

test("wraps reader failures in stable application error", async () => {
  const service = new DefaultAccountingReportQueryService({
    async read(): Promise<AccountingReportDataSnapshot> {
      throw new Error("db unavailable");
    },
  });

  await assert.rejects(
    () => service.generalLedger({ report }),
    (error: unknown) => error instanceof AccountingReportApplicationError &&
      error.code === "report.application.read-failed",
  );
});

test("rejects snapshots containing cross-company metadata", async () => {
  const invalid = snapshot();
  const service = new DefaultAccountingReportQueryService(new Reader({
    ...invalid,
    accounts: [{ ...invalid.accounts[0]!, companyId: "company-2" }],
  }));

  await assert.rejects(
    () => service.trialBalance({ report }),
    (error: unknown) => error instanceof AccountingReportApplicationError &&
      error.code === "report.application.invalid-snapshot",
  );
});

test("creates immutable durable trace identity", () => {
  const trace = toAccountingReportTraceIdentity(" v-1 ", " l-1 ");
  assert.deepEqual(trace, { voucherId: "v-1", journalLineId: "l-1" });
  assert.equal(Object.isFrozen(trace), true);
});
