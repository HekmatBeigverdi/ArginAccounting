import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { DatabaseSession, DatabaseValue } from "@argin/database";
import { SqliteWarehouseIdempotencyExecutor } from "@argin/warehouse-tauri";

const migration = readFileSync(
  new URL("../src-tauri/migrations/0024_warehouse_idempotency.sql", import.meta.url),
  "utf8",
);
const runner = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");

for (const scope of [
  "warehouse:delete:company-1:w1",
  "warehouse:zone:delete:company-1:z1",
  "warehouse:location:delete:company-1:l1",
]) {
  test(`${scope} records and replays a void deletion with the real SQLite constraint`, async () => {
    const database = new DatabaseSync(":memory:");
    const bind = (parameters: readonly DatabaseValue[]) =>
      parameters.map((value) => typeof value === "boolean" ? Number(value) : value);
    const session: DatabaseSession = {
      async execute(sql, parameters = []) {
        const result = database.prepare(sql).run(...bind(parameters));
        return { rowsAffected: Number(result.changes) };
      },
      async query<T>(sql: string, parameters: readonly DatabaseValue[] = []) {
        return database.prepare(sql).all(...bind(parameters)) as T[];
      },
      async queryOne<T>(sql: string, parameters: readonly DatabaseValue[] = []) {
        return (database.prepare(sql).get(...bind(parameters)) ?? null) as T | null;
      },
    };
    try {
      database.exec(migration);
      database.exec("CREATE TABLE deletion_target (id TEXT PRIMARY KEY); INSERT INTO deletion_target VALUES ('target-1')");
      const executor = new SqliteWarehouseIdempotencyExecutor(session);
      let calls = 0;
      const remove = async () => {
        calls += 1;
        const result = database.prepare("DELETE FROM deletion_target WHERE id = ?").run("target-1");
        assert.equal(result.changes, 1);
      };
      assert.equal(await executor.run(scope, "request-delete", remove), undefined);
      assert.equal(await executor.run(scope, "request-delete", remove), undefined);
      assert.equal(calls, 1);
      const row = database.prepare("SELECT status, result_json, completed_at FROM warehouse_idempotency").get();
      assert.equal(row?.status, "completed");
      assert.equal(typeof row?.result_json, "string");
      assert.notEqual(row?.completed_at, null);
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM deletion_target").get()?.count, 0);
    } finally {
      database.close();
    }
  });
}

test("desktop runner registers warehouse idempotency migration 24", () => {
  assert.match(runner, /version:\s*24/u);
  assert.match(runner, /0024_warehouse_idempotency\.sql/u);
});

test("warehouse idempotency schema enforces request identity and state shape", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(migration);

  database.prepare(
    `INSERT INTO warehouse_idempotency
       (scope, request_id, status, result_json, created_at, completed_at)
     VALUES (?, ?, 'in-progress', NULL, ?, NULL)`,
  ).run("warehouse:create:company-1", "request-1", "2026-09-04T18:00:00.000Z");

  assert.throws(() => database.prepare(
    `INSERT INTO warehouse_idempotency
       (scope, request_id, status, result_json, created_at, completed_at)
     VALUES (?, ?, 'in-progress', NULL, ?, NULL)`,
  ).run("warehouse:create:company-1", "request-1", "2026-09-04T18:00:01.000Z"), /UNIQUE/u);

  assert.throws(() => database.prepare(
    `INSERT INTO warehouse_idempotency
       (scope, request_id, status, result_json, created_at, completed_at)
     VALUES (?, ?, 'completed', NULL, ?, NULL)`,
  ).run("warehouse:create:company-1", "request-2", "2026-09-04T18:00:02.000Z"), /CHECK/u);

  database.prepare(
    `UPDATE warehouse_idempotency
        SET status='completed', result_json='{}', completed_at=?
      WHERE scope=? AND request_id=?`,
  ).run("2026-09-04T18:00:03.000Z", "warehouse:create:company-1", "request-1");

  const row = database.prepare(
    "SELECT status, result_json FROM warehouse_idempotency WHERE scope=? AND request_id=?",
  ).get("warehouse:create:company-1", "request-1") as { status: string; result_json: string };
  assert.deepEqual({ ...row }, { status: "completed", result_json: "{}" });
});
