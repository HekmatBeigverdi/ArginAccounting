import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("purchase migration is registered as version 30", async () => {
  const runner = await read("../src-tauri/src/lib.rs");
  assert.match(runner, /version:\s*30/u);
  assert.match(runner, /0030_purchase_workflow\.sql/u);
});

test("purchase migration defines the complete persistence boundary", async () => {
  const migration = await read("../src-tauri/migrations/0030_purchase_workflow.sql");
  for (const table of [
    "purchase_documents",
    "purchase_document_lines",
    "purchase_document_lifecycle",
    "purchase_commercial_facts",
    "purchase_receipt_invoice_matches",
    "purchase_valuation_cost_inputs",
    "purchase_idempotency",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}\\b`, "u"));
  }
});

test("purchase immutable facts are append-only at SQLite boundary", async () => {
  const migration = await read("../src-tauri/migrations/0030_purchase_workflow.sql");
  for (const trigger of [
    "tr_purchase_document_lifecycle_no_update",
    "tr_purchase_document_lifecycle_no_delete",
    "tr_purchase_receipt_invoice_matches_no_update",
    "tr_purchase_receipt_invoice_matches_no_delete",
  ]) assert.match(migration, new RegExp(trigger, "u"));
});

test("purchase schema protects numbering matching and replay identities", async () => {
  const migration = await read("../src-tauri/migrations/0030_purchase_workflow.sql");
  assert.match(migration, /uq_purchase_documents_number_scope/u);
  assert.match(migration, /uq_purchase_receipt_invoice_match_pair/u);
  assert.match(migration, /UNIQUE\s*\(company_id,\s*movement_id\)/u);
  assert.match(migration, /PRIMARY KEY\s*\(company_id,\s*request_id\)/u);
  assert.match(migration, /UNIQUE\s*\(company_id,\s*operation_id\)/u);
  assert.match(migration, /payload_fingerprint TEXT NOT NULL/u);
});

test("purchase schema provides bounded query and bridge indexes", async () => {
  const migration = await read("../src-tauri/migrations/0030_purchase_workflow.sql");
  for (const index of [
    "ix_purchase_documents_list",
    "ix_purchase_documents_supplier",
    "ix_purchase_documents_branch_date",
    "ix_purchase_documents_fiscal",
    "ix_purchase_documents_sync_changes",
    "ix_purchase_matches_invoice_line",
    "ix_purchase_matches_receipt_line",
    "ix_purchase_cost_inputs_movement",
  ]) assert.match(migration, new RegExp(index, "u"));
});
