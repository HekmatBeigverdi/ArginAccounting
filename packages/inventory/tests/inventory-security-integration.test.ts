import assert from "node:assert/strict";
import test from "node:test";
import {
  InventoryApplicationError,
  SecuredInventoryService,
  inventoryPermissions,
  type InventoryApplicationService,
  type InventoryDocumentSnapshot,
} from "../src/index.ts";

const document: InventoryDocumentSnapshot = Object.freeze({
  documentId: "doc-1", companyId: "company-1", documentType: "receipt", status: "approved",
  lifecycleHistory: Object.freeze([]), documentNumber: "R-1", businessDate: "2026-09-08",
  description: null, sourceReference: null, lines: Object.freeze([]), version: 3,
  createdAt: "2026-09-08T08:00:00.000Z", updatedAt: "2026-09-08T09:00:00.000Z",
  scope: { branchId: "branch-1", destinationBranchId: null, fiscalYearId: "fy-1", fiscalPeriodId: "fp-1" },
});

const confirmCommand = {
  companyId: "company-1", documentId: "doc-1", requestKey: "req-1", payloadFingerprint: "fp-1",
  expectedVersion: 3, action: { actorUserId: "user-1", occurredAt: "2026-09-08T10:00:00.000Z" },
} as const;

const submitCommand = {
  companyId: "company-1", documentId: "doc-1", requestKey: "req-submit", payloadFingerprint: "fp-submit",
  expectedVersion: 3, action: { actorUserId: "user-1", occurredAt: "2026-09-08T10:00:00.000Z" },
} as const;

test("inventory permissions remain independently assignable", () => {
  assert.equal(new Set(Object.values(inventoryPermissions)).size, 10);
  assert.equal(inventoryPermissions.approve, "inventory.documents.approve");
  assert.notEqual(inventoryPermissions.approve, inventoryPermissions.confirm);
  assert.notEqual(inventoryPermissions.import, inventoryPermissions.export);
});

test("authorization is evaluated against the persisted document Branch before mutation", async () => {
  let mutated = false;
  const service = new SecuredInventoryService({
    application: { async confirm() { mutated = true; return { documentId: "doc-1", status: "confirmed", version: 4, replayed: false }; } } as unknown as InventoryApplicationService,
    documents: { async findById() { return document; } },
    authorization: { async require(context, permission) {
      assert.equal(context.branchId, "branch-1");
      assert.equal(permission, inventoryPermissions.confirm);
      throw new Error("denied");
    } },
    approval: { async submit() { throw new Error("unused"); }, async approve() { throw new Error("unused"); }, async requireApproved() {} },
    audit: { async record() {} },
  });
  await assert.rejects(() => service.confirm({ actorId: "user-1" }, confirmCommand),
    (error: unknown) => error instanceof InventoryApplicationError && error.code === "inventory.application.unauthorized");
  assert.equal(mutated, false);
});

test("confirmation requires shared approval before stock mutation", async () => {
  let mutated = false;
  const service = new SecuredInventoryService({
    application: { async confirm() { mutated = true; return { documentId: "doc-1", status: "confirmed", version: 4, replayed: false }; } } as unknown as InventoryApplicationService,
    documents: { async findById() { return document; } },
    authorization: { async require() {} },
    approval: {
      async submit() { throw new Error("unused"); }, async approve() { throw new Error("unused"); },
      async requireApproved() { throw new InventoryApplicationError("inventory.application.invalid-request", "approval"); },
    },
    audit: { async record() {} },
  });
  await assert.rejects(() => service.confirm({ actorId: "user-1" }, confirmCommand), /inventory\.application\.invalid-request/u);
  assert.equal(mutated, false);
});

test("successful replay does not emit a duplicate Inventory audit event", async () => {
  let auditCount = 0;
  const service = new SecuredInventoryService({
    application: { async confirm() { return { documentId: "doc-1", status: "confirmed", version: 4, replayed: true }; } } as unknown as InventoryApplicationService,
    documents: { async findById() { return document; } },
    authorization: { async require() {} },
    approval: { async submit() { throw new Error("unused"); }, async approve() { throw new Error("unused"); }, async requireApproved() {} },
    audit: { async record() { auditCount += 1; } },
  });
  const result = await service.confirm({ actorId: "user-1" }, confirmCommand);
  assert.equal(result.replayed, true);
  assert.equal(auditCount, 0);
});

test("submit replay still repairs or verifies the shared Approval request", async () => {
  let approvalSubmitCount = 0;
  let auditCount = 0;
  const service = new SecuredInventoryService({
    application: { async submit() { return { documentId: "doc-1", status: "submitted", version: 4, replayed: true }; } } as unknown as InventoryApplicationService,
    documents: { async findById() { return Object.freeze({ ...document, status: "submitted" as const }); } },
    authorization: { async require() {} },
    approval: {
      async submit() { approvalSubmitCount += 1; return { requestId: "approval-1", status: "pending" }; },
      async approve() { throw new Error("unused"); }, async requireApproved() {},
    },
    audit: { async record() { auditCount += 1; } },
  });
  const result = await service.submit({ actorId: "user-1" }, submitCommand);
  assert.equal(result.replayed, true);
  assert.equal(approvalSubmitCount, 1);
  assert.equal(auditCount, 0);
});
