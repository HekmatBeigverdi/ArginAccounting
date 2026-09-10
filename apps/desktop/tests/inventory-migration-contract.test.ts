import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("inventory migration is registered as version 26", async () => {
  const runner = await read("../src-tauri/src/lib.rs");
  assert.match(runner, /version:\s*26/u);
  assert.match(runner, /0026_inventory_documents\.sql/u);
});

test("inventory migration defines the complete persistence boundary", async () => {
  const migration = await read("../src-tauri/migrations/0026_inventory_documents.sql");
  for (const table of [
    "inventory_documents",
    "inventory_document_lines",
    "inventory_document_lifecycle",
    "inventory_stock_movements",
    "inventory_opening_balances",
    "inventory_stock_balances",
    "inventory_business_orders",
    "inventory_idempotency",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}\\b`, "u"));
  }
});

test("inventory movement and lifecycle facts are append-only at SQLite boundary", async () => {
  const migration = await read("../src-tauri/migrations/0026_inventory_documents.sql");
  assert.match(migration, /tr_inventory_stock_movements_no_update/u);
  assert.match(migration, /tr_inventory_stock_movements_no_delete/u);
  assert.match(migration, /tr_inventory_document_lifecycle_no_update/u);
  assert.match(migration, /tr_inventory_document_lifecycle_no_delete/u);
  assert.match(migration, /tr_inventory_opening_balances_no_update/u);
  assert.match(migration, /tr_inventory_opening_balances_no_delete/u);
});

test("inventory uniqueness handles nullable physical StockKey dimensions", async () => {
  const migration = await read("../src-tauri/migrations/0026_inventory_documents.sql");
  assert.match(migration, /uq_inventory_stock_movements_source_stock_key/u);
  assert.match(migration, /uq_inventory_opening_balances_fiscal_stock_key/u);
  assert.match(migration, /uq_inventory_stock_balances_stock_key/u);
  assert.match(migration, /COALESCE\(zone_id, ''\)/u);
  assert.match(migration, /COALESCE\(location_id, ''\)/u);
});

test("inventory schema protects replay and reversal identity", async () => {
  const migration = await read("../src-tauri/migrations/0026_inventory_documents.sql");
  assert.match(migration, /PRIMARY KEY \(company_id, request_key\)/u);
  assert.match(migration, /payload_fingerprint TEXT NOT NULL/u);
  assert.match(migration, /document_status TEXT NOT NULL/u);
  assert.match(migration, /uq_inventory_stock_movements_reversal_once/u);
  assert.match(migration, /reversal_of_movement_id/u);
  assert.match(migration, /transfer_id/u);
});

test("inventory schema provides bounded list kardex balance and sync indexes", async () => {
  const migration = await read("../src-tauri/migrations/0026_inventory_documents.sql");
  assert.match(migration, /ix_inventory_documents_list/u);
  assert.match(migration, /ix_inventory_stock_movements_stock_kardex/u);
  assert.match(migration, /ix_inventory_stock_balances_company_warehouse/u);
  assert.match(migration, /ix_inventory_stock_balances_company_product/u);
  assert.match(migration, /ix_inventory_documents_sync_changes/u);
});
