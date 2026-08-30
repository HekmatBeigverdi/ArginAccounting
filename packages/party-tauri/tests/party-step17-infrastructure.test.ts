import assert from "node:assert/strict";
import test from "node:test";

import type {
  DatabaseExecuteResult,
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue
} from "@argin/database";
import type { PartyDuplicateProbe } from "@argin/party";

import {
  SqlitePartyDuplicateLookup,
  SqlitePartyMasterExportReader,
  SqlitePartyReader,
  SqlitePartyUnitOfWork
} from "../src/index.ts";

class RecordingDatabase implements DatabaseExecutor {
  readonly executions: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];
  readonly queries: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];
  transactionCount = 0;
  rollbackCount = 0;
  totalCount = 0;

  async execute(sql: string, parameters: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    this.executions.push({ sql, parameters });
    return { rowsAffected: 1 };
  }

  async query<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T[]> {
    this.queries.push({ sql, parameters });
    return [];
  }

  async queryOne<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    this.queries.push({ sql, parameters });
    if (sql.includes("COUNT(*)")) return { count: this.totalCount } as T;
    return null;
  }

  async transaction<T>(operation: (transaction: DatabaseSession) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    try {
      return await operation(this);
    } catch (error) {
      this.rollbackCount += 1;
      throw error;
    }
  }

  async close(): Promise<void> {}
}

const duplicateProbe: PartyDuplicateProbe = {
  companyId: "company-1",
  excludePartyId: "party-current",
  code: "P-100",
  classification: "natural-person",
  displayName: "علی رضایی",
  nationalCode: "0084575948",
  nationalId: null,
  economicNumber: null
};

test("Party unit of work surfaces failures through one transaction boundary", async () => {
  const database = new RecordingDatabase();
  const unitOfWork = new SqlitePartyUnitOfWork(database);

  await assert.rejects(
    unitOfWork.run(async () => {
      throw new Error("write failed");
    }),
    /write failed/
  );

  assert.equal(database.transactionCount, 1);
  assert.equal(database.rollbackCount, 1);
});

test("hard duplicate lookup stays company-scoped and excludes the current Party", async () => {
  const database = new RecordingDatabase();
  const lookup = new SqlitePartyDuplicateLookup(database);

  await lookup.findHardCandidates(duplicateProbe);

  const query = database.queries.at(-1);
  assert.ok(query);
  assert.match(query.sql, /p\.company_id = \?/);
  assert.match(query.sql, /p\.code = \?/);
  assert.match(query.sql, /p\.national_code = \?/);
  assert.match(query.sql, /p\.id <> \?/);
  assert.deepEqual(query.parameters, [
    "company-1",
    "P-100",
    "0084575948",
    "party-current"
  ]);
});

test("advisory duplicate lookup is bounded and classification-scoped", async () => {
  const database = new RecordingDatabase();
  const lookup = new SqlitePartyDuplicateLookup(database);

  await lookup.findAdvisoryCandidates(duplicateProbe);

  const query = database.queries.at(-1);
  assert.ok(query);
  assert.match(query.sql, /p\.classification = \?/);
  assert.match(query.sql, /lower\(trim\(p\.display_name\)\)/);
  assert.match(query.sql, /LIMIT 25/);
  assert.deepEqual(query.parameters, [
    "company-1",
    "natural-person",
    "علی رضایی",
    "party-current"
  ]);
});

test("selector applies company, role, status, search and hard result bounds in SQL", async () => {
  const database = new RecordingDatabase();
  const reader = new SqlitePartyReader(database);

  await reader.select({
    companyId: "company-1",
    search: "P-1%",
    roles: ["customer"],
    statuses: ["active"],
    limit: 20
  });

  const query = database.queries.at(-1);
  assert.ok(query);
  assert.match(query.sql, /p\.company_id = \?/);
  assert.match(query.sql, /p\.status IN \(\?\)/);
  assert.match(query.sql, /EXISTS \(SELECT 1 FROM party_roles/);
  assert.match(query.sql, /LIMIT \?/);
  assert.equal(query.parameters.at(-1), 20);
  assert.ok(query.parameters.includes("%P-1\\%%"));
});

test("master export reader is tombstone-aware and pages instead of loading all Parties", async () => {
  const database = new RecordingDatabase();
  database.totalCount = 4500;
  const reader = new SqlitePartyMasterExportReader(database);

  const result = await reader.listPage("company-1", 3, 1000);

  assert.equal(result.page, 3);
  assert.equal(result.pageSize, 1000);
  assert.equal(result.totalItems, 4500);
  assert.equal(result.totalPages, 5);

  const countQuery = database.queries.find((entry) => entry.sql.includes("COUNT(*)"));
  const pageQuery = database.queries.find((entry) => entry.sql.includes("LIMIT ? OFFSET ?"));
  assert.ok(countQuery?.sql.includes("deleted_at IS NULL"));
  assert.ok(pageQuery?.sql.includes("deleted_at IS NULL"));
  assert.deepEqual(pageQuery?.parameters, ["company-1", 1000, 2000]);
});

test("master export rejects unsafe page sizes", async () => {
  const reader = new SqlitePartyMasterExportReader(new RecordingDatabase());
  await assert.rejects(
    reader.listPage("company-1", 1, 2001),
    RangeError
  );
});
