import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseExecuteResult, DatabaseSession, DatabaseValue } from "@argin/database";
import { SqliteWarehouseIdempotencyExecutor } from "../src/index.ts";

type Row = { status: "in-progress" | "completed"; result_json: string | null };

class FakeSession implements DatabaseSession {
  row: Row | null = null;
  readonly statements: string[] = [];

  async execute(sql: string, parameters: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    this.statements.push(sql);
    if (sql.includes("INSERT INTO warehouse_idempotency")) {
      if (this.row) throw new Error("UNIQUE constraint failed");
      this.row = { status: "in-progress", result_json: null };
    } else if (sql.includes("UPDATE warehouse_idempotency")) {
      assert.equal(typeof parameters[0], "string", "completed results must contain JSON text");
      JSON.parse(String(parameters[0]));
      this.row = { status: "completed", result_json: String(parameters[0]) };
    } else if (sql.includes("DELETE FROM warehouse_idempotency")) {
      this.row = null;
    }
    return { rowsAffected: 1 };
  }

  async query<T>(_sql: string, _parameters: readonly DatabaseValue[] = []): Promise<T[]> { return []; }
  async queryOne<T>(_sql: string, _parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    return this.row as T | null;
  }
}

test("completed request replays stored result without executing operation", async () => {
  const session = new FakeSession();
  session.row = { status: "completed", result_json: JSON.stringify({ ok: true }) };
  const executor = new SqliteWarehouseIdempotencyExecutor(session);
  let called = false;
  const result = await executor.run("warehouse:create:company-1", "req-1", async () => {
    called = true;
    return { ok: false };
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(called, false);
});

test("in-progress duplicate request maps to concurrency conflict", async () => {
  const session = new FakeSession();
  session.row = { status: "in-progress", result_json: null };
  const executor = new SqliteWarehouseIdempotencyExecutor(session);
  await assert.rejects(
    () => executor.run("warehouse:update:company-1:w1", "req-2", async () => 1),
    /warehouse\.application\.concurrency-conflict/u,
  );
});

test("successful operation is persisted as completed and replayable", async () => {
  const session = new FakeSession();
  const executor = new SqliteWarehouseIdempotencyExecutor(session);
  const result = await executor.run("warehouse:create:company-1", "req-3", async () => ({ warehouseId: "w1" }));
  assert.deepEqual(result, { warehouseId: "w1" });
  assert.equal(session.row?.status, "completed");
  const replayed = await executor.run("warehouse:create:company-1", "req-3", async () => {
    assert.fail("completed operation must not run again");
  });
  assert.deepEqual(replayed, result);
});

for (const result of [undefined, null, false, 0, "", { warehouseId: "w1" }]) {
  test(`preserves ${JSON.stringify(result)} on initial execution and replay`, async () => {
    const session = new FakeSession();
    const executor = new SqliteWarehouseIdempotencyExecutor(session);
    let calls = 0;
    const operation = async () => { calls += 1; return result; };
    assert.deepEqual(await executor.run("warehouse:test", "req-result", operation), result);
    assert.deepEqual(await executor.run("warehouse:test", "req-result", operation), result);
    assert.equal(calls, 1);
  });
}

test("replays a void result when another executor completes during the claim race", async () => {
  const session = new FakeSession();
  const executor = new SqliteWarehouseIdempotencyExecutor(session);
  await executor.run("warehouse:zone:delete:company-1:z1", "req-race", async () => {});
  const completed = session.row;
  let reads = 0;
  session.queryOne = async <T>() => {
    reads += 1;
    return reads === 1 ? null : completed as T | null;
  };
  const result = await executor.run("warehouse:zone:delete:company-1:z1", "req-race", async () => {
    assert.fail("the completed delete must not run again");
  });
  assert.equal(result, undefined);
});

test("failed operation removes in-progress claim so retry can proceed", async () => {
  const session = new FakeSession();
  const executor = new SqliteWarehouseIdempotencyExecutor(session);
  await assert.rejects(
    () => executor.run("warehouse:create:company-1", "req-4", async () => { throw new Error("write failed"); }),
    /write failed/u,
  );
  assert.equal(session.row, null);
  assert.equal(session.statements.some((sql) => sql.includes("DELETE FROM warehouse_idempotency")), true);
});
