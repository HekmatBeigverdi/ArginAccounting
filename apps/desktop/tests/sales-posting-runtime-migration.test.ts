import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Sales Posting runtime migration is registered as version 37", async () => {
  const runner = await read("../src-tauri/src/lib.rs");
  assert.match(runner, /version:\s*37/u);
  assert.match(runner, /0037_sales_posting\.sql/u);
});

test("Sales Posting migration defines durable posting, rules, replay, provenance and outbox", async () => {
  const migration = await read("../src-tauri/migrations/0037_sales_posting.sql");
  for (const table of [
    "sales_postings",
    "sales_posting_rules",
    "sales_posting_idempotency",
    "sales_posting_journal_provenance",
    "sales_posting_outbox",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}\\b`, "u"));
  }
  assert.match(migration, /tr_sales_posting_idempotency_no_update/u);
  assert.match(migration, /tr_sales_posting_provenance_no_update/u);
  assert.match(migration, /UNIQUE\(company_id,source_type,source_document_id,source_version\)/u);
});

test("Sales Posting migration executes against the real prerequisite boundary", async () => {
  const migration = await read("../src-tauri/migrations/0037_sales_posting.sql");
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE companies (id TEXT PRIMARY KEY);
    CREATE TABLE branches (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      UNIQUE(company_id,id)
    );
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      UNIQUE(company_id,id)
    );
    CREATE TABLE journal_vouchers (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL
    );
    CREATE TABLE journal_lines (
      id TEXT PRIMARY KEY,
      voucher_id TEXT NOT NULL,
      UNIQUE(voucher_id,id)
    );
  `);
  db.exec(migration);

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sales_posting%' ORDER BY name"
  ).all().map(row => String(row.name));

  assert.deepEqual(tables, [
    "sales_posting_idempotency",
    "sales_posting_journal_provenance",
    "sales_posting_outbox",
    "sales_posting_rules",
    "sales_postings",
  ]);
  db.close();
});

test("desktop runtime wires finalized Sales and confirmed Sales Issue into posting evaluation", async () => {
  const salesPage = await read("../src/pages/sales/sales-documents-page.tsx");
  const inventoryPage = await read("../src/pages/inventory/inventory-documents-page.tsx");
  const composition = await read(
    "../src/composition/sales-posting/create-sales-posting-workspace-services.ts",
  );

  assert.match(salesPage, /posting\.evaluateAndPost/u);
  assert.match(salesPage, /Catch up finalized invoices/u);
  assert.match(inventoryPage, /sourceSystem === "sales"/u);
  assert.match(inventoryPage, /posting\.evaluateAndPost/u);
  assert.match(composition, /inventory_valuation_entries/u);
  assert.match(composition, /SqliteJournalVoucherRepository/u);
  assert.match(composition, /sales_posting_idempotency/u);
});
