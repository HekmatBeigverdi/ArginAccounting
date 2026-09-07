import assert from "node:assert/strict";
import test from "node:test";
import { createProduct, createProductMasterDataProfile, createProductUnitProfile } from "@argin/product";
import { createWarehouse, classifyWarehouse } from "@argin/warehouse";
import {
  INVENTORY_DOCUMENT_STATUSES,
  INVENTORY_DOMAIN_ERROR_CODES as codes,
  InventoryDomainError,
  approveInventoryDocument,
  assertInventoryDocumentEditable,
  cancelInventoryDocument,
  createInventoryDocument,
  createInventoryDocumentCorrection,
  createInventoryLineOperation,
  rehydrateInventoryDocument,
} from "../src/index.ts";
import type { InventoryDomainErrorCode } from "../src/index.ts";

const companyId = "company-1";
const createdAt = "2026-09-07T08:00:00Z";
const scope = { branchId: "branch-1", fiscalYearId: "fy-2026", fiscalPeriodId: "fp-09" };

const units = () => createProductUnitProfile({
  baseUnit: { unitId: "unit", code: "EA", title: "عدد", precision: 6, roundingMode: "half-up" },
  alternateUnits: [],
});

const product = () => ({
  ...createProduct({
    productId: "product-1",
    companyId,
    code: "P1",
    title: "کالا",
    kind: "product",
    createdAt,
  }),
  version: 1,
  units: units(),
  masterData: createProductMasterDataProfile({
    kind: "product",
    operational: { stockTracking: true },
  }),
});

const warehouse = classifyWarehouse({
  warehouse: createWarehouse({
    warehouseId: "warehouse-1",
    companyId,
    code: "W1",
    title: "انبار اصلی",
    createdAt,
  }),
  kind: "general",
});

const operation = () => createInventoryLineOperation({
  companyId,
  productId: "product-1",
  product: product(),
  enteredQuantity: "2",
  unitId: "unit",
  warehouse: { warehouseId: warehouse.warehouseId },
  resolvedWarehouse: { warehouse },
});

const readyDraft = () => createInventoryDocument({
  scope,
  documentId: "doc-1",
  companyId,
  documentType: "receipt",
  documentNumber: "000001",
  businessDate: "2026-09-07",
  lines: [{ lineId: "line-1", position: 1, productId: "product-1", operation: operation() }],
  createdAt,
});

function rejects(action: () => unknown, code: InventoryDomainErrorCode): void {
  assert.throws(action, (error: unknown) => error instanceof InventoryDomainError && error.code === code);
}

test("Step 5 exposes a closed lifecycle state set independent from future posting state", () => {
  assert.deepEqual(INVENTORY_DOCUMENT_STATUSES, ["draft", "approved", "cancelled"]);
  const draft = readyDraft();
  assert.equal(draft.status, "draft");
  assert.equal(draft.approvedAt, null);
  assert.equal(draft.approvedByUserId, null);
  assert.equal(draft.cancelledAt, null);
  assert.equal(draft.cancelledByUserId, null);
  assert.equal(draft.correctionOfDocumentId, null);
});

test("approves only a complete draft and persists actor/time/version evidence", () => {
  const draft = readyDraft();
  const approved = approveInventoryDocument(draft, {
    approvedAt: "2026-09-07T09:00:00Z",
    approvedByUserId: " user-approve ",
  });
  assert.equal(approved.status, "approved");
  assert.equal(approved.approvedAt, "2026-09-07T09:00:00.000Z");
  assert.equal(approved.approvedByUserId, "user-approve");
  assert.equal(approved.version, 2);
  assert.equal(approved.updatedAt, approved.approvedAt);
  assert.equal(Object.isFrozen(approved), true);
  assert.deepEqual(rehydrateInventoryDocument(JSON.parse(JSON.stringify(approved))), approved);
  assert.deepEqual(draft, readyDraft());
});

test("rejects confirmation of structurally incomplete drafts", () => {
  const incomplete = createInventoryDocument({
    documentId: "incomplete",
    companyId,
    documentType: "receipt",
    businessDate: "2026-09-07",
    createdAt,
  });
  rejects(() => approveInventoryDocument(incomplete, {
    approvedAt: "2026-09-07T09:00:00Z",
    approvedByUserId: "user-1",
  }), codes.approvalIncomplete);

  const missingOperation = createInventoryDocument({
    scope,
    documentId: "missing-operation",
    companyId,
    documentType: "receipt",
    documentNumber: "000002",
    businessDate: "2026-09-07",
    lines: [{ lineId: "line-1", position: 1, productId: "product-1" }],
    createdAt,
  });
  rejects(() => approveInventoryDocument(missingOperation, {
    approvedAt: "2026-09-07T09:00:00Z",
    approvedByUserId: "user-1",
  }), codes.approvalIncomplete);
});

test("approved and cancelled documents are immutable and invalid transitions are rejected", () => {
  const draft = readyDraft();
  const approved = approveInventoryDocument(draft, {
    approvedAt: "2026-09-07T09:00:00Z",
    approvedByUserId: "approver",
  });
  assert.equal(assertInventoryDocumentEditable(draft).status, "draft");
  rejects(() => assertInventoryDocumentEditable(approved), codes.documentImmutable);
  rejects(() => approveInventoryDocument(approved, {
    approvedAt: "2026-09-07T10:00:00Z",
    approvedByUserId: "other",
  }), codes.lifecycleTransitionInvalid);
  rejects(() => cancelInventoryDocument(draft, {
    cancelledAt: "2026-09-07T10:00:00Z",
    cancelledByUserId: "canceller",
  }), codes.lifecycleTransitionInvalid);

  const cancelled = cancelInventoryDocument(approved, {
    cancelledAt: "2026-09-07T10:00:00Z",
    cancelledByUserId: "canceller",
  });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.approvedByUserId, "approver");
  assert.equal(cancelled.cancelledByUserId, "canceller");
  assert.equal(cancelled.version, 3);
  assert.equal(cancelled.updatedAt, "2026-09-07T10:00:00.000Z");
  rejects(() => assertInventoryDocumentEditable(cancelled), codes.documentImmutable);
  rejects(() => cancelInventoryDocument(cancelled, {
    cancelledAt: "2026-09-07T11:00:00Z",
    cancelledByUserId: "again",
  }), codes.lifecycleTransitionInvalid);
});

test("correction never rewrites an approved document and links a new draft by durable ID", () => {
  const original = approveInventoryDocument(readyDraft(), {
    approvedAt: "2026-09-07T09:00:00Z",
    approvedByUserId: "approver",
  });
  const correction = createInventoryDocumentCorrection(original, {
    scope,
    documentId: "doc-2",
    documentNumber: "000002",
    businessDate: "2026-09-07",
    description: "اصلاح سند اولیه",
    lines: [{ lineId: "line-2", position: 1, productId: "product-1", operation: operation() }],
    createdAt: "2026-09-07T10:00:00Z",
  });

  assert.equal(original.status, "approved");
  assert.equal(original.correctionOfDocumentId, null);
  assert.equal(correction.status, "draft");
  assert.equal(correction.documentId, "doc-2");
  assert.equal(correction.companyId, original.companyId);
  assert.equal(correction.documentType, original.documentType);
  assert.equal(correction.correctionOfDocumentId, original.documentId);
  assert.equal(correction.version, 1);
  assert.equal(correction.approvedAt, null);
  assert.equal(Object.isFrozen(correction), true);
});

test("correction requires an approved original and a distinct durable identity", () => {
  const draft = readyDraft();
  const correctionInput = {
    scope,
    documentId: "doc-2",
    businessDate: "2026-09-07",
    createdAt: "2026-09-07T10:00:00Z",
  };
  rejects(() => createInventoryDocumentCorrection(draft, correctionInput), codes.correctionOriginalInvalid);

  const approved = approveInventoryDocument(draft, {
    approvedAt: "2026-09-07T09:00:00Z",
    approvedByUserId: "approver",
  });
  rejects(() => createInventoryDocumentCorrection(approved, {
    ...correctionInput,
    documentId: approved.documentId,
  }), codes.correctionSelfReference);

  const cancelled = cancelInventoryDocument(approved, {
    cancelledAt: "2026-09-07T10:00:00Z",
    cancelledByUserId: "canceller",
  });
  rejects(() => createInventoryDocumentCorrection(cancelled, {
    ...correctionInput,
    createdAt: "2026-09-07T11:00:00Z",
  }), codes.correctionOriginalInvalid);
});

test("lifecycle timestamps cannot travel backwards and tampered persisted metadata is rejected", () => {
  const draft = readyDraft();
  rejects(() => approveInventoryDocument(draft, {
    approvedAt: "2026-09-07T07:59:59Z",
    approvedByUserId: "approver",
  }), codes.timestampOrderInvalid);

  const editedDraft = rehydrateInventoryDocument({
    ...draft,
    version: 2,
    updatedAt: "2026-09-07T09:30:00Z",
  });
  rejects(() => approveInventoryDocument(editedDraft, {
    approvedAt: "2026-09-07T09:00:00Z",
    approvedByUserId: "approver",
  }), codes.timestampOrderInvalid);

  const approved = approveInventoryDocument(draft, {
    approvedAt: "2026-09-07T09:00:00Z",
    approvedByUserId: "approver",
  });
  rejects(() => cancelInventoryDocument(approved, {
    cancelledAt: "2026-09-07T08:59:59Z",
    cancelledByUserId: "canceller",
  }), codes.timestampOrderInvalid);
  rejects(() => rehydrateInventoryDocument({
    ...draft,
    approvedAt: "2026-09-07T09:00:00Z",
  }), codes.lifecycleMetadataInvalid);
  rejects(() => rehydrateInventoryDocument({
    ...approved,
    correctionOfDocumentId: approved.documentId,
  }), codes.correctionSelfReference);
});
