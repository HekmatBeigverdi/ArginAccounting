import assert from "node:assert/strict";
import test from "node:test";

import {
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
  unitId: "piece",
  code: "PCS",
  title: "Piece",
  ratioToBase: "1",
  precision: 0,
  roundingMode: "half-up" as const,
  taxpayerUnitCode: "1621",
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
const context = {
  companyId: "company-001",
  branchId: "branch-001",
  requestId: "request-001",
  operationId: "operation-001",
  actorUserId: "user-001",
  occurredAt: "2026-09-17T08:00:00.000Z",
};

function createHarness() {
  const documents = new Map<string, any>();
  const commercialFacts = new Map<string, any>();
  const matches: any[] = [];
  const costInputs = new Map<string, any>();
  const events: string[] = [];

  const repositories = {
    documents: {
      async findById(_companyId: string, id: string) { return documents.get(id) ?? null; },
      async findByNumber() { return null; },
      async list() { return [...documents.values()]; },
      async add(document: any) { events.push("document:add"); documents.set(document.documentId, document); },
      async update(document: any, expectedVersion: number) {
        events.push(`document:update:${expectedVersion}`);
        documents.set(document.documentId, document);
      },
    },
    commercialFacts: {
      async findByLine(_companyId: string, documentId: string, lineId: string) { return commercialFacts.get(`${documentId}:${lineId}`) ?? null; },
      async listByDocument(_companyId: string, documentId: string) { return [...commercialFacts.values()].filter((x: any) => x.purchaseDocumentId === documentId); },
      async addBatch(facts: readonly any[]) {
        events.push("commercial:add");
        for (const fact of facts) commercialFacts.set(`${fact.purchaseDocumentId}:${fact.purchaseLineId}`, fact);
      },
      async replaceBatch() {},
    },
    matches: {
      async findById(_companyId: string, matchId: string) { return matches.find(x => x.matchId === matchId) ?? null; },
      async listByInvoiceLine(_companyId: string, documentId: string, lineId: string) { return matches.filter(x => x.invoiceDocumentId === documentId && x.invoiceLineId === lineId); },
      async listByReceiptLine(_companyId: string, documentId: string, lineId: string) { return matches.filter(x => x.receiptDocumentId === documentId && x.receiptLineId === lineId); },
      async add(match: any) { matches.push(match); },
    },
    costInputs: {
      async findByMovement(_companyId: string, movementId: string) { return costInputs.get(movementId) ?? null; },
      async listUnresolvedByCompany() { return []; },
      async add(costInput: any) { costInputs.set(costInput.movementId, costInput); },
      async replaceForMovement(_companyId: string, movementId: string, costInput: any) { costInputs.set(movementId, costInput); },
    },
  };

  const services = createPurchaseApplicationServices({
    uow: {
      async execute(work: any) {
        events.push("uow:begin");
        const result = await work(repositories);
        events.push("uow:commit");
        return result;
      },
    },
    fiscalEligibility: {
      async assertOperationAllowed() { events.push("fiscal:check"); },
    },
    numberReservation: {
      async reserve() { events.push("number:reserve"); return "PINV-000001"; },
    },
    inventoryReceipt: {
      async stageDraft(request: any) {
        events.push("inventory:stage");
        return { inventoryDocumentId: request.inventoryDocumentId, status: "draft", version: 1 };
      },
    },
    receiptLines: {
      async findConfirmedLine() { return null; },
    },
    inventoryMovements: {
      async findById() { return null; },
    },
    valuationRecalculation: {
      async costBasisChanged() { events.push("valuation:recalculate"); },
    },
  });

  return { services, documents, commercialFacts, events };
}

function createCommand() {
  return {
    context,
    document: {
      scope,
      documentId: "purchase-001",
      companyId: "company-001",
      supplierId: "supplier-001",
      supplierSnapshot,
      documentType: "supplier-invoice" as const,
      businessDate: "2026-09-17",
      createdAt: "2026-09-17T08:00:00.000Z",
      lines: [{
        lineId: "line-001",
        position: 1,
        lineKind: "stock-product" as const,
        itemId: "product-001",
        itemSnapshot,
      }],
    },
    commercialTermsByLine: { "line-001": terms },
  };
}

test("create orchestrates fiscal validation, number reservation and atomic Purchase persistence", async () => {
  const h = createHarness();
  const document = await h.services.commands.create(createCommand());
  assert.equal(document.documentNumber, "PINV-000001");
  assert.equal(h.documents.size, 1);
  assert.equal(h.commercialFacts.size, 1);
  assert.deepEqual(h.events.slice(0, 6), [
    "uow:begin", "fiscal:check", "number:reserve", "document:add", "commercial:add", "uow:commit",
  ]);
});

test("lifecycle mutation rechecks current fiscal eligibility and uses expected aggregate version", async () => {
  const h = createHarness();
  const created = await h.services.commands.create(createCommand());
  h.events.length = 0;
  const submitted = await h.services.commands.submit({ context, documentId: created.documentId, expectedVersion: created.version });
  assert.equal(submitted.status, "submitted");
  assert.deepEqual(h.events, ["uow:begin", "fiscal:check", "document:update:1", "uow:commit"]);
});

test("Inventory receipt staging resolves Purchase-owned commercial facts and only calls the Inventory port after Purchase read transaction", async () => {
  const h = createHarness();
  let document = await h.services.commands.create(createCommand());
  document = await h.services.commands.submit({ context, documentId: document.documentId, expectedVersion: document.version });
  document = await h.services.commands.approve({ context, documentId: document.documentId, expectedVersion: document.version });
  document = await h.services.commands.confirm({ context, documentId: document.documentId, expectedVersion: document.version });
  h.events.length = 0;

  const result = await h.services.commands.stageInventoryReceipt({
    context,
    purchaseDocumentId: document.documentId,
    inventoryDocumentId: "inventory-receipt-001",
    allocations: [{
      purchaseLineId: "line-001",
      baseQuantity: "10",
      warehouse: { warehouseId: "warehouse-001", zoneId: null, locationId: null },
    }],
    payloadFingerprint: "fingerprint-001",
  });

  assert.equal(result.status, "draft");
  assert.deepEqual(h.events, ["uow:begin", "uow:commit", "inventory:stage"]);
});
