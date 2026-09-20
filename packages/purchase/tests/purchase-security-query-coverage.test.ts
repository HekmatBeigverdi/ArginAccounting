import assert from "node:assert/strict";
import test from "node:test";

import {
  PurchaseApplicationError,
  SecuredPurchaseService,
  purchasePermissions,
  type PurchaseApplicationServices,
  type PurchaseDocumentSnapshot,
} from "../src/index.ts";

const makeDocument = (branchId: string): PurchaseDocumentSnapshot => ({
  scope: {
    companyId: "company-1",
    branchId,
    fiscalYearId: "fy-1",
    fiscalPeriodId: "fp-1",
    fiscalYearStartDate: "2026-03-21",
    fiscalYearEndDate: "2027-03-20",
    fiscalPeriodStartDate: "2026-08-23",
    fiscalPeriodEndDate: "2026-09-22",
    fiscalYearStatus: "open",
    fiscalPeriodStatus: "open",
    lockedThroughDate: null,
  },
  documentId: "purchase-1",
  companyId: "company-1",
  supplierId: "supplier-1",
  supplierSnapshot: {
    companyId: "company-1",
    supplierId: "supplier-1",
    code: "SUP-1",
    displayName: "Supplier",
    classification: "legal-entity",
    nationalCode: null,
    nationalId: "10101234567",
    economicNumber: null,
    taxFileNumber: null,
  },
  documentType: "supplier-invoice",
  status: "confirmed",
  lifecycleHistory: [],
  documentNumber: "PINV-1",
  businessDate: "2026-09-20",
  description: null,
  sourceReference: null,
  correctionReference: null,
  lines: [],
  version: 4,
  createdAt: "2026-09-20T08:00:00.000Z",
  updatedAt: "2026-09-20T09:00:00.000Z",
});

function harness(input: {
  document?: PurchaseDocumentSnapshot | null;
  denyPermission?: string | null;
} = {}) {
  const document = input.document === undefined ? makeDocument("branch-1") : input.document;
  const calls: string[] = [];
  let lastListQuery: any = null;

  const application = {
    commands: {
      async create(command: any) { return command.document; },
      async edit() { throw new Error("unused"); },
      async submit() { throw new Error("unused"); },
      async approve() { throw new Error("unused"); },
      async confirm() { throw new Error("unused"); },
      async cancel() { throw new Error("unused"); },
      async reopen() { throw new Error("unused"); },
      async returnPurchase() { throw new Error("unused"); },
      async correct() { throw new Error("unused"); },
      async stageInventoryReceipt() {
        calls.push("app:stage");
        return { inventoryDocumentId: "receipt-1", status: "draft", version: 1 };
      },
      async matchReceiptInvoice(command: any) {
        calls.push("app:match");
        return command.match;
      },
      async resolveMovementCost() {
        calls.push("app:cost");
        return {
          status: "unresolved",
          reason: "awaiting-supplier-invoice",
          movementBaseQuantity: "1",
          matchedBaseQuantity: "0",
          remainingBaseQuantity: "1",
          costInput: null,
          blocksInventoryConfirmation: false,
          requiresRecalculation: true,
          recalculationReason: "cost_basis_changed",
        };
      },
    },
    queries: {
      async getDocument() { calls.push("query:get"); return document; },
      async listDocuments(query: any) {
        calls.push("query:list");
        lastListQuery = query;
        return document ? [document] : [];
      },
      async getReceiptCostDecision() {
        calls.push("query:cost");
        return null;
      },
    },
  } as unknown as PurchaseApplicationServices;

  const service = new SecuredPurchaseService({
    application,
    documents: {
      async findById() { return document; },
    },
    authorization: {
      async require(context, permission) {
        calls.push("auth:" + permission + ":" + context.branchId);
        if (input.denyPermission === permission) throw new Error("denied");
      },
    },
    approval: {
      async submit() { return { requestId: "approval-1", status: "pending" }; },
      async approve() { return { requestId: "approval-1", status: "approved" }; },
      async requireApproved() {},
    },
    audit: {
      async record(event) {
        calls.push("audit:" + event.action);
      },
    },
  });

  return {
    service,
    calls,
    get lastListQuery() { return lastListQuery; },
  };
}

const security = { actorId: "user-1", actorDisplayName: "User" };
const operation = { requestId: "request-1", operationId: "operation-1", branchId: "branch-1" };

test("getDocument rechecks persisted Branch visibility when the result belongs to another Branch", async () => {
  const h = harness({ document: makeDocument("branch-2") });
  const result = await h.service.getDocument(security, operation, {
    companyId: "company-1",
    documentId: "purchase-1",
  });

  assert.equal(result?.scope.branchId, "branch-2");
  assert.deepEqual(h.calls, [
    "auth:purchases.documents.view:branch-1",
    "query:get",
    "auth:purchases.documents.view:branch-2",
  ]);
});

test("listDocuments defaults to the active Branch and passes that scope to Application", async () => {
  const h = harness();
  await h.service.listDocuments(security, operation, {
    companyId: "company-1",
    branchId: null,
    limit: 25,
    offset: 0,
  });

  assert.equal(h.lastListQuery.branchId, "branch-1");
  assert.deepEqual(h.calls.slice(0, 2), [
    "auth:purchases.documents.view:branch-1",
    "query:list",
  ]);
});

test("cost decision query requires Purchase view permission before Application read", async () => {
  const h = harness({ denyPermission: purchasePermissions.view });
  await assert.rejects(
    () => h.service.getReceiptCostDecision(security, operation, {
      companyId: "company-1",
      movementId: "movement-1",
    }),
    (error: unknown) =>
      error instanceof PurchaseApplicationError &&
      error.code === "PURCHASE_APP_UNAUTHORIZED",
  );
  assert.equal(h.calls.includes("query:cost"), false);
});

test("Inventory staging uses its dedicated permission and emits audit only after success", async () => {
  const h = harness();
  const result = await h.service.stageInventoryReceipt(security, {
    context: {
      companyId: "company-1",
      branchId: "branch-1",
      requestId: "request-stage",
      operationId: "operation-stage",
      payloadFingerprint: "fingerprint-stage",
      actorUserId: "user-1",
      occurredAt: "2026-09-20T10:00:00.000Z",
    },
    purchaseDocumentId: "purchase-1",
    inventoryDocumentId: "receipt-1",
    allocations: [],
    payloadFingerprint: "fingerprint-stage",
  });

  assert.equal(result.inventoryDocumentId, "receipt-1");
  assert.deepEqual(h.calls, [
    "auth:" + purchasePermissions.stageReceipt + ":branch-1",
    "app:stage",
    "audit:purchase.inventory-receipt.stage",
  ]);
});

test("matching and cost resolution keep their dedicated permissions and audit actions", async () => {
  const matching = harness();
  await matching.service.matchReceiptInvoice(security, {
    context: {
      companyId: "company-1",
      branchId: "branch-1",
      requestId: "request-match",
      operationId: "operation-match",
      payloadFingerprint: "fingerprint-match",
      actorUserId: "user-1",
      occurredAt: "2026-09-20T10:00:00.000Z",
    },
    match: {
      matchId: "match-1",
      companyId: "company-1",
      invoiceDocumentId: "purchase-1",
      invoiceLineId: "line-1",
      receiptDocumentId: "receipt-1",
      receiptLineId: "receipt-line-1",
      productId: "product-1",
      matchedBaseQuantity: "1",
    },
  });
  assert.deepEqual(matching.calls, [
    "auth:" + purchasePermissions.manageMatching + ":branch-1",
    "app:match",
    "audit:purchase.match.create",
  ]);

  const cost = harness();
  await cost.service.resolveMovementCost(security, {
    context: {
      companyId: "company-1",
      branchId: "branch-1",
      requestId: "request-cost",
      operationId: "operation-cost",
      payloadFingerprint: "fingerprint-cost",
      actorUserId: "user-1",
      occurredAt: "2026-09-20T10:00:00.000Z",
    },
    movementId: "movement-1",
    costInputId: "cost-1",
  });
  assert.deepEqual(cost.calls, [
    "auth:" + purchasePermissions.resolveCost + ":branch-1",
    "app:cost",
    "audit:purchase.cost.resolve",
  ]);
});
