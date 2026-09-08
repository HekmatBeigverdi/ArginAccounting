import assert from "node:assert/strict";
import test from "node:test";
import type { Company, Branch } from "@argin/company";
import type { FiscalPeriod, FiscalYear, HistoricalLock } from "@argin/fiscal";
import { createProduct, createProductMasterDataProfile, createProductUnitProfile } from "@argin/product";
import { classifyWarehouse, createWarehouse, createWarehouseZone } from "@argin/warehouse";
import {
  INVENTORY_DOMAIN_ERROR_CODES as codes,
  InventoryDomainError,
  approveInventoryDocument,
  confirmInventoryQuantityAdjustment,
  confirmInventoryTransfer,
  createInventoryDocument,
  createInventoryLineOperation,
  createInventoryStockKey,
  createInventoryStockMovement,
  getInventoryStockBalance,
  rebuildInventoryStockLedger,
  submitInventoryDocument,
} from "../src/index.ts";
import type {
  ConfirmInventoryTransferInput,
  InventoryDocumentSnapshot,
  InventoryDomainErrorCode,
  InventoryProductReference,
  InventoryScopeContext,
  InventoryScopeReaders,
  InventoryStockLedgerSnapshot,
  InventoryWarehouseResolution,
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

const warehouse1 = classifyWarehouse({
  warehouse: createWarehouse({ warehouseId: "warehouse-1", companyId, code: "W1", title: "انبار ۱", createdAt: at }),
  kind: "general",
});
const warehouse2 = classifyWarehouse({
  warehouse: createWarehouse({ warehouseId: "warehouse-2", companyId, code: "W2", title: "انبار ۲", createdAt: at }),
  kind: "general",
});
const zone1 = createWarehouseZone({ zoneId: "zone-1", warehouse: warehouse1, code: "Z1", title: "ناحیه ۱", createdAt: at });
const zone2 = createWarehouseZone({ zoneId: "zone-2", warehouse: warehouse1, code: "Z2", title: "ناحیه ۲", createdAt: at });

const company: Company = {
  id: companyId, code: "C", legalName: "Company", tradeName: null, nationalId: null,
  registrationNumber: null, activityType: "trading", baseCurrency: "IRR", locale: "fa-IR",
  calendar: "jalali", status: "active", createdAt: at, updatedAt: at,
};
const year: FiscalYear = {
  id: "fy-2026", companyId, code: "Y", title: "Year", startDate: "2026-01-01", endDate: "2026-12-31",
  status: "open", isCurrent: true, closedAt: null, closedBy: null, createdAt: at, updatedAt: at,
};
const period: FiscalPeriod = {
  id: "fp-09", fiscalYearId: year.id, sequence: 9, code: "P09", title: "Period", startDate: "2026-09-01",
  endDate: "2026-09-30", status: "open", lockReason: null, lockedAt: null, lockedBy: null,
  createdAt: at, updatedAt: at,
};
const branches: Record<string, Branch> = {
  b1: { id: "b1", companyId, code: "B1", name: "Branch 1", isHeadOffice: true, status: "active", createdAt: at, updatedAt: at },
  b2: { id: "b2", companyId, code: "B2", name: "Branch 2", isHeadOffice: false, status: "active", createdAt: at, updatedAt: at },
};
const locks: HistoricalLock[] = [];

function scopeReaders(): InventoryScopeReaders {
  return {
    companies: { findById: async id => id === companyId ? company : null },
    branches: { findById: async id => branches[id] ?? null },
    fiscalYears: { findById: async id => id === year.id ? year : null },
    fiscalPeriods: { findById: async id => id === period.id ? period : null },
    historicalLocks: { findActiveLocks: async () => locks },
    warehouses: {
      getById: async input => {
        const warehouse = [warehouse1, warehouse2].find(item => item.warehouseId === input.warehouseId);
        if (!warehouse) return null;
        return {
          ...warehouse,
          organizationalScope: { mode: "company" },
          externalIdentifiers: [],
          version: 1,
        };
      },
    },
  };
}
const scopeContext: InventoryScopeContext = {
  companyId,
  actor: { id: actorUserId, branchIds: ["b1", "b2"], permissions: [] },
  allowCrossBranchTransfers: true,
};

function approvedTransfer(source: { warehouseId: string; zoneId?: string | null }, destination: { warehouseId: string; zoneId?: string | null }, quantity = "4", id = "transfer-1"): InventoryDocumentSnapshot {
  const sourceResolved = source.zoneId ? { warehouse: warehouse1, zone: source.zoneId === zone1.zoneId ? zone1 : zone2 } : { warehouse: source.warehouseId === warehouse1.warehouseId ? warehouse1 : warehouse2 };
  const destinationResolved = destination.zoneId ? { warehouse: warehouse1, zone: destination.zoneId === zone1.zoneId ? zone1 : zone2 } : { warehouse: destination.warehouseId === warehouse1.warehouseId ? warehouse1 : warehouse2 };
  const operation = createInventoryLineOperation({
    companyId, productId: "product-1", product: product(), enteredQuantity: quantity, unitId: "unit",
    warehouse: source, resolvedWarehouse: sourceResolved,
    destination, resolvedDestination: destinationResolved,
  });
  let document = createInventoryDocument({
    documentId: id, companyId, documentType: "transfer", documentNumber: "000001", businessDate: "2026-09-08",
    scope: { fiscalYearId: year.id, fiscalPeriodId: period.id },
    lines: [{ lineId: "line-1", position: 1, productId: "product-1", operation }], createdAt: at,
  });
  document = submitInventoryDocument(document, { occurredAt: submitAt, actorUserId });
  return approveInventoryDocument(document, { occurredAt: approveAt, actorUserId });
}

function approvedAdjustment(quantity: string, id = "adjustment-1"): InventoryDocumentSnapshot {
  const operation = createInventoryLineOperation({
    companyId, productId: "product-1", product: product(), enteredQuantity: quantity, unitId: "unit",
    warehouse: { warehouseId: warehouse1.warehouseId }, resolvedWarehouse: { warehouse: warehouse1 },
  });
  let document = createInventoryDocument({
    documentId: id, companyId, documentType: "adjustment", documentNumber: "000002", businessDate: "2026-09-08",
    scope: { fiscalYearId: year.id, fiscalPeriodId: period.id },
    lines: [{ lineId: "line-1", position: 1, productId: "product-1", operation }], createdAt: at,
  });
  document = submitInventoryDocument(document, { occurredAt: submitAt, actorUserId });
  return approveInventoryDocument(document, { occurredAt: approveAt, actorUserId });
}

function ledgerWith(quantity: string, warehouseId = warehouse1.warehouseId): InventoryStockLedgerSnapshot {
  return rebuildInventoryStockLedger([createInventoryStockMovement({
    movementId: `seed-${warehouseId}`, companyId, documentId: "seed-doc", lineId: "seed-line", productId: "product-1",
    warehouse: { warehouseId }, businessDate: "2026-09-07", businessOrder: 1, recordedAt: "2026-09-07T08:00:00Z",
    quantityDelta: quantity,
  })]);
}

async function rejects(action: () => Promise<unknown>, code: InventoryDomainErrorCode): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof InventoryDomainError && error.code === code);
}

function transferInput(
  document: InventoryDocumentSnapshot,
  ledger: InventoryStockLedgerSnapshot,
  sourceWarehouse: InventoryWarehouseResolution,
  destinationWarehouse: InventoryWarehouseResolution,
): ConfirmInventoryTransferInput {
  return {
    document,
    action: { occurredAt: confirmAt, actorUserId },
    scopeContext,
    scopeReaders: scopeReaders(),
    transferId: "transfer-group-1",
    businessOrder: 10,
    movementIdentities: [{ lineId: "line-1", sourceMovementId: "transfer-source-1", destinationMovementId: "transfer-destination-1" }],
    lineResolutions: [{ lineId: "line-1", product: product(), sourceWarehouse, destinationWarehouse }],
    ledger,
  };
}

test("inter-Warehouse transfer creates a conserved linked pair and preserves company total", async () => {
  const document = approvedTransfer({ warehouseId: warehouse1.warehouseId }, { warehouseId: warehouse2.warehouseId });
  const result = await confirmInventoryTransfer(transferInput(document, ledgerWith("10"), { warehouse: warehouse1 }, { warehouse: warehouse2 }));
  assert.equal(result.document.status, "confirmed");
  assert.equal(result.movements.length, 2);
  assert.deepEqual(result.movements.map(m => m.quantityDelta), ["-4", "4"]);
  assert.ok(result.movements.every(m => m.transferId === "transfer-group-1"));
  const sourceKey = createInventoryStockKey({ companyId, productId: "product-1", warehouse: { warehouseId: warehouse1.warehouseId } });
  const destinationKey = createInventoryStockKey({ companyId, productId: "product-1", warehouse: { warehouseId: warehouse2.warehouseId } });
  assert.equal(getInventoryStockBalance(result.ledger, sourceKey).quantity, "6");
  assert.equal(getInventoryStockBalance(result.ledger, destinationKey).quantity, "4");
});

test("intra-Warehouse physical transfer supports distinct zones with the same Product/base unit", async () => {
  const document = approvedTransfer(
    { warehouseId: warehouse1.warehouseId, zoneId: zone1.zoneId },
    { warehouseId: warehouse1.warehouseId, zoneId: zone2.zoneId },
    "3", "transfer-zones",
  );
  const seed = rebuildInventoryStockLedger([createInventoryStockMovement({
    movementId: "seed-zone", companyId, documentId: "seed-zone-doc", lineId: "seed", productId: "product-1",
    warehouse: { warehouseId: warehouse1.warehouseId, zoneId: zone1.zoneId }, businessDate: "2026-09-07",
    businessOrder: 1, recordedAt: "2026-09-07T08:00:00Z", quantityDelta: "5",
  })]);
  const result = await confirmInventoryTransfer(transferInput(document, seed, { warehouse: warehouse1, zone: zone1 }, { warehouse: warehouse1, zone: zone2 }));
  assert.equal(result.movements[0]?.stockKey.zoneId, zone1.zoneId);
  assert.equal(result.movements[1]?.stockKey.zoneId, zone2.zoneId);
});

test("failed transfer is atomic to the caller: insufficient source returns no partial destination effect", async () => {
  const document = approvedTransfer({ warehouseId: warehouse1.warehouseId }, { warehouseId: warehouse2.warehouseId }, "11", "transfer-too-large");
  const ledger = ledgerWith("10");
  await rejects(() => confirmInventoryTransfer(transferInput(document, ledger, { warehouse: warehouse1 }, { warehouse: warehouse2 })), codes.negativeStock);
  const sourceKey = createInventoryStockKey({ companyId, productId: "product-1", warehouse: { warehouseId: warehouse1.warehouseId } });
  const destinationKey = createInventoryStockKey({ companyId, productId: "product-1", warehouse: { warehouseId: warehouse2.warehouseId } });
  assert.equal(getInventoryStockBalance(ledger, sourceKey).quantity, "10");
  assert.equal(getInventoryStockBalance(ledger, destinationKey).quantity, "0");
  assert.equal(document.status, "approved");
});

test("transfer rejects reused transfer identity and malformed pair identities", async () => {
  const document = approvedTransfer({ warehouseId: warehouse1.warehouseId }, { warehouseId: warehouse2.warehouseId });
  const existing = rebuildInventoryStockLedger([createInventoryStockMovement({
    movementId: "old-transfer", companyId, documentId: "old-doc", lineId: "old-line", productId: "product-1",
    warehouse: { warehouseId: warehouse1.warehouseId }, businessDate: "2026-09-07", businessOrder: 1,
    recordedAt: "2026-09-07T08:00:00Z", transferId: "transfer-group-1", quantityDelta: "10",
  })]);
  await rejects(() => confirmInventoryTransfer(transferInput(document, existing, { warehouse: warehouse1 }, { warehouse: warehouse2 })), codes.transferIdentityInvalid);
  await rejects(() => confirmInventoryTransfer({
    ...transferInput(document, ledgerWith("10"), { warehouse: warehouse1 }, { warehouse: warehouse2 }),
    movementIdentities: [{ lineId: "line-1", sourceMovementId: "same", destinationMovementId: "same" }],
  }), codes.movementIdentityMismatch);
});

test("transfer revalidates destination master eligibility at confirmation", async () => {
  const document = approvedTransfer({ warehouseId: warehouse1.warehouseId }, { warehouseId: warehouse2.warehouseId });
  await rejects(() => confirmInventoryTransfer(transferInput(
    document,
    ledgerWith("10"),
    { warehouse: warehouse1 },
    { warehouse: { ...warehouse2, status: "inactive" } },
  )), codes.referenceIneligible);
});

test("positive and negative adjustments preserve signed quantity and mandatory reason in lifecycle", async () => {
  const positive = await confirmInventoryQuantityAdjustment({
    document: approvedAdjustment("2", "adjust-plus"),
    action: { occurredAt: confirmAt, actorUserId, reason: "Count correction" },
    scopeContext, scopeReaders: scopeReaders(), businessOrder: 20,
    movementIdentities: [{ lineId: "line-1", movementId: "adjust-plus-movement" }],
    lineResolutions: [{ lineId: "line-1", product: product(), warehouse: { warehouse: warehouse1 } }],
    ledger: ledgerWith("5"),
  });
  assert.equal(positive.movements[0]?.quantityDelta, "2");
  assert.equal(positive.document.lifecycleHistory[positive.document.lifecycleHistory.length - 1]?.reason, "Count correction");

  const negative = await confirmInventoryQuantityAdjustment({
    document: approvedAdjustment("-2", "adjust-minus"),
    action: { occurredAt: confirmAt, actorUserId, reason: "Damaged stock" },
    scopeContext, scopeReaders: scopeReaders(), businessOrder: 21,
    movementIdentities: [{ lineId: "line-1", movementId: "adjust-minus-movement" }],
    lineResolutions: [{ lineId: "line-1", product: product(), warehouse: { warehouse: warehouse1 } }],
    ledger: ledgerWith("5"),
  });
  assert.equal(negative.movements[0]?.quantityDelta, "-2");
});

test("adjustment rejects missing reason and stock-reducing adjustment below zero", async () => {
  const document = approvedAdjustment("-6", "adjust-invalid");
  await rejects(() => confirmInventoryQuantityAdjustment({
    document,
    action: { occurredAt: confirmAt, actorUserId },
    scopeContext, scopeReaders: scopeReaders(), businessOrder: 20,
    movementIdentities: [{ lineId: "line-1", movementId: "adjust-invalid-movement" }],
    lineResolutions: [{ lineId: "line-1", product: product(), warehouse: { warehouse: warehouse1 } }],
    ledger: ledgerWith("5"),
  }), codes.adjustmentReasonRequired);
  await rejects(() => confirmInventoryQuantityAdjustment({
    document,
    action: { occurredAt: confirmAt, actorUserId, reason: "Count correction" },
    scopeContext, scopeReaders: scopeReaders(), businessOrder: 20,
    movementIdentities: [{ lineId: "line-1", movementId: "adjust-invalid-movement" }],
    lineResolutions: [{ lineId: "line-1", product: product(), warehouse: { warehouse: warehouse1 } }],
    ledger: ledgerWith("5"),
  }), codes.negativeStock);
});

test("Step 8 workflows reject the other document types", async () => {
  await rejects(() => confirmInventoryTransfer({
    ...transferInput(approvedAdjustment("1"), ledgerWith("10"), { warehouse: warehouse1 }, { warehouse: warehouse2 }),
  }), codes.stockWorkflowUnsupported);
  const transfer = approvedTransfer({ warehouseId: warehouse1.warehouseId }, { warehouseId: warehouse2.warehouseId });
  await rejects(() => confirmInventoryQuantityAdjustment({
    document: transfer,
    action: { occurredAt: confirmAt, actorUserId, reason: "not adjustment" },
    scopeContext, scopeReaders: scopeReaders(), businessOrder: 20,
    movementIdentities: [{ lineId: "line-1", movementId: "wrong-type" }],
    lineResolutions: [{ lineId: "line-1", product: product(), warehouse: { warehouse: warehouse1 } }],
    ledger: ledgerWith("10"),
  }), codes.stockWorkflowUnsupported);
});
