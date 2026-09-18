import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Purchase replay safety migration is registered as version 32", async () => {
  const runner = await read("../src-tauri/src/lib.rs");
  assert.match(runner, /version:\s*32/u);
  assert.match(runner, /0032_purchase_replay_safety\.sql/u);
});

test("Purchase idempotency result is durable and append-only", async () => {
  const migration = await read("../src-tauri/migrations/0032_purchase_replay_safety.sql");
  assert.match(migration, /ADD COLUMN result_json TEXT/u);
  assert.match(migration, /tr_purchase_idempotency_result_required/u);
  assert.match(migration, /tr_purchase_idempotency_no_update/u);
  assert.match(migration, /tr_purchase_idempotency_no_delete/u);
});
