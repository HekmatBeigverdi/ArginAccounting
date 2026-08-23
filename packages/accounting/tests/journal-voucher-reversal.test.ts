import assert from "node:assert/strict";
import test from "node:test";

import { createAccount } from "../src/domain/create-account.ts";
import type { JournalVoucher } from "../src/domain/journal-voucher.ts";
import { createJournalVoucher } from "../src/domain/journal-voucher.ts";
import {
  JournalVoucherReversalError,
  reverseJournalVoucher,
  type JournalVoucherReversalRecord,
  type JournalVoucherReversalSession,
} from "../src/application/journal-voucher-reversal.ts";

function postedVoucher(id = "voucher-1"): JournalVoucher {
  const draft = createJournalVoucher({
    id,
    companyId: "company-1",
    branchId: "branch-1",
    number: id === "voucher-1" ? "JV-000001" : "JV-000010",
    voucherDate: "2026-08-01",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-05",
    lines: [
      { id: `${id}-line-1`, order: 1, accountId: "cash", debit: 1_000, credit: 0 },
      { id: `${id}-line-2`, order: 2, accountId: "revenue", debit: 0, credit: 1_000 },
    ],
    createdAt: "2026-08-01T08:00:00.000Z",
    version: 3,
  });
  return Object.freeze({ ...draft, status: "posted" as const });
}

function postingAccount(id: string) {
  return createAccount({
    id,
    companyId: "company-1",
    parentId: "general-1",
    level: "subsidiary",
    code: id === "cash" ? "110101" : "410101",
    name: id,
    nature: id === "cash" ? "debit" : "credit",
    normalBalance: id === "cash" ? "debit" : "credit",
    statementType: id === "cash" ? "balance_sheet" : "income_statement",
    postingAllowed: true,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
}

function harness() {
  let original = postedVoucher();
  let reversalRecord: JournalVoucherReversalRecord | null = null;
  const vouchers = new Map<string, JournalVoucher>([[original.id, original]]);

  const session: JournalVoucherReversalSession = {
    async getVoucher(id) { return vouchers.get(id) ?? null; },
    async getReversalByRequestId(_companyId, requestId) {
      return reversalRecord?.lineage.requestId === requestId ? reversalRecord : null;
    },
    async getReversalLineageByOriginalVoucherId(originalVoucherId) {
      return reversalRecord?.lineage.originalVoucherId === originalVoucherId
        ? reversalRecord.lineage
        : null;
    },
    async saveReversal(input) {
      original = input.originalVoucher;
      vouchers.set(original.id, original);
      vouchers.set(input.reversalVoucher.id, input.reversalVoucher);
      reversalRecord = {
        originalVoucher: input.originalVoucher,
        reversalVoucher: input.reversalVoucher,
        lineage: input.lineage,
      };
    },
  };

  let idSequence = 0;
  const deps = {
    accounts: {
      async findById(id: string) { return postingAccount(id); },
    },
    fiscalContext: {
      async resolve() {
        return {
          companyId: "company-1",
          fiscalYearId: "fy-1405",
          fiscalYearStartDate: "2026-03-21",
          fiscalYearEndDate: "2027-03-20",
          fiscalYearStatus: "open" as const,
          fiscalPeriodId: "fp-06",
          fiscalPeriodStartDate: "2026-08-01",
          fiscalPeriodEndDate: "2026-08-31",
          fiscalPeriodStatus: "open" as const,
        };
      },
    },
    dimensions: {
      async findPoliciesForAccounts() { return []; },
      async findTypesByCompanyId() { return []; },
      async findMembersByIds() { return []; },
    },
    identifiers: {
      generate() { idSequence += 1; return `generated-${idSequence}`; },
    },
    numberSeries: {
      async next() {
        return {
          seriesType: "accounting.journal-voucher",
          sequence: 2,
          formattedValue: "JV-000002",
          scope: { companyId: "company-1", branchId: "branch-1", fiscalYearId: "fy-1405" },
        };
      },
    },
    unitOfWork: {
      async run<T>(work: (value: JournalVoucherReversalSession) => Promise<T>): Promise<T> {
        return work(session);
      },
    },
  };

  return { deps, vouchers };
}

const command = {
  originalVoucherId: "voucher-1",
  companyId: "company-1",
  expectedVersion: 3,
  actorId: "user-1",
  occurredAt: "2026-08-23T12:00:00.000Z",
  reversalDate: "2026-08-23",
  requestId: "reverse-request-1",
  reason: "ثبت اشتباه سند",
};

test("creates a separate posted inverse voucher and marks original reversed atomically", async () => {
  const { deps } = harness();
  const result = await reverseJournalVoucher(command, deps);

  assert.equal(result.replayed, false);
  assert.equal(result.originalVoucher.status, "reversed");
  assert.equal(result.reversalVoucher.status, "posted");
  assert.equal(result.reversalVoucher.lines[0]?.debit.amount, 0);
  assert.equal(result.reversalVoucher.lines[0]?.credit.amount, 1_000);
  assert.equal(result.reversalVoucher.lines[1]?.debit.amount, 1_000);
  assert.equal(result.reversalVoucher.lines[1]?.credit.amount, 0);
  assert.equal(result.lineage.originalVoucherId, "voucher-1");
  assert.equal(result.lineage.reversalVoucherId, result.reversalVoucher.id);
});

test("same request id replays the existing reversal instead of creating another voucher", async () => {
  const { deps } = harness();
  const first = await reverseJournalVoucher(command, deps);
  const replay = await reverseJournalVoucher(command, deps);

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.reversalVoucher.id, first.reversalVoucher.id);
});

test("rejects a second reversal with a different request id", async () => {
  const { deps } = harness();
  await reverseJournalVoucher(command, deps);

  await assert.rejects(
    () => reverseJournalVoucher(
      { ...command, requestId: "reverse-request-2", expectedVersion: 4 },
      deps,
    ),
    (error: unknown) =>
      error instanceof JournalVoucherReversalError &&
      error.code === "journal.already-reversed",
  );
});

test("records optional replacement voucher lineage without mutating the original facts", async () => {
  const { deps, vouchers } = harness();
  const replacement = Object.freeze({
    ...postedVoucher("replacement-1"),
    status: "draft" as const,
    version: 1,
  });
  vouchers.set(replacement.id, replacement);

  const result = await reverseJournalVoucher(
    { ...command, replacementVoucherId: replacement.id },
    deps,
  );

  assert.equal(result.lineage.replacementVoucherId, replacement.id);
  assert.equal(result.originalVoucher.lines[0]?.debit.amount, 1_000);
  assert.equal(result.originalVoucher.lines[0]?.credit.amount, 0);
});
