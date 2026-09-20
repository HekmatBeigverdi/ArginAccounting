import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseExecuteResult, DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import { SqlitePurchaseOperationalReportReader } from "../src/index.ts";

class ReportDatabase implements DatabaseExecutor {
  readonly reads: { sql: string; parameters: readonly DatabaseValue[] }[] = [];

  async execute(): Promise<DatabaseExecuteResult> { return { rowsAffected: 0 }; }
  async query<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T[]> {
    this.reads.push({ sql, parameters });
    return [];
  }
  async queryOne<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    this.reads.push({ sql, parameters });
    return null;
  }
  async transaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T> {
    return operation(this);
  }
  async close(): Promise<void> {}
}

const query = {
  companyId: "company-1",
  branchId: "branch-1",
  fiscalYearId: "fy-1",
  supplierId: "supplier-1",
  fromBusinessDate: "2026-09-01",
  toBusinessDate: "2026-09-30",
  limit: 25,
  offset: 50,
} as const;

test("document register applies Company/Branch/Fiscal/Supplier/date scope with bounded lookahead", async () => {
  const db = new ReportDatabase();
  const reader = new SqlitePurchaseOperationalReportReader(db);
  const result = await reader.readDocumentRegister(query);
  assert.deepEqual(result, { items: [], nextOffset: null });
  const read = db.reads[0]!;
  assert.match(read.sql, /FROM purchase_documents/u);
  assert.match(read.sql, /company_id=\?/u);
  assert.match(read.sql, /branch_id=\?/u);
  assert.match(read.sql, /fiscal_year_id=\?/u);
  assert.match(read.sql, /supplier_id=\?/u);
  assert.match(read.sql, /business_date>=\?/u);
  assert.match(read.sql, /business_date<=\?/u);
  assert.match(read.sql, /LIMIT \? OFFSET \?/u);
  assert.deepEqual(read.parameters.slice(-2), [26, 50]);
});

test("matching report reads Supplier Invoice lines only and remains bounded", async () => {
  const db = new ReportDatabase();
  const reader = new SqlitePurchaseOperationalReportReader(db);
  const result = await reader.readInvoiceMatching(query);
  assert.deepEqual(result, { items: [], nextOffset: null });
  const read = db.reads[0]!;
  assert.match(read.sql, /purchase_document_lines/u);
  assert.match(read.sql, /purchase_commercial_facts/u);
  assert.match(read.sql, /document_type='supplier-invoice'/u);
  assert.match(read.sql, /status IN \('confirmed','returned','corrected'\)/u);
  assert.deepEqual(read.parameters.slice(-2), [26, 50]);
});

test("unresolved-cost report scans only confirmed Purchase receipts missing Cost Input", async () => {
  const db = new ReportDatabase();
  const reader = new SqlitePurchaseOperationalReportReader(db);
  const result = await reader.readUnresolvedCosts(query);
  assert.deepEqual(result, { items: [], nextOffset: null });
  const read = db.reads[0]!;
  assert.match(read.sql, /inventory_stock_movements/u);
  assert.match(read.sql, /purchase_valuation_cost_inputs/u);
  assert.match(read.sql, /d\.document_type='receipt'/u);
  assert.match(read.sql, /d\.status='confirmed'/u);
  assert.match(read.sql, /d\.source_system='purchase'/u);
  assert.match(read.sql, /c\.cost_input_id IS NULL/u);
  assert.match(read.sql, /d\.origin_branch_id=\?/u);
  assert.match(read.sql, /d\.fiscal_year_id=\?/u);
  assert.deepEqual(read.parameters.slice(-2), [26, 50]);
});
