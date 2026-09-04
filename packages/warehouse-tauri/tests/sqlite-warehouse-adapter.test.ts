import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseExecuteResult, DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import {
  classifyWarehouse,
  createWarehouse,
  assignWarehouseOrganizationalScope,
  type WarehousePersistenceState,
} from "@argin/warehouse";

import { SqliteWarehouseRepository, SqliteWarehouseUnitOfWork } from "../src/index.ts";

class RecordingDatabase implements DatabaseExecutor {
  readonly executed: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];
  transactions = 0;
  rollbackSignals = 0;
  rowsAffected = 1;
  existingOnConflict = true;

  async execute(sql: string, parameters: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    this.executed.push({ sql, parameters });
    return { rowsAffected: this.rowsAffected };
  }
  async query<T>(_sql: string, _parameters: readonly DatabaseValue[] = []): Promise<T[]> { return []; }
  async queryOne<T>(sql: string, _parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    if (sql.includes("SELECT id FROM warehouses") && this.existingOnConflict) return { id: "warehouse-1" } as T;
    return null;
  }
  async transaction<T>(operation: (transaction: DatabaseSession) => Promise<T>): Promise<T> {
    this.transactions += 1;
    try { return await operation(this); }
    catch (error) { this.rollbackSignals += 1; throw error; }
  }
  async close(): Promise<void> {}
}

const state = (version = 1): WarehousePersistenceState => {
  const base = createWarehouse({
    warehouseId: "warehouse-1",
    companyId: "company-1",
    code: "WH-01",
    title: "Main",
    createdAt: "2026-09-04T10:00:00.000Z",
  });
  const classified = classifyWarehouse({ warehouse: base, kind: "general" });
  return Object.freeze({
    warehouse: assignWarehouseOrganizationalScope({ warehouse: classified, scope: { mode: "company" } }),
    externalIdentifiers: Object.freeze([]),
    version,
  });
};

test("unit of work exposes all warehouse repositories inside one database transaction", async () => {
  const database = new RecordingDatabase();
  const uow = new SqliteWarehouseUnitOfWork(database);
  const result = await uow.execute(async ({ warehouses, zones, locations }) => {
    assert.ok(warehouses);
    assert.ok(zones);
    assert.ok(locations);
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(database.transactions, 1);
});

test("unit of work propagates failure so database transaction can roll back atomically", async () => {
  const database = new RecordingDatabase();
  const uow = new SqliteWarehouseUnitOfWork(database);
  await assert.rejects(
    () => uow.execute(async () => { throw new Error("boom"); }),
    /boom/u,
  );
  assert.equal(database.transactions, 1);
  assert.equal(database.rollbackSignals, 1);
});

test("warehouse optimistic update includes expectedVersion in the SQL predicate", async () => {
  const database = new RecordingDatabase();
  const repository = new SqliteWarehouseRepository(database);
  await repository.update(state(2), 1);
  const update = database.executed.find((entry) => entry.sql.startsWith("UPDATE warehouses"));
  assert.ok(update);
  assert.match(update.sql, /WHERE company_id=\? AND id=\? AND version=\?/u);
  assert.equal(update.parameters.at(-1), 1);
});

test("stale optimistic update maps zero affected rows to concurrency conflict", async () => {
  const database = new RecordingDatabase();
  database.rowsAffected = 0;
  const repository = new SqliteWarehouseRepository(database);
  await assert.rejects(
    () => repository.update(state(2), 1),
    (error: unknown) => error instanceof Error && error.message.includes("concurrency-conflict"),
  );
});

test("missing optimistic update maps zero affected rows to not-found", async () => {
  const database = new RecordingDatabase();
  database.rowsAffected = 0;
  database.existingOnConflict = false;
  const repository = new SqliteWarehouseRepository(database);
  await assert.rejects(
    () => repository.update(state(2), 1),
    (error: unknown) => error instanceof Error && error.message.includes("not-found"),
  );
});
