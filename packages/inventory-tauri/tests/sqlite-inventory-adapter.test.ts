import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseExecuteResult, DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import { InventoryApplicationError } from "@argin/inventory";
import {
  SqliteInventoryBusinessOrderRepository,
  SqliteInventoryDocumentRepository,
  SqliteInventoryIdempotencyRepository,
  SqliteInventoryMovementRepository,
  SqliteInventoryUnitOfWork,
} from "../src/index.ts";

class RecordingDatabase implements DatabaseExecutor {
  readonly statements: { sql: string; parameters: readonly DatabaseValue[] }[] = [];
  transactionCount = 0;
  executeResult: DatabaseExecuteResult = { rowsAffected: 1 };
  queryOneResult: unknown = null;

  async execute(sql: string, parameters: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    this.statements.push({ sql, parameters });
    return this.executeResult;
  }
  async query<T>(): Promise<T[]> { return []; }
  async queryOne<T>(): Promise<T | null> { return this.queryOneResult as T | null; }
  async transaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return operation(this);
  }
  async close(): Promise<void> {}
}

test("Inventory UoW exposes all repositories through one database transaction", async () => {
  const db = new RecordingDatabase();
  const result = await new SqliteInventoryUnitOfWork(db).execute(async (context) => {
    assert.ok(context.documents);
    assert.ok(context.movements);
    assert.ok(context.balances);
    assert.ok(context.openings);
    assert.ok(context.businessOrders);
    assert.ok(context.idempotency);
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(db.transactionCount, 1);
});

test("business order uses one atomic UPSERT RETURNING statement", async () => {
  const db = new RecordingDatabase();
  db.queryOneResult = { last_order: 4 };
  const value = await new SqliteInventoryBusinessOrderRepository(db).next("company-1", "2026-09-08");
  assert.equal(value, 4);
  // queryOne is stubbed, so inspect the contract source through method behavior by using a session spy.
  const session: DatabaseSession = {
    execute: (sql, parameters) => db.execute(sql, parameters),
    query: <T>(_sql: string, _parameters?: readonly DatabaseValue[]) => db.query<T>(),
    async queryOne<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T | null> {
      db.statements.push({ sql, parameters });
      return { last_order: 5 } as T;
    },
  };
  const repo = new SqliteInventoryBusinessOrderRepository(session);
  assert.equal(await repo.next("company-1", "2026-09-08"), 5);
  assert.match(db.statements.at(-1)?.sql ?? "", /ON CONFLICT\(company_id,business_date\).*RETURNING last_order/su);
});

test("movement repository routes reversal facts to compensation partition", async () => {
  const db = new RecordingDatabase();
  const repo = new SqliteInventoryMovementRepository(db);
  await repo.appendBatch([{
    movementId: "move-reverse-1",
    companyId: "company-1",
    documentId: "reversal-effect-1",
    lineId: "line-original-1",
    transferId: null,
    reversalOfMovementId: "move-original-1",
    stockKey: { companyId: "company-1", productId: "product-1", warehouseId: "warehouse-1", zoneId: null, locationId: null },
    businessDate: "2026-09-08",
    businessOrder: 2,
    recordedAt: "2026-09-08T08:00:00.000Z",
    quantityDelta: "-5",
  }]);
  assert.match(db.statements[0]?.sql ?? "", /inventory_stock_movement_compensations/u);
});

test("idempotency result is durable by Company and request key", async () => {
  const db = new RecordingDatabase();
  const repo = new SqliteInventoryIdempotencyRepository(db);
  await repo.add({
    companyId: "company-1", requestKey: "request-1", operation: "confirm:document-1",
    payloadFingerprint: "fp-1", outcomeKind: "confirmation", documentId: "document-1",
    documentVersion: 4, documentStatus: "confirmed", recordedAt: "2026-09-08T08:00:00.000Z",
  });
  assert.match(db.statements[0]?.sql ?? "", /INSERT INTO inventory_idempotency/u);
  assert.deepEqual(db.statements[0]?.parameters.slice(0, 2), ["company-1", "request-1"]);
});

test("document CAS maps stale version to stable concurrency conflict", async () => {
  const db = new RecordingDatabase();
  db.executeResult = { rowsAffected: 0 };
  db.queryOneResult = { version: 7 };
  const repo = new SqliteInventoryDocumentRepository(db);
  await assert.rejects(
    () => repo.update({
      documentId: "document-1", companyId: "company-1", documentType: "receipt", status: "draft",
      documentNumber: null, businessDate: "2026-09-08", description: null, sourceReference: null,
      scope: { branchId: null, destinationBranchId: null, fiscalYearId: "fy-1", fiscalPeriodId: "fp-1" },
      lines: [], lifecycleHistory: [], version: 8,
      createdAt: "2026-09-08T07:00:00.000Z", updatedAt: "2026-09-08T08:00:00.000Z",
    }, 6),
    (error: unknown) => error instanceof InventoryApplicationError && error.code === "inventory.application.concurrency-conflict",
  );
});

test("normal movement facts remain in the primary append-only movement table", async () => {
  const db = new RecordingDatabase();
  const repo = new SqliteInventoryMovementRepository(db);
  await repo.appendBatch([{
    movementId: "move-1", companyId: "company-1", documentId: "document-1", lineId: "line-1",
    transferId: null, reversalOfMovementId: null,
    stockKey: { companyId: "company-1", productId: "product-1", warehouseId: "warehouse-1", zoneId: null, locationId: null },
    businessDate: "2026-09-08", businessOrder: 1, recordedAt: "2026-09-08T08:00:00.000Z", quantityDelta: "5",
  }]);
  assert.match(db.statements[0]?.sql ?? "", /INSERT INTO inventory_stock_movements/u);
  assert.doesNotMatch(db.statements[0]?.sql ?? "", /compensations/u);
});
