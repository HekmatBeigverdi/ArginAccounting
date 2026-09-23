import assert from "node:assert/strict";
import test from "node:test";

import { createJournalVoucher } from "@argin/accounting/journal";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  commitPurchasePostingReplaySafe,
  createPurchasePosting,
  createPurchasePostingSourceIdentity,
} from "../src/index.ts";
import type {
  PurchasePostingIdempotencyRecord,
  PurchasePostingReplaySession,
  PurchasePostingReplayUnitOfWork,
} from "../src/index.ts";

const FP_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FP_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function posting() {
  return createPurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    createdAt: "2026-09-23T09:00:00.000Z",
  });
}

function journal() {
  return createJournalVoucher({
    id: "voucher-001",
    companyId: "company-001",
    branchId: "branch-001",
    number: "JV-000001",
    voucherDate: "2026-09-23",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    currency: "IRR",
    source: {
      type: "source_document",
      sourceId: "invoice-001",
      requestId: "request-001",
      correlationId: "correlation-001",
      causationId: null,
    },
    lines: [
      { id: "line-1", order: 1, accountId: "inventory", debit: 10_000, credit: 0 },
      { id: "line-2", order: 2, accountId: "payable", debit: 0, credit: 10_000 },
    ],
    createdAt: "2026-09-23T09:05:00.000Z",
  });
}

const source = createPurchasePostingSourceIdentity({
  companyId: "company-001",
  branchId: "branch-001",
  sourceType: "supplier-invoice",
  sourceId: "invoice-001",
  sourceVersion: 7,
  sourceRevision: 2,
});

function memoryUnitOfWork() {
  const records = new Map<string, PurchasePostingIdempotencyRecord>();
  const postings = new Map<string, ReturnType<typeof posting>>();
  const journals = new Map<string, ReturnType<typeof journal>>();
  let journalWrites = 0;

  const unitOfWork: PurchasePostingReplayUnitOfWork = {
    async run<T>(work: (session: PurchasePostingReplaySession) => Promise<T>): Promise<T> {
      const stagedRecords = new Map(records);
      const stagedPostings = new Map(postings);
      const stagedJournals = new Map(journals);

      const session: PurchasePostingReplaySession = {
        async findIdempotencyRecord(key) {
          return stagedRecords.get(key) ?? null;
        },
        async findPosting(id) {
          return stagedPostings.get(id) ?? (id === "posting-001" ? posting() : id === "posting-002" ? createPurchasePosting({
            postingId: "posting-002",
            companyId: "company-001",
            branchId: "branch-001",
            createdAt: "2026-09-23T10:00:00.000Z",
          }) : null);
        },
        async findPreparedPosting(id) {
          return stagedPostings.get(id) ?? null;
        },
        async findJournalDraft(id) {
          return stagedJournals.get(id) ?? null;
        },
        async createJournalDraft(value) {
          journalWrites += 1;
          stagedJournals.set(value.id, value);
        },
        async savePreparedPosting(value) {
          stagedPostings.set(value.postingId, value);
        },
        async saveIdempotencyRecord(value) {
          stagedRecords.set(value.idempotencyKey, value);
        },
      };

      const result = await work(session);
      records.clear(); stagedRecords.forEach((v, k) => records.set(k, v));
      postings.clear(); stagedPostings.forEach((v, k) => postings.set(k, v));
      journals.clear(); stagedJournals.forEach((v, k) => journals.set(k, v));
      return result;
    },
  };

  return { unitOfWork, records, postings, journals, get journalWrites() { return journalWrites; } };
}

function input(payloadFingerprint = FP_A) {
  return {
    posting: posting(),
    journal: journal(),
    source,
    purpose: "accounting-recognition" as const,
    payloadFingerprint,
    expectedPostingVersion: 1,
    occurredAt: "2026-09-23T09:10:00.000Z",
  };
}

test("first execution commits Journal, prepared Posting and idempotency record", async () => {
  const store = memoryUnitOfWork();
  const result = await commitPurchasePostingReplaySafe(input(), store.unitOfWork);

  assert.equal(result.replayed, false);
  assert.equal(result.posting.status, "prepared");
  assert.equal(store.records.size, 1);
  assert.equal(store.postings.size, 1);
  assert.equal(store.journals.size, 1);
  assert.equal(store.journalWrites, 1);
});

test("exact replay returns original committed outcome without duplicate Journal", async () => {
  const store = memoryUnitOfWork();
  const first = await commitPurchasePostingReplaySafe(input(), store.unitOfWork);
  const second = await commitPurchasePostingReplaySafe(input(), store.unitOfWork);

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.posting.postingId, first.posting.postingId);
  assert.equal(second.journal.id, first.journal.id);
  assert.equal(store.journalWrites, 1);
  assert.equal(store.records.size, 1);
});

test("same source/version/purpose with different payload fingerprint conflicts", async () => {
  const store = memoryUnitOfWork();
  await commitPurchasePostingReplaySafe(input(FP_A), store.unitOfWork);

  await assert.rejects(
    () => commitPurchasePostingReplaySafe(input(FP_B), store.unitOfWork),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.idempotencyConflict);
      return true;
    },
  );

  assert.equal(store.journalWrites, 1);
});

test("new source version creates a distinct idempotency identity", async () => {
  const store = memoryUnitOfWork();
  await commitPurchasePostingReplaySafe(input(), store.unitOfWork);

  const nextSource = createPurchasePostingSourceIdentity({
    ...source,
    sourceVersion: 8,
  });
  const nextPosting = createPurchasePosting({
    postingId: "posting-002",
    companyId: "company-001",
    branchId: "branch-001",
    createdAt: "2026-09-23T10:00:00.000Z",
  });
  const nextJournal = createJournalVoucher({
    ...journal(),
    id: "voucher-002",
    number: "JV-000002",
    source: {
      ...journal().source,
      sourceId: "invoice-001",
      requestId: "request-002",
    },
    lines: journal().lines.map((line, index) => ({
      id: `next-line-${index + 1}`,
      order: line.order,
      accountId: line.accountId,
      debit: line.debit.amount,
      credit: line.credit.amount,
    })),
    createdAt: "2026-09-23T10:05:00.000Z",
  });

  const result = await commitPurchasePostingReplaySafe({
    posting: nextPosting,
    journal: nextJournal,
    source: nextSource,
    purpose: "accounting-recognition",
    payloadFingerprint: FP_A,
    expectedPostingVersion: 1,
    occurredAt: "2026-09-23T10:10:00.000Z",
  }, store.unitOfWork);

  assert.equal(result.replayed, false);
  assert.equal(store.records.size, 2);
  assert.equal(store.journalWrites, 2);
});


test("stale expected Posting version conflicts before any write", async () => {
  const store = memoryUnitOfWork();

  await assert.rejects(
    () => commitPurchasePostingReplaySafe({
      ...input(),
      expectedPostingVersion: 2,
    }, store.unitOfWork),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.concurrencyConflict);
      return true;
    },
  );

  assert.equal(store.records.size, 0);
  assert.equal(store.journalWrites, 0);
});

test("exact replay succeeds even after caller expected version becomes stale", async () => {
  const store = memoryUnitOfWork();
  await commitPurchasePostingReplaySafe(input(), store.unitOfWork);

  const replayed = await commitPurchasePostingReplaySafe({
    ...input(),
    expectedPostingVersion: 999,
  }, store.unitOfWork);

  assert.equal(replayed.replayed, true);
  assert.equal(store.journalWrites, 1);
});
