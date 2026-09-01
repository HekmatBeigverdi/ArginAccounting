import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseExecuteResult, DatabaseSession, DatabaseValue } from "@argin/database";
import { ProductApplicationError } from "@argin/product";
import { SqliteProductIdempotencyExecutor, SqliteProductSelectorReader } from "../src/index.ts";

class RecordingSession implements DatabaseSession {
  readonly queries: Array<{ sql: string; params: readonly DatabaseValue[] }> = [];
  readonly executes: Array<{ sql: string; params: readonly DatabaseValue[] }> = [];
  queryOneQueue: unknown[] = [];
  queryQueue: unknown[][] = [];

  async execute(sql: string, params: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    this.executes.push({ sql, params });
    return { rowsAffected: 1 };
  }
  async query<T>(sql: string, params: readonly DatabaseValue[] = []): Promise<T[]> {
    this.queries.push({ sql, params });
    return (this.queryQueue.shift() ?? []) as T[];
  }
  async queryOne<T>(sql: string, params: readonly DatabaseValue[] = []): Promise<T | null> {
    this.queries.push({ sql, params });
    return (this.queryOneQueue.shift() ?? null) as T | null;
  }
}

test("idempotency failure removes in-progress claim so retry is possible", async () => {
  const db = new RecordingSession();
  db.queryOneQueue.push(null);
  const executor = new SqliteProductIdempotencyExecutor(db);
  const failure = new Error("write failed");

  await assert.rejects(() => executor.run("scope", "request-1", async () => { throw failure; }), failure);
  assert.equal(db.executes.length, 2);
  assert.match(db.executes[0]!.sql, /INSERT INTO product_idempotency/u);
  assert.match(db.executes[1]!.sql, /DELETE FROM product_idempotency/u);
});

test("in-progress idempotency claim maps to stable concurrency error", async () => {
  const db = new RecordingSession();
  db.queryOneQueue.push({ status: "in-progress", result_json: null });
  const executor = new SqliteProductIdempotencyExecutor(db);
  await assert.rejects(
    () => executor.run("scope", "request-1", async () => "never"),
    (error: unknown) => error instanceof ProductApplicationError
      && error.code === "product.application.concurrency-conflict",
  );
  assert.equal(db.executes.length, 0);
});

test("selector pushes Taxpayer requirement, tombstone exclusion and bounded limit into SQL", async () => {
  const db = new RecordingSession();
  db.queryQueue.push([]);
  const reader = new SqliteProductSelectorReader(db);
  await reader.select({
    companyId: "company-1",
    statuses: ["active"],
    requiresTaxpayerGoodsServiceId: true,
    limit: 25,
  });
  const query = db.queries[0]!;
  assert.match(query.sql, /p\.deleted_at IS NULL/u);
  assert.match(query.sql, /i\.taxpayer_goods_service_id IS NOT NULL/u);
  assert.match(query.sql, /LIMIT \?/u);
  assert.equal(query.params.at(-1), 25);
});

test("selector search is company scoped and searches display and strong identifiers", async () => {
  const db = new RecordingSession();
  db.queryQueue.push([]);
  const reader = new SqliteProductSelectorReader(db);
  await reader.select({ companyId: "company-1", search: "ABC", limit: 20 });
  const query = db.queries[0]!;
  assert.match(query.sql, /p\.company_id = \?/u);
  assert.match(query.sql, /p\.code LIKE \?/u);
  assert.match(query.sql, /p\.title LIKE \?/u);
  assert.match(query.sql, /i\.sku LIKE \?/u);
  assert.match(query.sql, /i\.taxpayer_goods_service_id LIKE \?/u);
  assert.equal(query.params[0], "company-1");
});
