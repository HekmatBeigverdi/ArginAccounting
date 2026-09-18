import assert from "node:assert/strict";
import test from "node:test";

import {
  PurchaseApplicationError,
  SecuredPurchaseService,
  purchasePermissions,
  type PurchaseApplicationServices,
  type PurchaseDocumentSnapshot,
} from "../src/index.ts";

const document = Object.freeze({
  scope: {
    companyId: "company-1", branchId: "branch-1", fiscalYearId: "fy-1", fiscalPeriodId: "fp-1",
    fiscalYearStartDate: "2026-03-21", fiscalYearEndDate: "2027-03-20",
    fiscalPeriodStartDate: "2026-08-23", fiscalPeriodEndDate: "2026-09-22",
    fiscalYearStatus: "open", fiscalPeriodStatus: "open", lockedThroughDate: null,
  },
  documentId: "purchase-1",
  companyId: "company-1",
  supplierId: "supplier-1",
  supplierSnapshot: {
    companyId: "company-1", supplierId: "supplier-1", code: "SUP-1", displayName: "Supplier",
    classification: "legal-entity", nationalCode: null, nationalId: "10101234567",
    economicNumber: null, taxFileNumber: null,
  },
  documentType: "supplier-invoice",
  status: "submitted",
  lifecycleHistory: Object.freeze([{
    fromStatus: "draft", toStatus: "submitted",
    occurredAt: "2026-09-18T10:00:00.000Z", actorUserId: "user-1",
    reason: null, relatedDocumentId: null,
  }]),
  documentNumber: "PINV-1",
  businessDate: "2026-09-18",
  description: null,
  sourceReference: null,
  correctionReference: null,
  lines: Object.freeze([]),
  version: 2,
  createdAt: "2026-09-18T09:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
}) satisfies PurchaseDocumentSnapshot;

const operation = (name: string) => ({
  companyId: "company-1",
  branchId: "branch-1",
  requestId: `request-${name}`,
  operationId: `operation-${name}`,
  payloadFingerprint: `fingerprint-${name}`,
  actorUserId: "user-1",
  occurredAt: "2026-09-18T10:30:00.000Z",
});

function harness(overrides: {
  authorizationDenied?: boolean;
  approvalDenied?: boolean;
} = {}) {
  const calls: string[] = [];
  const docs = new Map<string, PurchaseDocumentSnapshot>([[document.documentId, document]]);
  const application = {
    commands: {
      async create(command: any) { calls.push("app:create"); return command.document; },
      async submit() { calls.push("app:submit"); return document; },
      async approve() { calls.push("app:approve"); return Object.freeze({ ...document, status: "approved", version: 3 }); },
      async confirm() { calls.push("app:confirm"); return Object.freeze({ ...document, status: "confirmed", version: 4 }); },
      async cancel() { calls.push("app:cancel"); return Object.freeze({ ...document, status: "cancelled", version: 3 }); },
      async reopen() { calls.push("app:reopen"); return Object.freeze({ ...document, status: "draft", version: 3 }); },
      async returnPurchase() { calls.push("app:return"); return Object.freeze({ ...document, status: "returned", version: 3 }); },
      async correct() { calls.push("app:correct"); return Object.freeze({ ...document, status: "corrected", version: 3 }); },
      async stageInventoryReceipt() { calls.push("app:stage"); return { inventoryDocumentId: "receipt-1", status: "draft", version: 1 }; },
      async matchReceiptInvoice(command: any) { calls.push("app:match"); return command.match; },
      async resolveMovementCost() { calls.push("app:cost"); return { status: "unresolved", reason: "awaiting-supplier-invoice", movementBaseQuantity: "1", matchedBaseQuantity: "0", remainingBaseQuantity: "1", costInput: null, blocksInventoryConfirmation: false, requiresRecalculation: true, recalculationReason: "cost_basis_changed" }; },
    },
    queries: {
      async getDocument(query: any) { return docs.get(query.documentId) ?? null; },
      async listDocuments() { return [...docs.values()]; },
      async getReceiptCostDecision() { throw new Error("unused"); },
    },
  } as unknown as PurchaseApplicationServices;

  const service = new SecuredPurchaseService({
    application,
    documents: { async findById(_companyId: string, documentId: string) { return docs.get(documentId) ?? null; } },
    authorization: {
      async require(context, permission) {
        calls.push(`auth:${permission}:${context.branchId}`);
        if (overrides.authorizationDenied) throw new Error("denied");
      },
    },
    approval: {
      async submit(input) { calls.push(`approval:submit:${input.approvalCycleKey}`); return { requestId: "approval-1", status: "pending" }; },
      async approve(input) { calls.push(`approval:approve:${input.approvalCycleKey}`); return { requestId: "approval-1", status: "approved" }; },
      async requireApproved(_companyId, _documentId, approvalCycleKey) {
        calls.push(`approval:require:${approvalCycleKey}`);
        if (overrides.approvalDenied) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "approval");
      },
    },
    audit: { async record(event) { calls.push(`audit:${event.action}:${event.operationId}`); } },
  });

  return { service, calls };
}

test("Purchase permissions are independently assignable", () => {
  assert.equal(new Set(Object.values(purchasePermissions)).size, Object.values(purchasePermissions).length);
  assert.equal(purchasePermissions.approve, "purchases.documents.approve");
  assert.notEqual(purchasePermissions.approve, purchasePermissions.confirm);
  assert.notEqual(purchasePermissions.return, purchasePermissions.correct);
});

test("authorization uses persisted Company and Branch before mutation", async () => {
  const h = harness({ authorizationDenied: true });
  await assert.rejects(
    () => h.service.confirm({ actorId: "user-1" }, {
      context: operation("confirm"), documentId: "purchase-1", expectedVersion: 2,
    }),
    (error: unknown) =>
      error instanceof PurchaseApplicationError &&
      error.code === "PURCHASE_APP_UNAUTHORIZED",
  );
  assert.equal(h.calls.some(item => item === "app:confirm"), false);
  assert.equal(h.calls[0], "auth:purchases.documents.confirm:branch-1");
});

test("confirmation requires the approved current submission cycle before mutation", async () => {
  const approved = Object.freeze({
    ...document,
    status: "approved" as const,
    version: 3,
    lifecycleHistory: Object.freeze([
      ...document.lifecycleHistory,
      { fromStatus: "submitted" as const, toStatus: "approved" as const, occurredAt: "2026-09-18T10:15:00.000Z", actorUserId: "user-2", reason: null, relatedDocumentId: null },
    ]),
  });
  const h = harness({ approvalDenied: true });
  (h.service as any).deps.documents.findById = async () => approved;

  await assert.rejects(() => h.service.confirm({ actorId: "user-1" }, {
    context: operation("confirm"), documentId: "purchase-1", expectedVersion: 3,
  }), /PURCHASE_APP_INPUT_INVALID:approval/u);

  assert.equal(h.calls.some(item => item === "app:confirm"), false);
  assert.ok(h.calls.includes("approval:require:2026-09-18T10:00:00.000Z"));
});

test("approve uses the same latest submission cycle and records audit after successful Purchase mutation", async () => {
  const h = harness();
  await h.service.approve({ actorId: "user-2", actorDisplayName: "Approver" }, {
    context: { ...operation("approve"), actorUserId: "user-2" },
    documentId: "purchase-1",
    expectedVersion: 2,
    reason: "ok",
  });

  assert.deepEqual(h.calls, [
    "auth:purchases.documents.approve:branch-1",
    "approval:approve:2026-09-18T10:00:00.000Z",
    "app:approve",
    "audit:purchase.document.approve:operation-approve",
  ]);
});

test("submit creates or repairs shared Approval after Purchase submit and audit keeps request/operation trace", async () => {
  const draft = Object.freeze({ ...document, status: "draft" as const, version: 1, lifecycleHistory: Object.freeze([]) });
  const submitted = document;
  const h = harness();
  (h.service as any).deps.documents.findById = async () => draft;
  (h.service as any).deps.application.commands.submit = async () => { h.calls.push("app:submit"); return submitted; };

  await h.service.submit({ actorId: "user-1" }, {
    context: operation("submit"), documentId: "purchase-1", expectedVersion: 1,
  });

  assert.deepEqual(h.calls, [
    "auth:purchases.documents.submit:branch-1",
    "app:submit",
    "approval:submit:2026-09-18T10:00:00.000Z",
    "audit:purchase.document.submit:operation-submit",
  ]);
});

test("resubmission after reopen creates a distinct approval cycle", async () => {
  const resubmitted = Object.freeze({
    ...document,
    version: 5,
    lifecycleHistory: Object.freeze([
      ...document.lifecycleHistory,
      { fromStatus: "submitted" as const, toStatus: "approved" as const, occurredAt: "2026-09-18T10:15:00.000Z", actorUserId: "user-2", reason: null, relatedDocumentId: null },
      { fromStatus: "approved" as const, toStatus: "draft" as const, occurredAt: "2026-09-18T11:00:00.000Z", actorUserId: "user-1", reason: "edit", relatedDocumentId: null },
      { fromStatus: "draft" as const, toStatus: "submitted" as const, occurredAt: "2026-09-18T12:00:00.000Z", actorUserId: "user-1", reason: null, relatedDocumentId: null },
    ]),
    updatedAt: "2026-09-18T12:00:00.000Z",
  });
  const h = harness();
  (h.service as any).deps.application.commands.submit = async () => { h.calls.push("app:submit"); return resubmitted; };

  await h.service.submit({ actorId: "user-1" }, {
    context: { ...operation("resubmit"), occurredAt: "2026-09-18T12:00:00.000Z" },
    documentId: "purchase-1",
    expectedVersion: 4,
  });

  assert.ok(h.calls.includes("approval:submit:2026-09-18T12:00:00.000Z"));
});

test("successful return/correction audit retains related document trace", async () => {
  const h = harness();
  await h.service.returnPurchase({ actorId: "user-1" }, {
    context: operation("return"),
    documentId: "purchase-1",
    expectedVersion: 2,
    relatedDocumentId: "return-1",
    reason: "supplier return",
  });
  assert.ok(h.calls.includes("audit:purchase.document.return:operation-return"));
});
