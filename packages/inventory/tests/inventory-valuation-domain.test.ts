import assert from "node:assert/strict";
import test from "node:test";
import { createWarehouseOperationalReference } from "@argin/warehouse";
import { createInventoryStockMovement } from "../src/domain/inventory-stock.ts";
import {
  createInventoryCostLayer,
  createInventoryValuationBasis,
  createUnresolvedInventoryValuationEntry,
  inventoryValuationStreamKey,
  resolveInventoryValuationEntry,
  InventoryValuationDomainError,
} from "../src/domain/inventory-valuation.ts";

function movement(quantityDelta: string, overrides: Partial<Parameters<typeof createInventoryStockMovement>[0]> = {}) {
  return createInventoryStockMovement({
    movementId: "mov-1",
    companyId: "company-1",
    documentId: "doc-1",
    lineId: "line-1",
    productId: "product-1",
    warehouse: createWarehouseOperationalReference({ warehouseId: "warehouse-1", zoneId: "zone-1", locationId: "location-1" }),
    businessDate: "2026-09-11",
    businessOrder: 10,
    recordedAt: "2026-09-11T08:00:00.000Z",
    quantityDelta,
    ...overrides,
  });
}

test("creates an unresolved valuation fact from immutable quantity movement identity", () => {
  const entry = createUnresolvedInventoryValuationEntry({
    valuationEntryId: "valuation-1",
    movement: movement("5.000"),
    method: "moving_average",
    strategyVersion: 1,
    reason: "awaiting inbound cost",
  });

  assert.equal(entry.source.movementId, "mov-1");
  assert.equal(entry.source.documentId, "doc-1");
  assert.equal(entry.quantity, "5");
  assert.equal(entry.kind, "inbound");
  assert.equal(entry.currency, "IRR");
  assert.equal(entry.costState, "unresolved");
  assert.equal(entry.unitCost, null);
  assert.equal(entry.totalCost, null);
  assert.equal(entry.revision, 1);
});

test("resolves valuation without mutating source identity and advances optimistic revision", () => {
  const unresolved = createUnresolvedInventoryValuationEntry({
    valuationEntryId: "valuation-1",
    movement: movement("5"),
    method: "fifo",
    strategyVersion: 1,
    currency: "irr",
    reason: "pending cost",
  });
  const resolved = resolveInventoryValuationEntry(unresolved, {
    unitCost: "1200000.000",
    totalCost: 6000000,
    valuedAt: "2026-09-11T09:00:00Z",
    expectedRevision: 1,
  });

  assert.equal(resolved.source.movementId, unresolved.source.movementId);
  assert.equal(resolved.costState, "resolved");
  assert.equal(resolved.currency, "IRR");
  assert.equal(resolved.unitCost, "1200000");
  assert.equal(resolved.totalCost, 6000000);
  assert.equal(resolved.revision, 2);
});

test("requires negative monetary effect for ordinary outbound valuation", () => {
  const unresolved = createUnresolvedInventoryValuationEntry({
    valuationEntryId: "valuation-out",
    movement: movement("-2"),
    method: "moving_average",
    strategyVersion: 1,
    reason: "pending issue cost",
  });

  assert.throws(
    () => resolveInventoryValuationEntry(unresolved, { unitCost: "100", totalCost: 200, valuedAt: "2026-09-11T09:00:00Z", expectedRevision: 1 }),
    (error: unknown) => error instanceof InventoryValuationDomainError && error.code === "VALUATION_AMOUNT_INVALID",
  );
});

test("rejects monetary totals outside Platform Money safe-integer invariant", () => {
  const unresolved = createUnresolvedInventoryValuationEntry({
    valuationEntryId: "valuation-unsafe",
    movement: movement("1"),
    method: "fifo",
    strategyVersion: 1,
    reason: "pending cost",
  });

  assert.throws(
    () => resolveInventoryValuationEntry(unresolved, { unitCost: "0.5", totalCost: 0.5, valuedAt: "2026-09-11T09:00:00Z", expectedRevision: 1 }),
    (error: unknown) => error instanceof InventoryValuationDomainError && error.code === "VALUATION_AMOUNT_INVALID",
  );
});

test("creates cost layer only from resolved valuation entry", () => {
  const unresolved = createUnresolvedInventoryValuationEntry({
    valuationEntryId: "valuation-1",
    movement: movement("10"),
    method: "fifo",
    strategyVersion: 1,
    reason: "pending cost",
  });
  assert.throws(() => createInventoryCostLayer({
    costLayerId: "layer-1",
    sourceEntry: unresolved,
    originalQuantity: "10",
    unitCost: "100",
    originalCost: 1000,
  }), InventoryValuationDomainError);

  const resolved = resolveInventoryValuationEntry(unresolved, {
    unitCost: "100",
    totalCost: 1000,
    valuedAt: "2026-09-11T09:00:00Z",
    expectedRevision: 1,
  });
  const layer = createInventoryCostLayer({
    costLayerId: "layer-1",
    sourceEntry: resolved,
    originalQuantity: "10",
    unitCost: "100",
    originalCost: 1000,
  });
  assert.equal(layer.remainingQuantity, "10");
  assert.equal(layer.remainingCost, 1000);
  assert.equal(layer.currency, "IRR");
  assert.equal(layer.sourceMovementId, "mov-1");
});

test("valuation basis and stream key bind method/version/currency to stock identity", () => {
  const stockKey = movement("1").stockKey;
  const basis = createInventoryValuationBasis({
    companyId: "company-1",
    productId: "product-1",
    stockKey,
    method: "moving_average",
    strategyVersion: 2,
    currency: "IRR",
    effectiveFrom: "2026-09-01",
  });

  assert.equal(basis.method, "moving_average");
  assert.equal(basis.currency, "IRR");
  const streamKey = inventoryValuationStreamKey({ stockKey, method: basis.method, strategyVersion: basis.strategyVersion, currency: basis.currency });
  assert.match(streamKey, /moving_average/);
  assert.match(streamKey, /IRR/);
});

test("transfer and reversal preserve Phase 20 durable references", () => {
  const transfer = createUnresolvedInventoryValuationEntry({
    valuationEntryId: "valuation-transfer",
    movement: movement("-3", { transferId: "transfer-1" }),
    method: "fifo",
    strategyVersion: 1,
    reason: "pending transfer cost",
  });
  assert.equal(transfer.kind, "transfer");
  assert.equal(transfer.source.transferId, "transfer-1");

  const reversal = createUnresolvedInventoryValuationEntry({
    valuationEntryId: "valuation-reversal",
    movement: movement("3", { movementId: "mov-reversal", documentId: "doc-reversal", reversalOfMovementId: "mov-1" }),
    method: "fifo",
    strategyVersion: 1,
    reason: "pending reversal valuation",
  });
  assert.equal(reversal.kind, "reversal");
  assert.equal(reversal.source.reversalOfMovementId, "mov-1");
});
