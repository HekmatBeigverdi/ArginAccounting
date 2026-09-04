import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migration = readFileSync(
  new URL("../src-tauri/migrations/0024_warehouse_idempotency.sql", import.meta.url),
  "utf8",
);
const runner = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");

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
