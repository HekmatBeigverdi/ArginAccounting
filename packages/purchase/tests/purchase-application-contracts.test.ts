import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchaseOperationContext,
  normalizePurchaseDocumentListQuery,
  type PurchaseDocumentRepository,
  type PurchaseCommercialFactRepository,
  type PurchaseReceiptInvoiceMatchRepository,
  type PurchaseValuationCostInputRepository,
  type PurchaseUnitOfWork,
} from "../src/index.ts";

const context = createPurchaseOperationContext({
  companyId: "company-001",
  branchId: "branch-001",
  requestId: "request-001",
  operationId: "operation-001",
  actorUserId: "user-001",
  occurredAt: "2026-09-17T06:30:00+00:00",
});

test("normalizes a durable Purchase operation context", () => {
  assert.deepEqual(context, {
    companyId: "company-001",
    branchId: "branch-001",
    requestId: "request-001",
    operationId: "operation-001",
    actorUserId: "user-001",
    occurredAt: "2026-09-17T06:30:00.000Z",
  });
  assert.ok(Object.isFrozen(context));
});

test("normalizes document list query scope and pagination", () => {
  assert.deepEqual(normalizePurchaseDocumentListQuery({
    companyId: " company-001 ",
    branchId: " branch-001 ",
    supplierId: " supplier-001 ",
    documentType: "supplier-invoice",
    status: "confirmed",
    fromBusinessDate: "2026-09-01",
    toBusinessDate: "2026-09-30",
    limit: 50,
    offset: 10,
  }), {
    companyId: "company-001",
    branchId: "branch-001",
    supplierId: "supplier-001",
    documentType: "supplier-invoice",
    status: "confirmed",
    fromBusinessDate: "2026-09-01",
    toBusinessDate: "2026-09-30",
    limit: 50,
    offset: 10,
  });
});

test("repository and UoW contracts compose without persistence assumptions", async () => {
  const documents: PurchaseDocumentRepository = {
    findById: async () => null,
    findByNumber: async () => null,
    list: async () => [],
    add: async () => undefined,
    update: async () => undefined,
  };
  const commercialFacts: PurchaseCommercialFactRepository = {
    findByLine: async () => null,
    listByDocument: async () => [],
    addBatch: async () => undefined,
    replaceBatch: async () => undefined,
  };
  const matches: PurchaseReceiptInvoiceMatchRepository = {
    findById: async () => null,
    listByInvoiceLine: async () => [],
    listByReceiptLine: async () => [],
    add: async () => undefined,
  };
  const costInputs: PurchaseValuationCostInputRepository = {
    findByMovement: async () => null,
    listUnresolvedByCompany: async () => [],
    add: async () => undefined,
    replaceForMovement: async () => undefined,
  };
  const uow: PurchaseUnitOfWork = {
    execute: async work => work({ documents, commercialFacts, matches, costInputs }),
  };

  const result = await uow.execute(async repositories => ({
    document: await repositories.documents.findById("company-001", "purchase-001"),
    facts: await repositories.commercialFacts.listByDocument("company-001", "purchase-001"),
  }));
  assert.deepEqual(result, { document: null, facts: [] });
});
