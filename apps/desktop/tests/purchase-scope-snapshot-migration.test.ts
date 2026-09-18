import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Purchase scope snapshot correction migration is registered as version 31", async () => {
  const runner = await read("../src-tauri/src/lib.rs");
  assert.match(runner, /version:\s*31/u);
  assert.match(runner, /0031_purchase_scope_snapshot\.sql/u);
});

test("Purchase scope snapshot migration persists historical Fiscal facts needed for rehydration", async () => {
  const migration = await read("../src-tauri/migrations/0031_purchase_scope_snapshot.sql");
  for (const column of [
    "fiscal_year_start_date",
    "fiscal_year_end_date",
    "fiscal_period_start_date",
    "fiscal_period_end_date",
    "fiscal_year_status",
    "fiscal_period_status",
    "locked_through_date",
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN ${column}\\b`, "u"));
  }
});
