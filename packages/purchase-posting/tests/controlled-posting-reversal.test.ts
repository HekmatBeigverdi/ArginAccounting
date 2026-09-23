import assert from "node:assert/strict";
import test from "node:test";

import {
  createJournalVoucher,
} from "@argin/accounting/journal";
import type {
  JournalVoucher,
  JournalVoucherReversalResult,
} from "@argin/accounting/journal";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  rehydratePurchasePosting,
  reversePurchasePostingControlled,
} from "../src/index.ts";
import type {
  PurchasePostingReversalRecord,
  PurchasePostingReversalSession,
  PurchasePostingReversalUnitOfWork,
} from "../src/index.ts";

function postedPosting() {
  return rehydratePurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    status: "posted",
    journalVoucherId: "voucher-original",
    version: 4,
    createdAt: "2026-09-23T08:00:00.000Z",
    updatedAt: "2026-09-23T10:00:00.000Z",
  });
}

function voucher(id: string, status: "posted" | "reversed"): JournalVoucher {
  const base = createJournalVoucher({
    id,
    companyId: "company-001",
    branchId: "branch-001",
    number: id === "voucher-original" ? "JV-001" : "JV-REV-001",
    voucherDate: "2026-09-23",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    currency: "IRR",
    source: { type: "system", sourceId: "invoice-001" },
    lines: [
      { id: id + "-1", order: 1, accountId: "inventory", debit: 100, credit: 0 },
      { id: id + "-2", order: 2, accountId: "payable", debit: 0, credit: 100 },
    ],
    createdAt: "2026-09-23T10:00:00.000Z",
  });
  return Object.freeze({ ...base, status });
}

function journalReversal(replayed = false): JournalVoucherReversalResult {
  const original = voucher("voucher-original", "reversed");
  const reversal = voucher("voucher-reversal", "posted");
  return Object.freeze({
    originalVoucher: original,
    reversalVoucher: reversal,
    lineage: Object.freeze({
      originalVoucherId: "voucher-original",
      reversalVoucherId: "voucher-reversal",
      replacementVoucherId: null,
      requestId: "request-reversal-001",
      reversedBy: "actor-001",
      reversedAt: "2026-09-23T11:00:00.000Z",
      reason: "اصلاح ثبت اشتباه",
    }),
    replayed,
  });
}

function store() {
  let current = postedPosting();
  let record: PurchasePostingReversalRecord | null = null;
  let saveCount = 0;
  let journalReverseCount = 0;

  const unitOfWork: PurchasePostingReversalUnitOfWork = {
    async run<T>(work: (session: PurchasePostingReversalSession) => Promise<T>): Promise<T> {
      const session: PurchasePostingReversalSession = {
        async findPosting(id) {
          return id === current.postingId ? current : null;
        },
        async resolveFiscalContext() {
          return {
            companyId: "company-001",
            fiscalYearId: "fy-1405",
            fiscalYearStartDate: "2026-03-21",
            fiscalYearEndDate: "2027-03-20",
            fiscalYearStatus: "open" as const,
            fiscalPeriodId: "fp-07",
            fiscalPeriodStartDate: "2026-09-01",
            fiscalPeriodEndDate: "2026-09-30",
            fiscalPeriodStatus: "open" as const,
          };
        },
        async findActiveHistoricalLocks() {
          return [];
        },
        async findReversalByRequestId(_companyId, requestId) {
          return record?.requestId === requestId ? record : null;
        },
        async reverseJournal() {
          journalReverseCount += 1;
          return journalReversal(record !== null);
        },
        async saveReversedPosting(posting, expectedVersion, reversal) {
          assert.equal(current.version, expectedVersion);
          current = posting;
          record = reversal;
          saveCount += 1;
        },
      };
      return work(session);
    },
  };

  return {
    unitOfWork,
    get current() { return current; },
    get record() { return record; },
    get saveCount() { return saveCount; },
    get journalReverseCount() { return journalReverseCount; },
  };
}

const command = {
  postingId: "posting-001",
  companyId: "company-001",
  expectedPostingVersion: 4,
  expectedJournalVersion: 7,
  actorId: "actor-001",
  occurredAt: "2026-09-23T11:00:00.000Z",
  reversalDate: "2026-09-23",
  requestId: "request-reversal-001",
  reason: "اصلاح ثبت اشتباه",
};

test("reverses linked Accounting Journal and Purchase Posting together", async () => {
  const state = store();
  const result = await reversePurchasePostingControlled(command, state.unitOfWork);

  assert.equal(result.replayed, false);
  assert.equal(result.posting.status, "reversed");
  assert.equal(result.posting.version, 5);
  assert.equal(result.posting.journalVoucherId, "voucher-original");
  assert.equal(result.reversal.reversalJournalVoucherId, "voucher-reversal");
  assert.equal(result.journalReversal.reversalVoucher.status, "posted");
  assert.equal(state.saveCount, 1);
});

test("preserves original Journal link and records separate reversal Journal lineage", async () => {
  const state = store();
  const result = await reversePurchasePostingControlled(command, state.unitOfWork);

  assert.equal(result.reversal.originalJournalVoucherId, "voucher-original");
  assert.equal(result.reversal.reversalJournalVoucherId, "voucher-reversal");
  assert.notEqual(
    result.reversal.originalJournalVoucherId,
    result.reversal.reversalJournalVoucherId,
  );
});

test("exact reversal replay does not save Purchase Posting a second time", async () => {
  const state = store();
  await reversePurchasePostingControlled(command, state.unitOfWork);
  const replay = await reversePurchasePostingControlled(command, state.unitOfWork);

  assert.equal(replay.replayed, true);
  assert.equal(state.saveCount, 1);
  assert.equal(replay.posting.status, "reversed");
});

test("same reversal request id cannot target another Posting", async () => {
  const state = store();
  await reversePurchasePostingControlled(command, state.unitOfWork);

  await assert.rejects(
    () => reversePurchasePostingControlled({
      ...command,
      postingId: "posting-other",
    }, state.unitOfWork),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalConflict);
      return true;
    },
  );
});

test("stale Purchase Posting version blocks reversal before save", async () => {
  const state = store();

  await assert.rejects(
    () => reversePurchasePostingControlled({
      ...command,
      expectedPostingVersion: 3,
    }, state.unitOfWork),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.concurrencyConflict);
      return true;
    },
  );

  assert.equal(state.saveCount, 0);
});

test("non-posted Purchase Posting cannot be reversed", async () => {
  const state = store();
  const original = state.current;
  const unitOfWork: PurchasePostingReversalUnitOfWork = {
    async run<T>(work: (session: PurchasePostingReversalSession) => Promise<T>): Promise<T> {
      return work({
        async findPosting() {
          return rehydratePurchasePosting({
            ...original,
            status: "prepared",
          });
        },

        async resolveFiscalContext() {
          return {
            companyId: "company-001",
            fiscalYearId: "fy-1405",
            fiscalYearStartDate: "2026-03-21",
            fiscalYearEndDate: "2027-03-20",
            fiscalYearStatus: "open" as const,
            fiscalPeriodId: "fp-07",
            fiscalPeriodStartDate: "2026-09-01",
            fiscalPeriodEndDate: "2026-09-30",
            fiscalPeriodStatus: "open" as const,
          };
        },
        async findActiveHistoricalLocks() {
          return [];
        },
        async findReversalByRequestId() { return null; },
        async reverseJournal() { return journalReversal(); },
        async saveReversedPosting() {},
      });
    },
  };

  await assert.rejects(
    () => reversePurchasePostingControlled(command, unitOfWork),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalInvalid);
      return true;
    },
  );
});
