import assert from "node:assert/strict";
import test from "node:test";
import { createProduct, createProductMasterDataProfile, createProductUnitProfile } from "@argin/product";
import { classifyWarehouse, createWarehouse } from "@argin/warehouse";
import {
  INVENTORY_DOMAIN_ERROR_CODES as codes,
  InventoryDomainError,
  approveInventoryDocument,
  confirmInventoryReceiptIssueOpening,
  createInventoryDocument,
  createInventoryLineOperation,
  createInventoryStockKey,
  createInventoryStockMovement,
  getInventoryStockBalance,
  rebuildInventoryStockLedger,
  serializeInventoryOpeningBalanceKey,
  submitInventoryDocument,
} from "../src/index.ts";
import type {
  ConfirmInventoryCoreDocumentInput,
  InventoryDocumentSnapshot,
  InventoryDomainErrorCode,
  InventoryOpeningBalanceKey,
  InventoryProductReference,
  InventoryStockLedgerSnapshot,
} from "../src/index.ts";

const companyId = "company-1";
const at = "2026-09-08T08:00:00Z";
const submitAt = "2026-09-08T08:01:00Z";
const approveAt = "2026-09-08T08:02:00Z";
const confirmAt = "2026-09-08T08:03:00Z";
const actorUserId = "user-1";

const units = createProductUnitProfile({
  baseUnit: { unitId: "unit", code: "EA", title: "عدد", precision: 6, roundingMode: "half-up" },
  alternateUnits: [],
});

function product(): InventoryProductReference {
  return {
    ...createProduct({ productId: "product-1", companyId, code: "P1", title: "کالا", kind: "product", createdAt: at }),
    version: 3,
    units,
    masterData: createProductMasterDataProfile({ kind: "product", operational: { stockTracking: true } }),
  };
}

const warehouse = classifyWarehouse({
  warehouse: createWarehouse({ warehouseId: "warehouse-1", companyId, code: "W1", title: "انبار اصلی", createdAt: at }),
  kind: "general",
});
const warehouseReference = { warehouseId: warehouse.warehouseId };
const resolvedWarehouse = { warehouse };

function operation(quantity: string) {
  return createInventoryLineOperation({
    companyId,
    productId: "product-1",
    product: product(),
    enteredQuantity: quantity,
    unitId: "unit",
    warehouse: warehouseReference,
    resolvedWarehouse,
  });
}

function draft(type: "receipt" | "issue" | "opening" | "transfer" | "adjustment", quantity = "5", id = `doc-${type}`): InventoryDocumentSnapshot {
  const lines = type === "transfer"
    ? []
    : [{ lineId: "line-1", position: 1, productId: "product-1", operation: operation(quantity) }];
  return createInventoryDocument({
    documentId: id,
    companyId,
    documentType: type,
    documentNumber: "000001",
    businessDate: "2026-09-08",
    scope: { branchId: null, fiscalYearId: "fy-2026", fiscalPeriodId: "fp-09" },
    lines,
    createdAt: at,
  });
}

function approved(type: "receipt" | "issue" | "opening", quantity = "5", id = `doc-${type}`): InventoryDocumentSnapshot {
  const submitted = submitInventoryDocument(draft(type, quantity, id), { occurredAt: submitAt, actorUserId });
  return approveInventoryDocument(submitted, { occurredAt: approveAt, actorUserId });
}

function baseLedger(quantity = "0"): InventoryStockLedgerSnapshot {
  if (quantity === "0") return rebuildInventoryStockLedger([]);
  const movement = createInventoryStockMovement({
    movementId: "opening-existing-movement",
    companyId,
    documentId: "existing-receipt",
    lineId: "existing-line",
    productId: "product-1",
    warehouse: warehouseReference,
    businessDate: "2026-09-07",
    businessOrder: 1,
    recordedAt: "2026-09-07T08:00:00Z",
    quantityDelta: quantity,
  });
  return rebuildInventoryStockLedger([movement]);
}

function confirmInput(document: InventoryDocumentSnapshot, ledger = rebuildInventoryStockLedger([]), openingKeys: readonly InventoryOpeningBalanceKey[] = []) {
  return {
    document,
    action: { occurredAt: confirmAt, actorUserId },
    businessOrder: 10,
    movementIdentities: [{ lineId: "line-1", movementId: `move-${document.documentId}` }],
    lineResolutions: [{ lineId: "line-1", product: product(), warehouse: resolvedWarehouse }],
    ledger,
    openingKeys,
  } as const;
}

function rejects(action: () => unknown, code: InventoryDomainErrorCode): void {
  assert.throws(action, (error: unknown) => error instanceof InventoryDomainError && error.code === code);
}

test("receipt confirmation creates positive immutable movement and confirms only after validation", () => {
  const result = confirmInventoryReceiptIssueOpening(confirmInput(approved("receipt", "5")));
  assert.equal(result.document.status, "confirmed");
  assert.equal(result.movements.length, 1);
  assert.equal(result.movements[0]?.quantityDelta, "5");
  assert.equal(result.movements[0]?.documentId, "doc-receipt");
  assert.equal(result.movements[0]?.businessOrder, 10);
  assert.equal(result.movements[0]?.recordedAt, "2026-09-08T08:03:00.000Z");
  assert.equal(getInventoryStockBalance(result.ledger, result.movements[0]!.stockKey).quantity, "5");
});

test("issue confirmation emits a negative delta and enforces current stock", () => {
  const result = confirmInventoryReceiptIssueOpening(confirmInput(approved("issue", "3"), baseLedger("10")));
  assert.equal(result.movements[0]?.quantityDelta, "-3");
  assert.equal(getInventoryStockBalance(result.ledger, result.movements[0]!.stockKey).quantity, "7");
  rejects(() => confirmInventoryReceiptIssueOpening(confirmInput(approved("issue", "11", "doc-issue-too-large"), baseLedger("10"))), codes.negativeStock);
});

test("backdated issue revalidates historical running balance instead of ending balance only", () => {
  const laterReceipt = createInventoryStockMovement({
    movementId: "later-receipt",
    companyId,
    documentId: "later-doc",
    lineId: "later-line",
    productId: "product-1",
    warehouse: warehouseReference,
    businessDate: "2026-09-09",
    businessOrder: 1,
    recordedAt: "2026-09-09T08:00:00Z",
    quantityDelta: "10",
  });
  const document = approved("issue", "3", "backdated-issue");
  rejects(() => confirmInventoryReceiptIssueOpening(confirmInput(document, rebuildInventoryStockLedger([laterReceipt]))), codes.negativeStock);
});

test("opening confirmation returns a durable fiscal-year StockKey uniqueness fact", () => {
  const result = confirmInventoryReceiptIssueOpening(confirmInput(approved("opening", "8")));
  assert.equal(result.openingKeys.length, 1);
  assert.equal(result.openingKeys[0]?.fiscalYearId, "fy-2026");
  assert.equal(result.openingKeys[0]?.companyId, companyId);
  assert.equal(serializeInventoryOpeningBalanceKey(result.openingKeys[0]!), '["company-1","fy-2026","[\\"company-1\\",\\"product-1\\",\\"warehouse-1\\",null,null]"]');
  assert.equal(result.movements[0]?.documentId, "doc-opening");
});

test("duplicate opening for the same fiscal-year StockKey is rejected", () => {
  const first = confirmInventoryReceiptIssueOpening(confirmInput(approved("opening", "8", "opening-1")));
  const second = approved("opening", "2", "opening-2");
  rejects(() => confirmInventoryReceiptIssueOpening(confirmInput(second, first.ledger, first.openingKeys)), codes.openingDuplicate);
});

test("duplicate StockKey lines inside one opening document are rejected", () => {
  const op = operation("2");
  let document = createInventoryDocument({
    documentId: "opening-two-lines",
    companyId,
    documentType: "opening",
    documentNumber: "000002",
    businessDate: "2026-09-08",
    scope: { fiscalYearId: "fy-2026", fiscalPeriodId: "fp-09" },
    lines: [
      { lineId: "line-1", position: 1, productId: "product-1", operation: op },
      { lineId: "line-2", position: 2, productId: "product-1", operation: op },
    ],
    createdAt: at,
  });
  document = submitInventoryDocument(document, { occurredAt: submitAt, actorUserId });
  document = approveInventoryDocument(document, { occurredAt: approveAt, actorUserId });
  rejects(() => confirmInventoryReceiptIssueOpening({
    ...confirmInput(document),
    movementIdentities: [
      { lineId: "line-1", movementId: "opening-m1" },
      { lineId: "line-2", movementId: "opening-m2" },
    ],
    lineResolutions: [
      { lineId: "line-1", product: product(), warehouse: resolvedWarehouse },
      { lineId: "line-2", product: product(), warehouse: resolvedWarehouse },
    ],
  }), codes.openingDuplicate);
});

test("current Product and Warehouse eligibility are revalidated at confirmation", () => {
  const document = approved("receipt");
  rejects(() => confirmInventoryReceiptIssueOpening({
    ...confirmInput(document),
    lineResolutions: [{ lineId: "line-1", product: { ...product(), status: "inactive" }, warehouse: resolvedWarehouse }],
  }), codes.productIneligible);
  rejects(() => confirmInventoryReceiptIssueOpening({
    ...confirmInput(document),
    lineResolutions: [{ lineId: "line-1", product: product(), warehouse: { warehouse: { ...warehouse, status: "inactive" } } }],
  }), codes.referenceIneligible);
});

test("draft/import-style documents cannot bypass submit and approval", () => {
  rejects(() => confirmInventoryReceiptIssueOpening(confirmInput(draft("receipt"))), codes.lifecycleTransitionInvalid);
});

test("transfer and adjustment remain owned by Step 8", () => {
  for (const type of ["transfer", "adjustment"] as const) {
    rejects(() => confirmInventoryReceiptIssueOpening(confirmInput(draft(type))), codes.stockWorkflowUnsupported);
  }
});

test("resolution and movement identity sets must match document lines exactly", () => {
  const document = approved("receipt");
  rejects(() => confirmInventoryReceiptIssueOpening({ ...confirmInput(document), lineResolutions: [] }), codes.confirmationResolutionMismatch);
  rejects(() => confirmInventoryReceiptIssueOpening({ ...confirmInput(document), movementIdentities: [] }), codes.confirmationResolutionMismatch);
  rejects(() => confirmInventoryReceiptIssueOpening({
    ...confirmInput(document),
    movementIdentities: [{ lineId: "line-1", movementId: "same" }, { lineId: "extra", movementId: "same" }],
  }), codes.movementIdentityMismatch);
});

test("missing ledger and malformed opening guard cannot be treated as empty state", () => {
  const input = confirmInput(approved("receipt"));
  rejects(() => confirmInventoryReceiptIssueOpening({ ...input, ledger: undefined } as unknown as ConfirmInventoryCoreDocumentInput), codes.inputInvalid);
  rejects(() => confirmInventoryReceiptIssueOpening({ ...input, openingKeys: {} } as unknown as ConfirmInventoryCoreDocumentInput), codes.openingKeyInvalid);
});

test("caller balance projection is ignored and rebuilt from immutable movement facts", () => {
  const key = createInventoryStockKey({ companyId, productId: "product-1", warehouse: warehouseReference });
  const forged = {
    movements: [],
    balances: [{ stockKey: key, quantity: "999", movementCount: 99, lastMovementId: "fake" }],
  } as InventoryStockLedgerSnapshot;
  const result = confirmInventoryReceiptIssueOpening(confirmInput(approved("receipt", "5"), forged));
  assert.equal(getInventoryStockBalance(result.ledger, key).quantity, "5");
});

test("failed confirmation leaves caller document and ledger unchanged", () => {
  const document = approved("issue", "6", "failed-issue");
  const ledger = baseLedger("5");
  rejects(() => confirmInventoryReceiptIssueOpening(confirmInput(document, ledger)), codes.negativeStock);
  assert.equal(document.status, "approved");
  assert.equal(getInventoryStockBalance(ledger, createInventoryStockKey({ companyId, productId: "product-1", warehouse: warehouseReference })).quantity, "5");
});
