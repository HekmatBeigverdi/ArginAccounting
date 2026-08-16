import assert from "node:assert/strict";
import test from "node:test";

import { JournalVoucherApplicationError } from "@argin/accounting/journal";
import type {
  DatabaseExecuteResult,
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import { InMemoryEventBus, SystemClock, UuidGenerator } from "@argin/platform";

import { createJournalVoucherServices } from "../src/composition/accounting/create-journal-voucher-services.ts";

class FakeDatabase implements DatabaseExecutor {
  readonly queries: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];

  async execute(): Promise<DatabaseExecuteResult> {
    return { rowsAffected: 1 };
  }

  async query<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<T[]> {
    this.queries.push({ sql, parameters });
    return [];
  }

  async queryOne<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<T | null> {
    this.queries.push({ sql, parameters });
    return null;
  }

  async transaction<T>(
    operation: (transaction: DatabaseSession) => Promise<T>,
  ): Promise<T> {
    return operation(this);
  }

  async close(): Promise<void> {}
}

function services(database: FakeDatabase, authorized: boolean) {
  return createJournalVoucherServices({
    database,
    clock: new SystemClock(),
    idGenerator: new UuidGenerator(),
    eventBus: new InMemoryEventBus(),
    authorizer: { hasPermission: async () => authorized },
  });
}

test("desktop journal read composition cannot bypass application authorization", async () => {
  const database = new FakeDatabase();
  const journal = services(database, false);

  await assert.rejects(
    () => journal.search({ companyId: "company-1" }),
    (error: unknown) =>
      error instanceof JournalVoucherApplicationError &&
      error.code === "journal.unauthorized",
  );
  assert.equal(database.queries.length, 0);
});

test("desktop journal account lookup requests only active postable subsidiaries", async () => {
  const database = new FakeDatabase();
  const journal = services(database, true);

  await journal.listPostingAccounts("company-1");

  assert.equal(database.queries.length, 1);
  assert.match(database.queries[0]!.sql, /level = 'subsidiary'/u);
  assert.match(database.queries[0]!.sql, /status = 'active'/u);
  assert.match(database.queries[0]!.sql, /posting_allowed = 1/u);
  assert.deepEqual(database.queries[0]!.parameters, ["company-1"]);
});

test("desktop journal branch lookup excludes inactive branches", async () => {
  const database = new FakeDatabase();
  const journal = services(database, true);

  await journal.listBranches("company-1");

  assert.match(database.queries[0]!.sql, /status = 'active'/u);
  assert.deepEqual(database.queries[0]!.parameters, ["company-1"]);
});
