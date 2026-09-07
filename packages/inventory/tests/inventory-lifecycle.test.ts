import assert from "node:assert/strict";
import test from "node:test";
import { createProduct, createProductMasterDataProfile, createProductUnitProfile } from "@argin/product";
import { createWarehouse, classifyWarehouse } from "@argin/warehouse";
import {
  INVENTORY_DOCUMENT_STATUSES,
  INVENTORY_DOCUMENT_TRANSITIONS,
  INVENTORY_DOMAIN_ERROR_CODES as codes,
  InventoryDomainError,
  approveInventoryDocument,
  assertInventoryDocumentDeletable,
  assertInventoryDocumentEditable,
  canTransitionInventoryDocument,
  cancelInventoryDocument,
  confirmInventoryDocument,
  createInventoryDocument,
  createInventoryLineOperation,
  rehydrateInventoryDocument,
  returnInventoryDocumentToDraft,
  reverseInventoryDocument,
  submitInventoryDocument,
} from "../src/index.ts";
import type { InventoryDocumentStatus, InventoryDomainErrorCode } from "../src/index.ts";

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
  masterData: createProductMasterDataProfile({ kind: "product", operational: { stockTracking: true } }),
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

const action = (hour: number, reason?: string) => ({
  occurredAt: `2026-09-07T${String(hour).padStart(2, "0")}:00:00Z`,
  actorUserId: `user-${hour}`,
  ...(reason === undefined ? {} : { reason }),
});

test("Step 5 freezes all six states and the explicit transition matrix", () => {
  assert.deepEqual(INVENTORY_DOCUMENT_STATUSES, ["draft", "submitted", "approved", "confirmed", "cancelled", "reversed"]);
  assert.deepEqual(INVENTORY_DOCUMENT_TRANSITIONS, {
    draft: ["submitted", "cancelled"],
    submitted: ["draft", "approved", "cancelled"],
    approved: ["draft", "confirmed", "cancelled"],
    confirmed: ["reversed"],
    cancelled: [],
    reversed: [],
  });

  const expected = new Set([
    "draft->submitted", "draft->cancelled",
    "submitted->draft", "submitted->approved", "submitted->cancelled",
    "approved->draft", "approved->confirmed", "approved->cancelled",
    "confirmed->reversed",
  ]);
  for (const from of INVENTORY_DOCUMENT_STATUSES) {
    for (const to of INVENTORY_DOCUMENT_STATUSES) {
      assert.equal(canTransitionInventoryDocument(from, to), expected.has(`${from}->${to}`));
    }
  }
});

test("submission requires a complete numbered scoped document with operational lines", () => {
  const incomplete = createInventoryDocument({
    documentId: "incomplete",
    companyId,
    documentType: "receipt",
    businessDate: "2026-09-07",
    createdAt,
  });
  rejects(() => submitInventoryDocument(incomplete, action(9)), codes.submissionIncomplete);

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
  rejects(() => submitInventoryDocument(missingOperation, action(9)), codes.submissionIncomplete);
});

test("happy path keeps submit, approval and confirmation as distinct immutable transitions", () => {
  const draft = readyDraft();
  const submitted = submitInventoryDocument(draft, action(9));
  const approved = approveInventoryDocument(submitted, action(10));
  const confirmed = confirmInventoryDocument(approved, action(11));

  assert.deepEqual([draft.status, submitted.status, approved.status, confirmed.status], ["draft", "submitted", "approved", "confirmed"]);
  assert.deepEqual([draft.version, submitted.version, approved.version, confirmed.version], [1, 2, 3, 4]);
  assert.equal(draft.lifecycleHistory.length, 0);
  assert.equal(approved.lifecycleHistory.length, 2);
  assert.equal(confirmed.lifecycleHistory.length, 3);
  assert.deepEqual(confirmed.lifecycleHistory.map(item => `${item.fromStatus}->${item.toStatus}`), [
    "draft->submitted",
    "submitted->approved",
    "approved->confirmed",
  ]);
  assert.equal(confirmed.lifecycleHistory[2]?.actorUserId, "user-11");
  assert.equal(confirmed.updatedAt, "2026-09-07T11:00:00.000Z");
  assert.deepEqual(rehydrateInventoryDocument(JSON.parse(JSON.stringify(confirmed))), confirmed);
  assert.deepEqual(draft, readyDraft());
});

test("approval alone never makes a document confirmed and confirmation cannot bypass approval", () => {
  const submitted = submitInventoryDocument(readyDraft(), action(9));
  const approved = approveInventoryDocument(submitted, action(10));
  assert.equal(approved.status, "approved");
  assert.notEqual(approved.status as InventoryDocumentStatus, "confirmed");
  rejects(() => confirmInventoryDocument(submitted, action(10)), codes.lifecycleTransitionInvalid);
  rejects(() => approveInventoryDocument(readyDraft(), action(9)), codes.lifecycleTransitionInvalid);
});

test("approval-relevant editing explicitly invalidates approval before Draft becomes editable", () => {
  const submitted = submitInventoryDocument(readyDraft(), action(9));
  const approved = approveInventoryDocument(submitted, action(10));

  rejects(() => assertInventoryDocumentEditable(approved), codes.documentImmutable);
  rejects(() => returnInventoryDocumentToDraft(approved, action(11)), codes.lifecycleMetadataInvalid);

  const returned = returnInventoryDocumentToDraft(approved, action(11, "quantity needs correction"));
  assert.equal(returned.status, "draft");
  assert.equal(returned.version, 4);
  assert.equal(returned.lifecycleHistory.at(-1)?.fromStatus, "approved");
  assert.equal(returned.lifecycleHistory.at(-1)?.toStatus, "draft");
  assert.equal(returned.lifecycleHistory.at(-1)?.reason, "quantity needs correction");
  assert.equal(assertInventoryDocumentEditable(returned).status, "draft");

  const resubmitted = submitInventoryDocument(returned, action(12));
  rejects(() => confirmInventoryDocument(resubmitted, action(13)), codes.lifecycleTransitionInvalid);
});

test("submitted documents may return to Draft without pretending an approval existed", () => {
  const submitted = submitInventoryDocument(readyDraft(), action(9));
  const returned = returnInventoryDocumentToDraft(submitted, action(10));
  assert.equal(returned.status, "draft");
  assert.equal(returned.lifecycleHistory.at(-1)?.fromStatus, "submitted");
  assert.equal(returned.lifecycleHistory.at(-1)?.reason, null);
});

test("cancellation remains distinct from Draft deletion and is forbidden after confirmation", () => {
  const draft = readyDraft();
  assert.equal(assertInventoryDocumentDeletable(draft).status, "draft");

  const cancelledDraft = cancelInventoryDocument(draft, action(9, "entry abandoned"));
  assert.equal(cancelledDraft.status, "cancelled");
  rejects(() => assertInventoryDocumentDeletable(cancelledDraft), codes.documentDeleteDenied);
  rejects(() => assertInventoryDocumentEditable(cancelledDraft), codes.documentImmutable);

  const approved = approveInventoryDocument(submitInventoryDocument(readyDraft(), action(9)), action(10));
  const confirmed = confirmInventoryDocument(approved, action(11));
  rejects(() => cancelInventoryDocument(confirmed, action(12)), codes.lifecycleTransitionInvalid);
  rejects(() => assertInventoryDocumentDeletable(confirmed), codes.documentDeleteDenied);
});

test("confirmed facts can only become reversed through a linked separate compensating document", () => {
  const confirmed = confirmInventoryDocument(
    approveInventoryDocument(submitInventoryDocument(readyDraft(), action(9)), action(10)),
    action(11),
  );
  rejects(() => reverseInventoryDocument(confirmed, { ...action(12, "wrong receipt"), reversalDocumentId: confirmed.documentId }), codes.reversalReferenceInvalid);
  rejects(() => reverseInventoryDocument(confirmed, { ...action(12), reversalDocumentId: "reversal-1" }), codes.lifecycleMetadataInvalid);

  const reversed = reverseInventoryDocument(confirmed, {
    ...action(12, "wrong receipt"),
    reversalDocumentId: "reversal-1",
  });
  assert.equal(reversed.status, "reversed");
  assert.equal(reversed.version, 5);
  assert.equal(reversed.lifecycleHistory.at(-1)?.relatedDocumentId, "reversal-1");
  assert.equal(reversed.lifecycleHistory.at(-1)?.reason, "wrong receipt");
  rejects(() => reverseInventoryDocument(reversed, { ...action(13, "again"), reversalDocumentId: "reversal-2" }), codes.lifecycleTransitionInvalid);
  rejects(() => assertInventoryDocumentEditable(reversed), codes.documentImmutable);
});

test("all terminal/confirmed states reject direct ordinary mutation", () => {
  const submitted = submitInventoryDocument(readyDraft(), action(9));
  const approved = approveInventoryDocument(submitted, action(10));
  const confirmed = confirmInventoryDocument(approved, action(11));
  const cancelled = cancelInventoryDocument(submitted, action(10));
  const reversed = reverseInventoryDocument(confirmed, { ...action(12, "reverse"), reversalDocumentId: "reversal-1" });

  for (const document of [submitted, approved, confirmed, cancelled, reversed]) {
    rejects(() => assertInventoryDocumentEditable(document), codes.documentImmutable);
  }
});

test("lifecycle timestamps are monotonic and persisted history cannot be forged", () => {
  const draft = readyDraft();
  rejects(() => submitInventoryDocument(draft, {
    occurredAt: "2026-09-07T07:59:59Z",
    actorUserId: "user",
  }), codes.timestampOrderInvalid);

  const submitted = submitInventoryDocument(draft, action(9));
  rejects(() => approveInventoryDocument(submitted, {
    occurredAt: "2026-09-07T08:59:59Z",
    actorUserId: "user",
  }), codes.timestampOrderInvalid);

  rejects(() => rehydrateInventoryDocument({
    ...submitted,
    status: "approved",
  }), codes.lifecycleHistoryInvalid);

  rejects(() => rehydrateInventoryDocument({
    ...submitted,
    lifecycleHistory: [{
      ...submitted.lifecycleHistory[0]!,
      fromStatus: "approved",
    }],
  }), codes.lifecycleHistoryInvalid);

  rejects(() => rehydrateInventoryDocument({
    ...submitted,
    lifecycleHistory: [{
      ...submitted.lifecycleHistory[0]!,
      relatedDocumentId: "unexpected",
    }],
  }), codes.lifecycleMetadataInvalid);
});
