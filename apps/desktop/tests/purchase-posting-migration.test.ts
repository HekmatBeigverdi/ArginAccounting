import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Purchase Posting migration is registered as version 33", async () => {
  const runner = await read("../src-tauri/src/lib.rs");
  assert.match(runner, /version:\s*33/u);
  assert.match(runner, /0033_purchase_posting\.sql/u);
});

test("Purchase Posting migration defines aggregate, rules, idempotency and reversal persistence", async () => {
  const migration = await read("../src-tauri/migrations/0033_purchase_posting.sql");
  for (const table of [
    "purchase_postings",
    "purchase_posting_rules",
    "purchase_posting_idempotency",
    "purchase_posting_reversals",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}\\b`, "u"));
  }
});

test("Purchase Posting schema freezes replay and reversal evidence as append-only", async () => {
  const migration = await read("../src-tauri/migrations/0033_purchase_posting.sql");
  for (const trigger of [
    "tr_purchase_posting_idempotency_no_update",
    "tr_purchase_posting_idempotency_no_delete",
    "tr_purchase_posting_reversals_no_update",
    "tr_purchase_posting_reversals_no_delete",
  ]) {
    assert.match(migration, new RegExp(trigger, "u"));
  }
});

test("Purchase Posting schema contains CAS, source-replay and Bridge indexes", async () => {
  const migration = await read("../src-tauri/migrations/0033_purchase_posting.sql");
  assert.match(migration, /version INTEGER NOT NULL DEFAULT 1/u);
  assert.match(migration, /uq_purchase_postings_journal/u);
  assert.match(migration, /uq_purchase_posting_idempotency_source/u);
  assert.match(migration, /ix_purchase_posting_idempotency_source_lookup/u);
  assert.match(migration, /ix_purchase_postings_sync_changes/u);
  assert.match(migration, /ix_purchase_posting_rules_sync_changes/u);
  assert.match(migration, /payload_fingerprint NOT GLOB '\*\[\^0-9a-f\]\*'/u);
});

test("migration executes against a real SQLite prerequisite boundary", async () => {
  const migration = await read("../src-tauri/migrations/0033_purchase_posting.sql");
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE companies (id TEXT PRIMARY KEY);
    CREATE TABLE branches (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      UNIQUE(company_id, id)
    );
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      UNIQUE(company_id, id)
    );
    CREATE TABLE journal_vouchers (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      UNIQUE(company_id, id)
    );
  `);
  db.exec(migration);

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'purchase_posting%' ORDER BY name"
  ).all().map(row => String(row.name));

  assert.deepEqual(tables, [
    "purchase_posting_idempotency",
    "purchase_posting_reversals",
    "purchase_posting_rules",
    "purchase_postings",
  ]);

  db.close();
});
