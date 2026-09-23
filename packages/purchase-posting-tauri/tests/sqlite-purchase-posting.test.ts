import assert from "node:assert/strict";
import test from "node:test";

import type {
  DatabaseExecuteResult,
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import {
  createPurchasePosting,
  preparePurchasePosting,
  type PurchasePostingReversalRecord,
} from "@argin/purchase-posting";
import {
  SqlitePurchasePostingRepository,
  SqlitePurchasePostingReplayUnitOfWork,
  SqlitePurchasePostingReversalRepository,
  SqlitePurchasePostingReversalUnitOfWork,
  SqlitePurchasePostingUnitOfWork,
} from "../src/index.ts";

class StubSession implements DatabaseSession {
  readonly calls: Array<{
    kind: "execute" | "query" | "queryOne";
    sql: string;
    parameters: readonly DatabaseValue[];
  }> = [];
  executeResult: DatabaseExecuteResult = { rowsAffected: 1 };
  queryOneResult: unknown = null;

  async execute(sql: string, parameters: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    this.calls.push({ kind: "execute", sql, parameters });
    return this.executeResult;
  }

  async query<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T[]> {
    this.calls.push({ kind: "query", sql, parameters });
    return [];
  }

  async queryOne<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    this.calls.push({ kind: "queryOne", sql, parameters });
    return this.queryOneResult as T | null;
  }
}

class StubExecutor extends StubSession implements DatabaseExecutor {
  transactionCount = 0;
  transactionSession = new StubSession();

  async transaction<T>(operation: (transaction: DatabaseSession) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return operation(this.transactionSession);
  }

  async close(): Promise<void> {}
}

function draftPosting() {
  return createPurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    createdAt: "2026-09-23T12:00:00.000Z",
  });
}

test("Purchase Posting repository rehydrates durable aggregate", async () => {
  const db = new StubSession();
  db.queryOneResult = {
    posting_id: "posting-001",
    company_id: "company-001",
    branch_id: "branch-001",
    status: "draft",
    journal_voucher_id: null,
    version: 1,
    created_at: "2026-09-23T12:00:00.000Z",
    updated_at: "2026-09-23T12:00:00.000Z",
  };

  const found = await new SqlitePurchasePostingRepository(db).findById("posting-001");
  assert.equal(found?.postingId, "posting-001");
  assert.equal(found?.status, "draft");
  assert.equal(found?.version, 1);
});

test("Purchase Posting repository uses compare-and-swap expected version", async () => {
  const db = new StubSession();
  const prepared = preparePurchasePosting(draftPosting(), {
    journalVoucherId: "journal-001",
    expectedVersion: 1,
    occurredAt: "2026-09-23T12:05:00.000Z",
  });

  await new SqlitePurchasePostingRepository(db).update(prepared, 1);

  const write = db.calls.at(-1);
  assert.equal(write?.kind, "execute");
  assert.match(write?.sql ?? "", /WHERE posting_id=\? AND company_id=\? AND version=\?/u);
  assert.equal(write?.parameters.at(-1), 1);
});

test("Purchase Posting repository rejects stale compare-and-swap", async () => {
  const db = new StubSession();
  db.executeResult = { rowsAffected: 0 };
  const prepared = preparePurchasePosting(draftPosting(), {
    journalVoucherId: "journal-001",
    expectedVersion: 1,
    occurredAt: "2026-09-23T12:05:00.000Z",
  });

  await assert.rejects(
    () => new SqlitePurchasePostingRepository(db).update(prepared, 1),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && error.code === "purchase_posting.concurrency_conflict",
  );
});

test("generic Unit of Work binds all repositories/readers to one transaction session", async () => {
  const database = new StubExecutor();
  const uow = new SqlitePurchasePostingUnitOfWork(database);

  await uow.execute(async context => {
    await context.postings.findById("posting-001");
    await context.rules.listActive("company-001");
    await context.fiscal.resolve("company-001", "2026-09-23");
    assert.equal(uow.sessionFor(context), database.transactionSession);
  });

  assert.equal(database.transactionCount, 1);
  assert.equal(database.calls.length, 0);
  assert.equal(database.transactionSession.calls.length, 3);
});

test("replay Unit of Work exposes idempotency and Posting reads on same transaction", async () => {
  const database = new StubExecutor();
  const uow = new SqlitePurchasePostingReplayUnitOfWork(database);

  await uow.run(async session => {
    await session.findIdempotencyRecord("key-001");
    await session.findPosting("posting-001");
    return undefined;
  });

  assert.equal(database.transactionCount, 1);
  assert.equal(database.transactionSession.calls.length, 2);
  assert.match(database.transactionSession.calls[0]?.sql ?? "", /purchase_posting_idempotency/u);
  assert.match(database.transactionSession.calls[1]?.sql ?? "", /purchase_postings/u);
});

test("reversal lineage repository persists immutable durable IDs", async () => {
  const db = new StubSession();
  const reversal: PurchasePostingReversalRecord = {
    postingId: "posting-001",
    originalJournalVoucherId: "journal-original",
    reversalJournalVoucherId: "journal-reversal",
    requestId: "request-001",
    reversedBy: "user-001",
    reversedAt: "2026-09-23T13:00:00.000Z",
    reason: "correction",
    committedPostingVersion: 5,
  };

  await new SqlitePurchasePostingReversalRepository(db).add("company-001", reversal);
  assert.match(db.calls.at(-1)?.sql ?? "", /INSERT INTO purchase_posting_reversals/u);
  assert.deepEqual(
    db.calls.at(-1)?.parameters.slice(0, 4),
    ["posting-001", "company-001", "journal-original", "journal-reversal"],
  );
});

test("reversal Unit of Work passes the exact transaction session to Accounting reverser", async () => {
  const database = new StubExecutor();
  let seenSession: DatabaseSession | null = null;

  const uow = new SqlitePurchasePostingReversalUnitOfWork(
    database,
    async (session) => {
      seenSession = session;
      throw new Error("stop-after-session-check");
    },
  );

  await assert.rejects(
    () => uow.run(session => session.reverseJournal({
      originalVoucherId: "journal-original",
      companyId: "company-001",
      expectedVersion: 4,
      actorId: "user-001",
      occurredAt: "2026-09-23T13:00:00.000Z",
      reversalDate: "2026-09-23",
      requestId: "request-001",
      reason: "correction",
    })),
    /stop-after-session-check/u,
  );

  assert.equal(seenSession, database.transactionSession);
  assert.equal(database.transactionCount, 1);
});
