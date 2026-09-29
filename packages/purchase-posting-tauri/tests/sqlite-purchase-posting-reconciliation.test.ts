import assert from "node:assert/strict";
import test from "node:test";

import type {
  DatabaseExecuteResult,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import { SqlitePurchasePostingReconciliationReader } from "../src/index.ts";

class StubSession implements DatabaseSession {
  readonly calls: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];
  async execute(): Promise<DatabaseExecuteResult> { return { rowsAffected: 0 }; }
  async query<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T[]> {
    this.calls.push({ sql, parameters });
    return [];
  }
  async queryOne<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    this.calls.push({ sql, parameters });
    return null;
  }
}

test("source reconciliation lookup uses durable source identity fields", async () => {
  const db = new StubSession();
  const reader = new SqlitePurchasePostingReconciliationReader(db);
  const result = await reader.findBySource("company-001", "supplier-invoice", "invoice-001");

  assert.deepEqual(result, []);
  assert.match(db.calls[0]?.sql ?? "", /purchase_posting_idempotency/u);
  assert.match(db.calls[0]?.sql ?? "", /source_type=\? AND source_id=\?/u);
  assert.deepEqual(db.calls[0]?.parameters, [
    "company-001", "supplier-invoice", "invoice-001",
  ]);
});

test("Journal Line reverse lookup first resolves owning Journal Voucher", async () => {
  const db = new StubSession();
  const reader = new SqlitePurchasePostingReconciliationReader(db);
  const result = await reader.findByJournalLineId("company-001", "line-001");

  assert.equal(result, null);
  assert.match(db.calls[0]?.sql ?? "", /FROM journal_lines/u);
  assert.match(db.calls[0]?.sql ?? "", /JOIN journal_vouchers/u);
  assert.deepEqual(db.calls[0]?.parameters, ["company-001", "line-001"]);
});

test("Journal reverse lookup also recognizes reversal Journal lineage", async () => {
  const db = new StubSession();
  const reader = new SqlitePurchasePostingReconciliationReader(db);
  const result = await reader.findByJournalVoucherId("company-001", "journal-reversal");

  assert.equal(result, null);
  assert.match(db.calls[0]?.sql ?? "", /purchase_posting_idempotency/u);
  assert.match(db.calls[1]?.sql ?? "", /purchase_posting_reversals/u);
  assert.deepEqual(db.calls[1]?.parameters, ["company-001", "journal-reversal"]);
});
