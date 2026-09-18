import assert from "node:assert/strict";
import test from "node:test";

import {
  PurchaseApplicationError,
  createPurchaseApplicationServices,
  createPurchaseCommercialTerms,
} from "../src/index.ts";

const scope = {
  companyId: "company-001",
  branchId: "branch-001",
  fiscalYearId: "fy-1405",
  fiscalPeriodId: "fp-1405-06",
  fiscalYearStartDate: "2026-03-21",
  fiscalYearEndDate: "2027-03-20",
  fiscalPeriodStartDate: "2026-08-23",
  fiscalPeriodEndDate: "2026-09-22",
  fiscalYearStatus: "open" as const,
  fiscalPeriodStatus: "open" as const,
  lockedThroughDate: "2026-09-01",
};
const supplierSnapshot = {
  companyId: "company-001",
  supplierId: "supplier-001",
  code: "SUP-001",
  displayName: "Supplier",
  classification: "legal-entity" as const,
  nationalCode: null,
  nationalId: "10101234567",
  economicNumber: null,
  taxFileNumber: null,
};
const itemSnapshot = {
  itemId: "product-001",
  itemType: "product" as const,
  code: "P-001",
  displayName: "Product",
  stockTracking: true,
  taxTreatment: "taxable" as const,
  vatRateBasisPoints: 1000,
  taxpayerGoodsServiceId: "2720000014385",
};
const unit = {
  unitId: "piece", code: "PCS", title: "Piece", ratioToBase: "1", precision: 0,
  roundingMode: "half-up" as const, taxpayerUnitCode: "1621",
};
const terms = createPurchaseCommercialTerms({
  enteredQuantity: "10",
  enteredUnit: unit,
  baseUnit: unit,
  unitPrice: { amount: 100, currency: "IRR" },
  discounts: [],
  charges: [],
  tax: { treatment: "taxable", rateBasisPoints: 1000 },
});

const operationContext = (overrides: Partial<{
  requestId: string; operationId: string; payloadFingerprint: string;
}> = {}) => ({
  companyId: "company-001",
  branchId: "branch-001",
  requestId: overrides.requestId ?? "request-001",
  operationId: overrides.operationId ?? "operation-001",
  payloadFingerprint: overrides.payloadFingerprint ?? "fingerprint-001",
  actorUserId: "user-001",
  occurredAt: "2026-09-18T08:00:00.000Z",
});

function createCommand(context = operationContext()) {
  return {
    context,
    document: {
      scope,
      documentId: "purchase-001",
      companyId: "company-001",
      supplierId: "supplier-001",
      supplierSnapshot,
      documentType: "supplier-invoice" as const,
      businessDate: "2026-09-18",
      createdAt: "2026-09-18T08:00:00.000Z",
      lines: [{
        lineId: "line-001", position: 1, lineKind: "stock-product" as const,
        itemId: "product-001", itemSnapshot,
      }],
    },
    commercialTermsByLine: { "line-001": terms },
  };
}

function createHarness() {
  const documents = new Map<string, any>();
  const commercialFacts = new Map<string, any>();
  const idempotencyByRequest = new Map<string, any>();
  const idempotencyByOperation = new Map<string, any>();
  const events: string[] = [];

  const repositories = {
    documents: {
      async findById(_companyId: string, id: string) { return documents.get(id) ?? null; },
      async findByNumber() { return null; },
      async list() { return [...documents.values()]; },
      async add(document: any) { events.push("document:add"); documents.set(document.documentId, document); },
      async update(document: any) { events.push("document:update"); documents.set(document.documentId, document); },
    },
    commercialFacts: {
      async findByLine(_companyId: string, documentId: string, lineId: string) { return commercialFacts.get(`${documentId}:${lineId}`) ?? null; },
      async listByDocument(_companyId: string, documentId: string) {
        return [...commercialFacts.values()].filter((x: any) => x.purchaseDocumentId === documentId);
      },
      async addBatch(facts: readonly any[]) {
        events.push("commercial:add");
        for (const fact of facts) commercialFacts.set(`${fact.purchaseDocumentId}:${fact.purchaseLineId}`, fact);
      },
      async replaceBatch() {},
    },
    matches: {
      async findById() { return null; },
      async listByInvoiceLine() { return []; },
      async listByReceiptLine() { return []; },
      async add() { events.push("match:add"); },
    },
    costInputs: {
      async findByMovement() { return null; },
      async listUnresolvedByCompany() { return []; },
      async add() { events.push("cost:add"); },
      async replaceForMovement() { events.push("cost:replace"); },
    },
    idempotency: {
      async findByRequestId(companyId: string, requestId: string) {
        return idempotencyByRequest.get(`${companyId}:${requestId}`) ?? null;
      },
      async findByOperationId(companyId: string, operationId: string) {
        return idempotencyByOperation.get(`${companyId}:${operationId}`) ?? null;
      },
      async add(record: any) {
        events.push("idempotency:add");
        idempotencyByRequest.set(`${record.companyId}:${record.requestId}`, record);
        idempotencyByOperation.set(`${record.companyId}:${record.operationId}`, record);
      },
    },
  };

  let numberReservations = 0;
  let inventoryStages = 0;
  const services = createPurchaseApplicationServices({
    uow: { async execute(work: any) { return work(repositories); } },
    fiscalEligibility: { async assertOperationAllowed() {} },
    numberReservation: {
      async reserve() { numberReservations += 1; return `PINV-${String(numberReservations).padStart(6, "0")}`; },
    },
    inventoryReceipt: {
      async stageDraft(request: any) {
        inventoryStages += 1;
        return { inventoryDocumentId: request.inventoryDocumentId, status: "draft", version: 1 };
      },
    },
    receiptLines: { async findConfirmedLine() { return null; } },
    inventoryMovements: { async findById() { return null; } },
    valuationRecalculation: { async costBasisChanged() {} },
  });

  return {
    services, documents, events,
    get numberReservations() { return numberReservations; },
    get inventoryStages() { return inventoryStages; },
  };
}

test("same request operation and fingerprint replays exact create result without another number or write", async () => {
  const h = createHarness();
  const command = createCommand();
  const first = await h.services.commands.create(command);
  const writesAfterFirst = h.events.slice();
  h.documents.set(first.documentId, { ...first, status: "confirmed", version: 99 });

  const replay = await h.services.commands.create(command);

  assert.deepEqual(replay, first);
  assert.equal(h.numberReservations, 1);
  assert.deepEqual(h.events, writesAfterFirst);
});

test("replay is resolved before stale expectedVersion validation", async () => {
  const h = createHarness();
  const created = await h.services.commands.create(createCommand());
  const submitContext = operationContext({
    requestId: "request-submit",
    operationId: "operation-submit",
    payloadFingerprint: "fingerprint-submit",
  });
  const command = { context: submitContext, documentId: created.documentId, expectedVersion: created.version };
  const submitted = await h.services.commands.submit(command);

  h.documents.set(created.documentId, { ...submitted, version: 50 });
  const replay = await h.services.commands.submit(command);

  assert.deepEqual(replay, submitted);
  assert.equal(h.events.filter(x => x === "document:update").length, 1);
});

test("same request identity with a different payload fingerprint is a conflict", async () => {
  const h = createHarness();
  await h.services.commands.create(createCommand());

  await assert.rejects(
    () => h.services.commands.create(createCommand(operationContext({ payloadFingerprint: "different" }))),
    (error: unknown) =>
      error instanceof PurchaseApplicationError &&
      error.code === "PURCHASE_APP_IDEMPOTENCY_CONFLICT",
  );
  assert.equal(h.numberReservations, 1);
});

test("same operationId cannot be rebound to another requestId", async () => {
  const h = createHarness();
  await h.services.commands.create(createCommand());

  await assert.rejects(
    () => h.services.commands.create(createCommand(operationContext({ requestId: "request-other" }))),
    (error: unknown) =>
      error instanceof PurchaseApplicationError &&
      error.code === "PURCHASE_APP_IDEMPOTENCY_CONFLICT",
  );
  assert.equal(h.numberReservations, 1);
});

test("Inventory staging replay returns stored outcome without invoking Inventory twice", async () => {
  const h = createHarness();
  let document = await h.services.commands.create(createCommand());
  for (const [name, fn] of [
    ["submit", h.services.commands.submit],
    ["approve", h.services.commands.approve],
    ["confirm", h.services.commands.confirm],
  ] as const) {
    const context = operationContext({
      requestId: `request-${name}`,
      operationId: `operation-${name}`,
      payloadFingerprint: `fingerprint-${name}`,
    });
    document = await fn({ context, documentId: document.documentId, expectedVersion: document.version });
  }

  const stageContext = operationContext({
    requestId: "request-stage",
    operationId: "operation-stage",
    payloadFingerprint: "stage-fingerprint",
  });
  const command = {
    context: stageContext,
    purchaseDocumentId: document.documentId,
    inventoryDocumentId: "inventory-001",
    allocations: [{
      purchaseLineId: "line-001",
      baseQuantity: "10",
      warehouse: { warehouseId: "warehouse-001", zoneId: null, locationId: null },
    }],
    payloadFingerprint: "stage-fingerprint",
  };
  const first = await h.services.commands.stageInventoryReceipt(command);
  const replay = await h.services.commands.stageInventoryReceipt(command);

  assert.deepEqual(replay, first);
  assert.equal(h.inventoryStages, 1);
});
