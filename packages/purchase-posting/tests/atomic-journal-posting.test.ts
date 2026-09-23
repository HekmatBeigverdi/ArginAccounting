import assert from "node:assert/strict";
import test from "node:test";

import { createJournalVoucher } from "@argin/accounting/journal";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  commitPurchasePostingJournalDraftAtomically,
  createPurchasePosting,
} from "../src/index.ts";
import type {
  PurchasePostingAtomicSession,
  PurchasePostingAtomicUnitOfWork,
} from "../src/index.ts";

function posting() {
  return createPurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    createdAt: "2026-09-23T08:00:00.000Z",
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
      {
        id: "line-1",
        order: 1,
        accountId: "inventory",
        debit: 10_000,
        credit: 0,
      },
      {
        id: "line-2",
        order: 2,
        accountId: "payable",
        debit: 0,
        credit: 10_000,
      },
    ],
    createdAt: "2026-09-23T08:05:00.000Z",
  });
}

function transactionalUnitOfWork(input?: {
  failOnJournal?: boolean;
  failOnPosting?: boolean;
}) {
  const committed = {
    journals: [] as string[],
    postings: [] as string[],
  };

  const unitOfWork: PurchasePostingAtomicUnitOfWork = {
    async run<T>(work: (session: PurchasePostingAtomicSession) => Promise<T>): Promise<T> {
      const staged = {
        journals: [] as string[],
        postings: [] as string[],
      };

      const session: PurchasePostingAtomicSession = {
        async findPosting(id) {
          return id === "posting-001" ? posting() : null;
        },
        async createJournalDraft(voucher) {
          staged.journals.push(voucher.id);
          if (input?.failOnJournal) throw new Error("journal write failed");
        },
        async savePreparedPosting(value) {
          staged.postings.push(value.postingId);
          if (input?.failOnPosting) throw new Error("posting write failed");
        },
      };

      const result = await work(session);
      committed.journals.push(...staged.journals);
      committed.postings.push(...staged.postings);
      return result;
    },
  };

  return { unitOfWork, committed };
}

test("atomically creates Journal draft and prepares Purchase Posting", async () => {
  const state = transactionalUnitOfWork();

  const result = await commitPurchasePostingJournalDraftAtomically({
    posting: posting(),
    journal: journal(),
    expectedPostingVersion: 1,
    occurredAt: "2026-09-23T08:10:00.000Z",
  }, state.unitOfWork);

  assert.equal(result.posting.status, "prepared");
  assert.equal(result.posting.journalVoucherId, "voucher-001");
  assert.equal(result.posting.version, 2);
  assert.equal(result.journal.status, "draft");
  assert.deepEqual(state.committed.journals, ["voucher-001"]);
  assert.deepEqual(state.committed.postings, ["posting-001"]);
});

test("rolls back staged Journal when prepared Posting write fails", async () => {
  const state = transactionalUnitOfWork({ failOnPosting: true });

  await assert.rejects(() => commitPurchasePostingJournalDraftAtomically({
    posting: posting(),
    journal: journal(),
    expectedPostingVersion: 1,
    occurredAt: "2026-09-23T08:10:00.000Z",
  }, state.unitOfWork));

  assert.deepEqual(state.committed.journals, []);
  assert.deepEqual(state.committed.postings, []);
});

test("does not persist Posting when Journal write fails", async () => {
  const state = transactionalUnitOfWork({ failOnJournal: true });

  await assert.rejects(() => commitPurchasePostingJournalDraftAtomically({
    posting: posting(),
    journal: journal(),
    expectedPostingVersion: 1,
    occurredAt: "2026-09-23T08:10:00.000Z",
  }, state.unitOfWork));

  assert.deepEqual(state.committed.journals, []);
  assert.deepEqual(state.committed.postings, []);
});

test("rejects cross-scope Journal before transaction starts", async () => {
  const state = transactionalUnitOfWork();
  const crossScope = createJournalVoucher({
    ...journal(),
    id: "voucher-other",
    companyId: "company-002",
    lines: journal().lines.map((line) => ({
      id: line.id,
      order: line.order,
      accountId: line.accountId,
      debit: line.debit.amount,
      credit: line.credit.amount,
    })),
    createdAt: "2026-09-23T08:05:00.000Z",
  });

  await assert.rejects(
    () => commitPurchasePostingJournalDraftAtomically({
      posting: posting(),
      journal: crossScope,
      expectedPostingVersion: 1,
      occurredAt: "2026-09-23T08:10:00.000Z",
    }, state.unitOfWork),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(
        error.code,
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.atomicPostingScopeMismatch,
      );
      return true;
    },
  );

  assert.deepEqual(state.committed.journals, []);
  assert.deepEqual(state.committed.postings, []);
});

test("rejects optimistic version mismatch before persistence", async () => {
  const state = transactionalUnitOfWork();

  await assert.rejects(
    () => commitPurchasePostingJournalDraftAtomically({
      posting: posting(),
      journal: journal(),
      expectedPostingVersion: 2,
      occurredAt: "2026-09-23T08:10:00.000Z",
    }, state.unitOfWork),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid);
      return true;
    },
  );
});
