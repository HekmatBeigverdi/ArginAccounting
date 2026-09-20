import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseExecuteResult, DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import { PurchaseApplicationError, type PurchaseUnitOfWorkContext } from "@argin/purchase";
import {
  SqlitePurchaseCommercialFactRepository,
  SqlitePurchaseDocumentRepository,
  SqlitePurchaseIdempotencyRepository,
  SqlitePurchaseReceiptInvoiceMatchRepository,
  SqlitePurchaseUnitOfWork,
  SqlitePurchaseValuationCostInputRepository,
} from "../src/index.ts";

class RecordingDatabase implements DatabaseExecutor {
  readonly statements: { sql: string; parameters: readonly DatabaseValue[] }[] = [];
  transactionCount = 0;
  executeResult: DatabaseExecuteResult = { rowsAffected: 1 };
  queryOneResult: unknown = null;
  queryResult: unknown[] = [];

  async execute(sql: string, parameters: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    this.statements.push({ sql, parameters });
    return this.executeResult;
  }
  async query<T>(): Promise<T[]> { return this.queryResult as T[]; }
  async queryOne<T>(): Promise<T | null> { return this.queryOneResult as T | null; }
  async transaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return operation(this);
  }
  async close(): Promise<void> {}
}

test("Purchase UoW exposes five repositories through one transaction-bound session", async () => {
  const db = new RecordingDatabase();
  const uow = new SqlitePurchaseUnitOfWork(db);
  let captured: PurchaseUnitOfWorkContext | undefined;
  const result = await uow.execute(async (context) => {
    captured = context;
    assert.ok(context.documents);
    assert.ok(context.commercialFacts);
    assert.ok(context.matches);
    assert.ok(context.costInputs);
    assert.ok(context.idempotency);
    assert.equal(uow.sessionFor(context), db);
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(db.transactionCount, 1);
  assert.ok(captured);
  assert.throws(() => uow.sessionFor(captured!), /not active/u);
});

test("Purchase document update uses compare-and-swap and maps stale versions", async () => {
  const db = new RecordingDatabase();
  db.executeResult = { rowsAffected: 0 };
  db.queryOneResult = { version: 7 };
  const repo = new SqlitePurchaseDocumentRepository(db);
  await assert.rejects(
    () => repo.update({
      scope: {
        companyId: "company-1", branchId: "branch-1", fiscalYearId: "fy-1", fiscalPeriodId: "fp-1",
        fiscalYearStartDate: "2026-03-21", fiscalYearEndDate: "2027-03-20",
        fiscalPeriodStartDate: "2026-08-23", fiscalPeriodEndDate: "2026-09-22",
        fiscalYearStatus: "open", fiscalPeriodStatus: "open", lockedThroughDate: null,
      },
      documentId: "purchase-1", companyId: "company-1", supplierId: "supplier-1",
      supplierSnapshot: {
        companyId: "company-1", supplierId: "supplier-1", code: "SUP-1", displayName: "Supplier",
        classification: "legal-entity", nationalCode: null, nationalId: "10101234567",
        economicNumber: null, taxFileNumber: null,
      },
      documentType: "supplier-invoice", status: "draft", lifecycleHistory: [],
      documentNumber: "PINV-1", businessDate: "2026-09-18", description: null,
      sourceReference: null, correctionReference: null, lines: [], version: 8,
      createdAt: "2026-09-18T08:00:00.000Z", updatedAt: "2026-09-18T09:00:00.000Z",
    }, 6),
    (error: unknown) => error instanceof PurchaseApplicationError && error.code === "PURCHASE_APP_VERSION_CONFLICT",
  );
  assert.match(db.statements[0]?.sql ?? "", /WHERE company_id=\? AND id=\? AND version=\?/u);
});

test("Commercial Fact repository persists the authoritative terms snapshot", async () => {
  const db = new RecordingDatabase();
  const repo = new SqlitePurchaseCommercialFactRepository(db);
  await repo.addBatch([{
    companyId: "company-1", purchaseDocumentId: "purchase-1", purchaseLineId: "line-1", revision: 1,
    commercialTerms: {
      quantity: {
        enteredQuantity: "2", baseQuantity: "2",
        enteredUnit: { unitId: "pcs", code: "PCS", title: "Piece", ratioToBase: "1", precision: 0, roundingMode: "half-up", taxpayerUnitCode: "1621" },
        baseUnit: { unitId: "pcs", code: "PCS", title: "Piece", ratioToBase: "1", precision: 0, roundingMode: "half-up", taxpayerUnitCode: "1621" },
      },
      unitPrice: { amount: 1000, currency: "IRR" }, discounts: [], charges: [],
      tax: { treatment: "taxable", rateBasisPoints: 1000 }, moneyRoundingMode: "half-away-from-zero",
    },
  }]);
  assert.match(db.statements[0]?.sql ?? "", /INSERT INTO purchase_commercial_facts/u);
  assert.equal(db.statements[0]?.parameters[1], "purchase-1");
  assert.equal(db.statements[0]?.parameters[2], "line-1");
});

test("Match and Cost Input repositories write only their owned Purchase tables", async () => {
  const db = new RecordingDatabase();
  await new SqlitePurchaseReceiptInvoiceMatchRepository(db).add({
    matchId: "match-1", companyId: "company-1", invoiceDocumentId: "invoice-1", invoiceLineId: "line-1",
    receiptDocumentId: "receipt-1", receiptLineId: "receipt-line-1", productId: "product-1", matchedBaseQuantity: "2",
  });
  await new SqlitePurchaseValuationCostInputRepository(db).add({
    costInputId: "cost-1", companyId: "company-1", movementId: "move-1",
    receiptDocumentId: "receipt-1", receiptLineId: "receipt-line-1", productId: "product-1",
    sources: [],
    basis: {
      basisLineId: "cost-1", movementId: "move-1", productId: "product-1", warehouseId: "warehouse-1",
      quantity: "2", currency: "IRR", baseCost: 2000, landedCost: 0, totalCost: 2000, unitCost: "1000", allocations: [],
    },
  });
  assert.match(db.statements[0]?.sql ?? "", /purchase_receipt_invoice_matches/u);
  assert.match(db.statements[1]?.sql ?? "", /purchase_valuation_cost_inputs/u);
  assert.doesNotMatch(db.statements.map(item => item.sql).join("\n"), /UPDATE inventory_|INSERT INTO inventory_/u);
});


test("Purchase idempotency repository persists exact replay identity and result", async () => {
  const db = new RecordingDatabase();
  const repo = new SqlitePurchaseIdempotencyRepository(db);
  await repo.add({
    companyId: "company-1",
    requestId: "request-1",
    operationId: "operation-1",
    operation: "create:purchase-1",
    payloadFingerprint: "fingerprint-1",
    outcomeKind: "document",
    outcomeId: "purchase-1",
    outcomeVersion: 1,
    outcomeStatus: "draft",
    resultJson: JSON.stringify({ documentId: "purchase-1", version: 1 }),
    recordedAt: "2026-09-18T08:00:00.000Z",
  });
  assert.match(db.statements.at(-1)?.sql ?? "", /INSERT INTO purchase_idempotency/u);
  assert.deepEqual(db.statements.at(-1)?.parameters.slice(0, 5), [
    "company-1", "request-1", "operation-1", "create:purchase-1", "fingerprint-1",
  ]);
});
