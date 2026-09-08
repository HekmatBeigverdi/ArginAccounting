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
  InventoryScopeContext,
  InventoryScopeReaders,
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

const scopeContext: InventoryScopeContext = {
  companyId,
  actor: { id: actorUserId, branchIds: [], permissions: [] },
};

function createScopeReaders(): InventoryScopeReaders {
  return {
    companies: {
      findById: async () => ({
        id: companyId,
        code: "C1",
        legalName: "Company",
        tradeName: null,
        nationalId: null,
        registrationNumber: null,
        activityType: "trading",
        baseCurrency: "IRR",
        locale: "fa-IR",
        calendar: "jalali",
        status: "active",
        createdAt: at,
        updatedAt: at,
      }),
    },
    branches: { findById: async () => null },
    fiscalYears: {
      findById: async () => ({
        id: "fy-2026",
        companyId,
        code: "FY26",
        title: "2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "open",
        isCurrent: true,
        closedAt: null,
        closedBy: null,
        createdAt: at,
        updatedAt: at,
      }),
    },
    fiscalPeriods: {
      findById: async () => ({
        id: "fp-09",
        fiscalYearId: "fy-2026",
        sequence: 9,
        code: "09",
        title: "September",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        status: "open",
        lockReason: null,
        lockedAt: null,
        lockedBy: null,
        createdAt: at,
        updatedAt: at,
      }),
    },
    historicalLocks: { findActiveLocks: async () => [] },
    warehouses: {
      getById: async () => ({
        ...warehouse,
        organizationalScope: { mode: "company" },
        externalIdentifiers: [],
        version: 1,
      }),
    },
  };
}

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
    scopeContext,
    scopeReaders: createScopeReaders(),
    businessOrder: 10,
    movementIdentities: [{ lineId: "line-1", movementId: `move-${document.documentId}` }],
    lineResolutions: [{ lineId: "line-1", product: product(), warehouse: resolvedWarehouse }],
    ledger,
    openingKeys,
  } as const;
}

async function rejects(action: () => Promise<unknown>, code: InventoryDomainErrorCode): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof InventoryDomainError && error.code === code);
}

test("receipt confirmation creates positive immutable movement after scope/master validation", async () => {
  const result = await confirmInventoryReceiptIssueOpening(confirmInput(approved("receipt", "5")));
  assert.equal(result.document.status, "confirmed");
  assert.equal(result.movements.length, 1);
  assert.equal(result.movements[0]?.quantityDelta, "5");
  assert.equal(result.movements[0]?.documentId, "doc-receipt");
  assert.equal(result.movements[0]?.businessOrder, 10);
  assert.equal(result.movements[0]?.recordedAt, "2026-09-08T08:03:00.000Z");
  assert.equal(getInventoryStockBalance(result.ledger, result.movements[0]!.stockKey).quantity, "5");
});

test("issue confirmation emits a negative delta and enforces current stock", async () => {
  const result = await confirmInventoryReceiptIssueOpening(confirmInput(approved("issue", "3"), baseLedger("10")));
  assert.equal(result.movements[0]?.quantityDelta, "-3");
  assert.equal(getInventoryStockBalance(result.ledger, result.movements[0]!.stockKey).quantity, "7");
  await rejects(() => confirmInventoryReceiptIssueOpening(confirmInput(approved("issue", "11", "doc-issue-too-large"), baseLedger("10"))), codes.negativeStock);
});

test("backdated issue revalidates historical running balance instead of ending balance only", async () => {
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
  await rejects(
    () => confirmInventoryReceiptIssueOpening(confirmInput(approved("issue", "3", "backdated-issue"), rebuildInventoryStockLedger([laterReceipt]))),
    codes.negativeStock,
  );
});

test("confirmation revalidates fiscal scope and historical locks", async () => {
  const document = approved("receipt");
  const closedReaders = createScopeReaders();
  closedReaders.fiscalPeriods.findById = async () => ({
    ...(await createScopeReaders().fiscalPeriods.findById("fp-09"))!,
    status: "closed",
  });
  await rejects(() => confirmInventoryReceiptIssueOpening({ ...confirmInput(document), scopeReaders: closedReaders }), codes.fiscalScopeInvalid);

  const lockedReaders = createScopeReaders();
  lockedReaders.historicalLocks.findActiveLocks = async () => [{
    id: "lock-1",
    companyId,
    branchId: null,
    scope: "inventory",
    lockedThroughDate: "2026-09-08",
    reason: "closed",
    isActive: true,
    createdBy: null,
    createdAt: at,
    releasedBy: null,
    releasedAt: null,
  }];
  await rejects(() => confirmInventoryReceiptIssueOpening({ ...confirmInput(document), scopeReaders: lockedReaders }), codes.historicalLockBlocked);
});

test("opening confirmation returns a durable fiscal-year StockKey uniqueness fact", async () => {
  const result = await confirmInventoryReceiptIssueOpening(confirmInput(approved("opening", "8")));
  assert.equal(result.openingKeys.length, 1);
  assert.equal(result.openingKeys[0]?.fiscalYearId, "fy-2026");
  assert.equal(result.openingKeys[0]?.companyId, companyId);
  assert.equal(serializeInventoryOpeningBalanceKey(result.openingKeys[0]!), '["company-1","fy-2026","[\\"company-1\\",\\"product-1\\",\\"warehouse-1\\",null,null]"]');
  assert.equal(result.movements[0]?.documentId, "doc-opening");
});

test("duplicate opening for the same fiscal-year StockKey is rejected", async () => {
  const first = await confirmInventoryReceiptIssueOpening(confirmInput(approved("opening", "8", "opening-1")));
  await rejects(
    () => confirmInventoryReceiptIssueOpening(confirmInput(approved("opening", "2", "opening-2"), first.ledger, first.openingKeys)),
    codes.openingDuplicate,
  );
});

test("duplicate StockKey lines inside one opening document are rejected", async () => {
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
  await rejects(() => confirmInventoryReceiptIssueOpening({
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

test("current Product and Warehouse eligibility are revalidated at confirmation", async () => {
  const document = approved("receipt");
  await rejects(() => confirmInventoryReceiptIssueOpening({
    ...confirmInput(document),
    lineResolutions: [{ lineId: "line-1", product: { ...product(), status: "inactive" }, warehouse: resolvedWarehouse }],
  }), codes.productIneligible);
  await rejects(() => confirmInventoryReceiptIssueOpening({
    ...confirmInput(document),
    lineResolutions: [{ lineId: "line-1", product: product(), warehouse: { warehouse: { ...warehouse, status: "inactive" } } }],
  }), codes.referenceIneligible);
});

test("draft/import-style documents cannot bypass submit and approval", async () => {
  await rejects(() => confirmInventoryReceiptIssueOpening(confirmInput(draft("receipt"))), codes.lifecycleTransitionInvalid);
});

test("transfer and adjustment remain owned by Step 8", async () => {
  for (const type of ["transfer", "adjustment"] as const) {
    await rejects(() => confirmInventoryReceiptIssueOpening(confirmInput(draft(type))), codes.stockWorkflowUnsupported);
  }
});

test("resolution and movement identity sets must match document lines exactly", async () => {
  const document = approved("receipt");
  await rejects(() => confirmInventoryReceiptIssueOpening({ ...confirmInput(document), lineResolutions: [] }), codes.confirmationResolutionMismatch);
  await rejects(() => confirmInventoryReceiptIssueOpening({ ...confirmInput(document), movementIdentities: [] }), codes.confirmationResolutionMismatch);
  await rejects(() => confirmInventoryReceiptIssueOpening({
    ...confirmInput(document),
    movementIdentities: [{ lineId: "line-1", movementId: "same" }, { lineId: "extra", movementId: "same" }],
  }), codes.movementIdentityMismatch);
});

test("missing ledger and malformed opening guard cannot be treated as empty state", async () => {
  const input = confirmInput(approved("receipt"));
  await rejects(() => confirmInventoryReceiptIssueOpening({ ...input, ledger: undefined } as unknown as ConfirmInventoryCoreDocumentInput), codes.inputInvalid);
  await rejects(() => confirmInventoryReceiptIssueOpening({ ...input, openingKeys: {} } as unknown as ConfirmInventoryCoreDocumentInput), codes.openingKeyInvalid);
});

test("caller balance projection is ignored and rebuilt from immutable movement facts", async () => {
  const key = createInventoryStockKey({ companyId, productId: "product-1", warehouse: warehouseReference });
  const forged = {
    movements: [],
    balances: [{ stockKey: key, quantity: "999", movementCount: 99, lastMovementId: "fake" }],
  } as InventoryStockLedgerSnapshot;
  const result = await confirmInventoryReceiptIssueOpening(confirmInput(approved("receipt", "5"), forged));
  assert.equal(getInventoryStockBalance(result.ledger, key).quantity, "5");
});

test("failed confirmation leaves caller document and ledger unchanged", async () => {
  const document = approved("issue", "6", "failed-issue");
  const ledger = baseLedger("5");
  await rejects(() => confirmInventoryReceiptIssueOpening(confirmInput(document, ledger)), codes.negativeStock);
  assert.equal(document.status, "approved");
  assert.equal(getInventoryStockBalance(ledger, createInventoryStockKey({ companyId, productId: "product-1", warehouse: warehouseReference })).quantity, "5");
});
