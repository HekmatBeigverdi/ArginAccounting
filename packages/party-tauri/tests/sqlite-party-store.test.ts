import assert from "node:assert/strict";
import test from "node:test";

import type {
  DatabaseExecuteResult,
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue
} from "@argin/database";
import {
  PartyApplicationError,
  createParty
} from "@argin/party";

import {
  SqlitePartyReader,
  SqlitePartyRepository,
  SqlitePartyUnitOfWork
} from "../src/index.ts";

class RecordingDatabase implements DatabaseExecutor {
  readonly executions: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];
  readonly queries: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];
  transactionCount = 0;
  updateRowsAffected = 1;
  existingVersion: number | null = 1;

  async execute(sql: string, parameters: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    this.executions.push({ sql, parameters });
    if (sql.includes("UPDATE parties SET")) return { rowsAffected: this.updateRowsAffected };
    return { rowsAffected: 1 };
  }

  async query<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T[]> {
    this.queries.push({ sql, parameters });
    return [];
  }

  async queryOne<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    this.queries.push({ sql, parameters });
    if (sql.includes("COUNT(*)")) return { count: 0 } as T;
    if (sql.includes("SELECT version FROM parties") && this.existingVersion !== null) {
      return { version: this.existingVersion } as T;
    }
    return null;
  }

  async transaction<T>(operation: (transaction: DatabaseSession) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return operation(this);
  }

  async close(): Promise<void> {}
}

function sampleParty() {
  return createParty({
    classification: "natural-person",
    id: "party-1",
    companyId: "company-1",
    code: "P-001",
    firstName: "Ali",
    lastName: "Ahmadi",
    roles: ["customer", "supplier"],
    contacts: [{ id: "contact-1", type: "mobile", value: "09121234567", isPrimary: true }],
    addresses: [{ id: "address-1", purpose: "billing", addressLine: "Tehran", isPrimary: true }],
    createdAt: "2026-08-29T10:00:00.000Z"
  });
}

test("unit of work keeps parent and child writes in one database transaction", async () => {
  const database = new RecordingDatabase();
  const unitOfWork = new SqlitePartyUnitOfWork(database);
  await unitOfWork.run(async ({ parties }) => parties.add(sampleParty()));

  assert.equal(database.transactionCount, 1);
  assert.equal(database.executions.filter((entry) => entry.sql.includes("INSERT INTO parties")).length, 1);
  assert.equal(database.executions.filter((entry) => entry.sql.includes("INSERT INTO party_roles")).length, 2);
  assert.equal(database.executions.filter((entry) => entry.sql.includes("INSERT INTO party_contacts")).length, 1);
  assert.equal(database.executions.filter((entry) => entry.sql.includes("INSERT INTO party_addresses")).length, 1);
});

test("repository maps stale expectedVersion to stable concurrency error before child replacement", async () => {
  const database = new RecordingDatabase();
  database.updateRowsAffected = 0;
  database.existingVersion = 4;
  const repository = new SqlitePartyRepository(database);

  await assert.rejects(
    repository.update(sampleParty(), 3),
    (error: unknown) => error instanceof PartyApplicationError && error.code === "party.concurrentModification"
  );
  assert.equal(database.executions.some((entry) => entry.sql.includes("DELETE FROM party_roles")), false);
  const update = database.executions.find((entry) => entry.sql.includes("UPDATE parties SET"));
  assert.ok(update?.sql.includes("AND version = ?"));
  assert.equal(update?.parameters.at(-1), 3);
});

test("repository distinguishes missing party from a stale version", async () => {
  const database = new RecordingDatabase();
  database.updateRowsAffected = 0;
  database.existingVersion = null;
  const repository = new SqlitePartyRepository(database);

  await assert.rejects(
    repository.update(sampleParty(), 1),
    (error: unknown) => error instanceof PartyApplicationError && error.code === "party.notFound"
  );
});

test("reader uses bounded SQL paging instead of loading all parties", async () => {
  const database = new RecordingDatabase();
  const reader = new SqlitePartyReader(database);
  const result = await reader.list({
    filter: { companyId: "company-1", statuses: ["active"], roles: ["customer"] },
    page: { page: 2, pageSize: 25 },
    sort: { field: "displayName", direction: "asc" }
  });

  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 25);
  const listQuery = database.queries.find((entry) => entry.sql.includes("LIMIT ? OFFSET ?"));
  assert.ok(listQuery);
  assert.equal(listQuery?.parameters.at(-2), 25);
  assert.equal(listQuery?.parameters.at(-1), 25);
  assert.ok(listQuery?.sql.includes("EXISTS (SELECT 1 FROM party_roles"));
});

test("selector rejects unbounded limits", async () => {
  const reader = new SqlitePartyReader(new RecordingDatabase());
  await assert.rejects(
    reader.select({ companyId: "company-1", limit: 101 }),
    (error: unknown) => error instanceof PartyApplicationError && error.code === "party.invalidQuery"
  );
});
