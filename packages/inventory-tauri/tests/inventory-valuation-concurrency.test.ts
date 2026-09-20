import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { DatabaseExecuteResult, DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import { InventoryValuationConcurrencyError } from "@argin/inventory/valuation-concurrency";
import {
  SqliteInventoryValuationIdempotencyRepository,
  SqliteInventoryValuationStreamVersionRepository,
  SqliteInventoryValuationUnitOfWork,
} from "../src/index.ts";

class StubSession implements DatabaseSession {
  readonly calls: Array<{ kind: "execute" | "query" | "queryOne"; sql: string; parameters: readonly DatabaseValue[] }> = [];
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

test("migration 0029 defines durable idempotency and stream revisions", async () => {
  const url = new URL("../../../apps/desktop/src-tauri/migrations/0029_inventory_valuation_concurrency.sql", import.meta.url);
  const sql = await readFile(url, "utf8");
  assert.match(sql, /CREATE TABLE inventory_valuation_idempotency/u);
  assert.match(sql, /PRIMARY KEY \(company_id, request_id\)/u);
  assert.match(sql, /payload_fingerprint/u);
  assert.match(sql, /CREATE TABLE inventory_valuation_stream_versions/u);
  assert.match(sql, /PRIMARY KEY \(company_id, stream_key\)/u);
  assert.match(sql, /revision INTEGER NOT NULL CHECK \(revision > 0\)/u);
});

test("idempotency repository reads and writes durable outcomes", async () => {
  const db = new StubSession();
  db.queryOneResult = {
    company_id: "c1", request_id: "r1", operation: "resolve", payload_fingerprint: "fp",
    outcome_kind: "valuation", outcome_id: "v1", outcome_revision: 2, recorded_at: "2026-09-12T19:00:00.000Z",
  };
  const repository = new SqliteInventoryValuationIdempotencyRepository(db);
  const found = await repository.find("c1", "r1");
  assert.equal(found?.outcomeId, "v1");
  await repository.add(found!);
  assert.match(db.calls.at(-1)?.sql ?? "", /INSERT INTO inventory_valuation_idempotency/u);
});

test("stream revision compare-and-swap rejects stale writer", async () => {
  const db = new StubSession();
  db.executeResult = { rowsAffected: 0 };
  const repository = new SqliteInventoryValuationStreamVersionRepository(db);
  await assert.rejects(
    () => repository.advance("c1", "valuation:c1:p1", 4),
    (error: unknown) => error instanceof InventoryValuationConcurrencyError && error.code === "VALUATION_CONCURRENCY_CONFLICT",
  );
  assert.match(db.calls[0]?.sql ?? "", /WHERE company_id=\? AND stream_key=\? AND revision=\?/u);
});

test("stream revision compare-and-swap advances exactly one successful writer", async () => {
  const db = new StubSession();
  const next = await new SqliteInventoryValuationStreamVersionRepository(db).advance("c1", "valuation:c1:p1", 4);
  assert.deepEqual(next, { companyId: "c1", streamKey: "valuation:c1:p1", revision: 5 });
});

test("valuation unit of work exposes all repositories on one transaction session", async () => {
  const database = new StubExecutor();
  const uow = new SqliteInventoryValuationUnitOfWork(database);
  await uow.execute(async (context) => {
    await context.idempotency.find("c1", "r1");
    await context.policies.findCurrent("c1");
    await context.streamVersions.get("c1", "policy:c1");
  });
  assert.equal(database.transactionCount, 1);
  assert.equal(database.calls.length, 0);
  assert.equal(database.transactionSession.calls.length, 3);
});
