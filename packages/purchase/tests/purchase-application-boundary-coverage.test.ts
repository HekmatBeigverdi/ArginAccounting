import assert from "node:assert/strict";
import test from "node:test";

import {
  PurchaseApplicationError,
  createPurchaseApplicationServices,
  createPurchaseCommercialTerms,
  type PurchaseReceiptMatchingLineReference,
  type PurchaseValuationMovementReference,
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
  lockedThroughDate: null,
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
  precision: 2,
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

const context = (name: string, overrides: Partial<{
  companyId: string;
  branchId: string;
  payloadFingerprint: string;
}> = {}) => ({
  companyId: overrides.companyId ?? "company-001",
  branchId: overrides.branchId ?? "branch-001",
  requestId: "request-" + name,
  operationId: "operation-" + name,
  payloadFingerprint: overrides.payloadFingerprint ?? "fingerprint-" + name,
  actorUserId: "user-001",
  occurredAt: "2026-09-20T12:00:00.000Z",
});

function createHarness() {
  const documents = new Map<string, any>();
  const commercialFacts = new Map<string, any>();
  const matches: any[] = [];
  const costInputs = new Map<string, any>();
  const idempotencyByRequest = new Map<string, any>();
  const idempotencyByOperation = new Map<string, any>();
  const events: string[] = [];
  let receiptLine: PurchaseReceiptMatchingLineReference | null = null;
  let movement: PurchaseValuationMovementReference | null = null;

  const repositories = {
    documents: {
      async findById(_companyId: string, id: string) { return documents.get(id) ?? null; },
      async findByNumber() { return null; },
      async list(query: any) {
        events.push("documents:list:" + JSON.stringify(query));
        return [...documents.values()].filter(document =>
          document.companyId === query.companyId &&
          (query.branchId === null || document.scope.branchId === query.branchId));
      },
      async add(document: any) { events.push("document:add"); documents.set(document.documentId, document); },
      async update(document: any) { events.push("document:update"); documents.set(document.documentId, document); },
      async replaceLines() {},
    },
    commercialFacts: {
      async findByLine(_companyId: string, documentId: string, lineId: string) {
        return commercialFacts.get(documentId + ":" + lineId) ?? null;
      },
      async listByDocument(_companyId: string, documentId: string) {
        return [...commercialFacts.values()].filter((value: any) => value.purchaseDocumentId === documentId);
      },
      async addBatch(facts: readonly any[]) {
        for (const fact of facts) commercialFacts.set(fact.purchaseDocumentId + ":" + fact.purchaseLineId, fact);
      },
      async removeByDocument() {},
      async replaceBatch() {},
    },
    matches: {
      async findById(_companyId: string, matchId: string) { return matches.find(value => value.matchId === matchId) ?? null; },
      async listByInvoiceLine(_companyId: string, documentId: string, lineId: string) {
        return matches.filter(value => value.invoiceDocumentId === documentId && value.invoiceLineId === lineId);
      },
      async listByReceiptLine(_companyId: string, documentId: string, lineId: string) {
        return matches.filter(value => value.receiptDocumentId === documentId && value.receiptLineId === lineId);
      },
      async add(match: any) { events.push("match:add"); matches.push(match); },
    },
    costInputs: {
      async findByMovement(_companyId: string, movementId: string) { return costInputs.get(movementId) ?? null; },
      async listUnresolvedByCompany() { return []; },
      async add(value: any) { events.push("cost:add"); costInputs.set(value.movementId, value); },
      async replaceForMovement(_companyId: string, movementId: string, value: any) {
        events.push("cost:replace");
        costInputs.set(movementId, value);
      },
    },
    idempotency: {
      async findByRequestId(companyId: string, requestId: string) {
        return idempotencyByRequest.get(companyId + ":" + requestId) ?? null;
      },
      async findByOperationId(companyId: string, operationId: string) {
        return idempotencyByOperation.get(companyId + ":" + operationId) ?? null;
      },
      async add(record: any) {
        events.push("idempotency:add:" + record.outcomeKind);
        idempotencyByRequest.set(record.companyId + ":" + record.requestId, record);
        idempotencyByOperation.set(record.companyId + ":" + record.operationId, record);
      },
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
    fiscalEligibility: { async assertOperationAllowed() { events.push("fiscal:check"); } },
    numberReservation: { async reserve() { events.push("number:reserve"); return "PINV-000001"; } },
    inventoryReceipt: {
      async stageDraft(request: any) {
        events.push("inventory:stage");
        return { inventoryDocumentId: request.inventoryDocumentId, status: "draft", version: 1 };
      },
    },
    receiptLines: { async findConfirmedLine() { return receiptLine; } },
    inventoryMovements: { async findById() { return movement; } },
    valuationRecalculation: { async costBasisChanged() { events.push("valuation:recalculate"); } },
  });

  return {
    services,
    documents,
    commercialFacts,
    matches,
    costInputs,
    events,
    setReceiptLine(value: PurchaseReceiptMatchingLineReference | null) { receiptLine = value; },
    setMovement(value: PurchaseValuationMovementReference | null) { movement = value; },
  };
}

function createInvoiceCommand(name = "create") {
  return {
    context: context(name),
    document: {
      scope,
      documentId: "invoice-001",
      companyId: "company-001",
      supplierId: "supplier-001",
      supplierSnapshot,
      documentType: "supplier-invoice" as const,
      businessDate: "2026-09-20",
      createdAt: "2026-09-20T12:00:00.000Z",
      lines: [{
        lineId: "invoice-line-001",
        position: 1,
        lineKind: "stock-product" as const,
        itemId: "product-001",
        itemSnapshot,
      }],
    },
    commercialTermsByLine: { "invoice-line-001": terms },
  };
}

async function confirmedInvoice(h: ReturnType<typeof createHarness>) {
  let invoice = await h.services.commands.create(createInvoiceCommand());
  invoice = await h.services.commands.submit({
    context: context("submit"), documentId: invoice.documentId, expectedVersion: invoice.version,
  });
  invoice = await h.services.commands.approve({
    context: context("approve"), documentId: invoice.documentId, expectedVersion: invoice.version,
  });
  invoice = await h.services.commands.confirm({
    context: context("confirm"), documentId: invoice.documentId, expectedVersion: invoice.version,
  });
  return invoice;
}

const receiptLine: PurchaseReceiptMatchingLineReference = {
  companyId: "company-001",
  documentId: "receipt-001",
  lineId: "receipt-line-001",
  documentType: "receipt",
  status: "confirmed",
  productId: "product-001",
  baseQuantity: "6",
};

const movement: PurchaseValuationMovementReference = {
  movementId: "movement-001",
  companyId: "company-001",
  documentId: "receipt-001",
  lineId: "receipt-line-001",
  stockKey: {
    companyId: "company-001",
    productId: "product-001",
    warehouseId: "warehouse-001",
    zoneId: null,
    locationId: null,
  },
  quantityDelta: "6",
};

test("create rejects Company and Branch scope mismatches before persistence", async () => {
  const h = createHarness();
  await assert.rejects(
    () => h.services.commands.create({
      ...createInvoiceCommand(),
      context: context("bad-company", { companyId: "other-company" }),
    }),
    (error: unknown) => error instanceof PurchaseApplicationError &&
      error.code === "PURCHASE_APP_SCOPE_MISMATCH" &&
      error.field === "document.companyId",
  );
  await assert.rejects(
    () => h.services.commands.create({
      ...createInvoiceCommand(),
      context: context("bad-branch", { branchId: "other-branch" }),
    }),
    (error: unknown) => error instanceof PurchaseApplicationError &&
      error.code === "PURCHASE_APP_SCOPE_MISMATCH" &&
      error.field === "document.scope.branchId",
  );
  assert.equal(h.documents.size, 0);
  assert.equal(h.events.includes("number:reserve"), false);
});

test("receipt staging rejects a command fingerprint different from its operation fingerprint", async () => {
  const h = createHarness();
  const invoice = await confirmedInvoice(h);
  const before = h.events.length;
  await assert.rejects(
    () => h.services.commands.stageInventoryReceipt({
      context: context("stage", { payloadFingerprint: "context-fingerprint" }),
      purchaseDocumentId: invoice.documentId,
      inventoryDocumentId: "receipt-draft-001",
      allocations: [{
        purchaseLineId: "invoice-line-001",
        baseQuantity: "6",
        warehouse: { warehouseId: "warehouse-001", zoneId: null, locationId: null },
      }],
      payloadFingerprint: "different-command-fingerprint",
    }),
    (error: unknown) => error instanceof PurchaseApplicationError &&
      error.code === "PURCHASE_APP_IDEMPOTENCY_CONFLICT" &&
      error.field === "payloadFingerprint",
  );
  assert.equal(h.events.slice(before).includes("inventory:stage"), false);
});

test("matching command validates the confirmed Inventory line and persists one durable match", async () => {
  const h = createHarness();
  const invoice = await confirmedInvoice(h);
  h.setReceiptLine(receiptLine);
  h.events.length = 0;

  const match = await h.services.commands.matchReceiptInvoice({
    context: context("match"),
    match: {
      matchId: "match-001",
      companyId: "company-001",
      invoiceDocumentId: invoice.documentId,
      invoiceLineId: "invoice-line-001",
      receiptDocumentId: receiptLine.documentId,
      receiptLineId: receiptLine.lineId,
      productId: "product-001",
      matchedBaseQuantity: "6",
    },
  });

  assert.equal(match.matchId, "match-001");
  assert.equal(match.matchedBaseQuantity, "6");
  assert.equal(h.matches.length, 1);
  assert.ok(h.events.includes("match:add"));
  assert.ok(h.events.includes("idempotency:add:match"));
});

test("matching command fails before Purchase persistence when the confirmed receipt line is missing", async () => {
  const h = createHarness();
  const invoice = await confirmedInvoice(h);
  h.events.length = 0;

  await assert.rejects(
    () => h.services.commands.matchReceiptInvoice({
      context: context("missing-receipt"),
      match: {
        matchId: "match-missing",
        companyId: "company-001",
        invoiceDocumentId: invoice.documentId,
        invoiceLineId: "invoice-line-001",
        receiptDocumentId: "receipt-missing",
        receiptLineId: "line-missing",
        productId: "product-001",
        matchedBaseQuantity: "1",
      },
    }),
    (error: unknown) => error instanceof PurchaseApplicationError &&
      error.code === "PURCHASE_APP_NOT_FOUND" &&
      error.field === "receiptLine",
  );
  assert.equal(h.matches.length, 0);
  assert.equal(h.events.includes("match:add"), false);
});

test("full receipt match resolves Cost Input and recalculates valuation only after Purchase cost commit", async () => {
  const h = createHarness();
  const invoice = await confirmedInvoice(h);
  h.setReceiptLine(receiptLine);
  await h.services.commands.matchReceiptInvoice({
    context: context("match-cost"),
    match: {
      matchId: "match-cost-001",
      companyId: "company-001",
      invoiceDocumentId: invoice.documentId,
      invoiceLineId: "invoice-line-001",
      receiptDocumentId: receiptLine.documentId,
      receiptLineId: receiptLine.lineId,
      productId: "product-001",
      matchedBaseQuantity: "6",
    },
  });
  h.setMovement(movement);
  h.events.length = 0;

  const decision = await h.services.commands.resolveMovementCost({
    context: context("resolve-cost"),
    movementId: movement.movementId,
    costInputId: "cost-input-001",
  });

  assert.equal(decision.status, "resolved");
  assert.equal(decision.costInput?.basis.baseCost, 600);
  assert.equal(decision.costInput?.basis.totalCost, 600);
  assert.equal(h.costInputs.get(movement.movementId)?.costInputId, "cost-input-001");
  const costCommit = h.events.indexOf("cost:add");
  const recalc = h.events.indexOf("valuation:recalculate");
  const replayRecord = h.events.indexOf("idempotency:add:cost-resolution");
  assert.ok(costCommit >= 0 && recalc > costCommit && replayRecord > recalc);
});

test("unmatched receipt cost remains unresolved and never triggers valuation recalculation", async () => {
  const h = createHarness();
  h.setMovement(movement);
  h.events.length = 0;

  const decision = await h.services.commands.resolveMovementCost({
    context: context("unresolved-cost"),
    movementId: movement.movementId,
    costInputId: "cost-input-unresolved",
  });

  assert.equal(decision.status, "unresolved");
  assert.equal(decision.reason, "awaiting-supplier-invoice");
  assert.equal(decision.costInput, null);
  assert.equal(h.costInputs.size, 0);
  assert.equal(h.events.includes("valuation:recalculate"), false);
  assert.ok(h.events.includes("idempotency:add:cost-resolution"));
});

test("query services return persisted documents, bounded lists and non-mutating cost previews", async () => {
  const h = createHarness();
  const invoice = await confirmedInvoice(h);
  h.setReceiptLine(receiptLine);
  await h.services.commands.matchReceiptInvoice({
    context: context("match-preview"),
    match: {
      matchId: "match-preview-001",
      companyId: "company-001",
      invoiceDocumentId: invoice.documentId,
      invoiceLineId: "invoice-line-001",
      receiptDocumentId: receiptLine.documentId,
      receiptLineId: receiptLine.lineId,
      productId: "product-001",
      matchedBaseQuantity: "6",
    },
  });
  h.setMovement(movement);
  h.events.length = 0;

  assert.equal((await h.services.queries.getDocument({
    companyId: "company-001",
    documentId: invoice.documentId,
  }))?.documentId, invoice.documentId);

  const list = await h.services.queries.listDocuments({
    companyId: "company-001",
    branchId: "branch-001",
    limit: 25,
    offset: 0,
  });
  assert.equal(list.length, 1);
  assert.ok(h.events.some(value => value.includes('"limit":25')));

  const preview = await h.services.queries.getReceiptCostDecision({
    companyId: "company-001",
    movementId: movement.movementId,
  });
  assert.equal(preview?.status, "resolved");
  assert.equal(preview?.costInput?.costInputId, "preview:movement-001");
  assert.equal(h.costInputs.size, 0);
  assert.equal(h.events.includes("valuation:recalculate"), false);
});


test("matching replay returns the stored match before reading the Inventory receipt again", async () => {
  const h = createHarness();
  const invoice = await confirmedInvoice(h);
  h.setReceiptLine(receiptLine);
  const command = {
    context: context("match-replay"),
    match: {
      matchId: "match-replay-001",
      companyId: "company-001",
      invoiceDocumentId: invoice.documentId,
      invoiceLineId: "invoice-line-001",
      receiptDocumentId: receiptLine.documentId,
      receiptLineId: receiptLine.lineId,
      productId: "product-001",
      matchedBaseQuantity: "6",
    },
  };

  const first = await h.services.commands.matchReceiptInvoice(command);
  h.setReceiptLine(null);
  const writesBeforeReplay = h.events.filter(value => value === "match:add").length;
  const replay = await h.services.commands.matchReceiptInvoice(command);

  assert.deepEqual(replay, first);
  assert.equal(h.matches.length, 1);
  assert.equal(h.events.filter(value => value === "match:add").length, writesBeforeReplay);
});

test("resolved Cost Input replay does not persist cost or trigger valuation recalculation twice", async () => {
  const h = createHarness();
  const invoice = await confirmedInvoice(h);
  h.setReceiptLine(receiptLine);
  await h.services.commands.matchReceiptInvoice({
    context: context("match-cost-replay"),
    match: {
      matchId: "match-cost-replay-001",
      companyId: "company-001",
      invoiceDocumentId: invoice.documentId,
      invoiceLineId: "invoice-line-001",
      receiptDocumentId: receiptLine.documentId,
      receiptLineId: receiptLine.lineId,
      productId: "product-001",
      matchedBaseQuantity: "6",
    },
  });
  h.setMovement(movement);
  const command = {
    context: context("resolve-cost-replay"),
    movementId: movement.movementId,
    costInputId: "cost-input-replay-001",
  };

  const first = await h.services.commands.resolveMovementCost(command);
  const recalcBeforeReplay = h.events.filter(value => value === "valuation:recalculate").length;
  const costWritesBeforeReplay = h.events.filter(value => value === "cost:add" || value === "cost:replace").length;
  h.setMovement(null);

  const replay = await h.services.commands.resolveMovementCost(command);

  assert.deepEqual(replay, first);
  assert.equal(h.events.filter(value => value === "valuation:recalculate").length, recalcBeforeReplay);
  assert.equal(
    h.events.filter(value => value === "cost:add" || value === "cost:replace").length,
    costWritesBeforeReplay,
  );
});
