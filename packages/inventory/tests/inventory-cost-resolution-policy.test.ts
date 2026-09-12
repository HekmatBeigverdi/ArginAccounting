import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_INVENTORY_COST_RESOLUTION_POLICY,
  InventoryCostResolutionError,
  assertInventoryCostResolutionAllowed,
  createDeferredInventoryValuationEntry,
  createInventoryCostResolutionPolicy,
  evaluateInventoryInboundCostResolution,
  evaluateInventoryOutboundCostResolution,
} from "../src/domain/inventory-cost-resolution-policy.ts";
import type { InventoryStockMovementSnapshot } from "../src/domain/inventory-stock.ts";

function movement(quantityDelta: string): InventoryStockMovementSnapshot {
  return Object.freeze({
    movementId: "move-1",
    companyId: "company-1",
    documentId: "doc-1",
    lineId: "line-1",
    businessDate: "2026-09-12",
    businessOrder: 10,
    recordedAt: "2026-09-12T08:00:00.000Z",
    stockKey: Object.freeze({
      companyId: "company-1",
      productId: "product-1",
      warehouseId: "warehouse-1",
      zoneId: null,
      locationId: null,
    }),
    transferId: null,
    reversalOfMovementId: null,
    quantityDelta,
  });
}

test("default policy blocks negative stock valuation", () => {
  assert.equal(DEFAULT_INVENTORY_COST_RESOLUTION_POLICY.negativeStockAction, "block");
  const decision = evaluateInventoryOutboundCostResolution({
    requestedQuantity: "8",
    availableCostedQuantity: "5",
  });
  assert.deepEqual(decision, {
    outcome: "blocked",
    reason: "negative_stock",
    requiresRecalculation: false,
    blocksConfirmation: true,
  });
  assert.throws(
    () => assertInventoryCostResolutionAllowed(decision),
    (error: unknown) => error instanceof InventoryCostResolutionError && error.code === "COST_RESOLUTION_BLOCKED",
  );
});

test("configured defer policy never fabricates cost for negative stock", () => {
  const decision = evaluateInventoryOutboundCostResolution({
    requestedQuantity: "8",
    availableCostedQuantity: "5",
    policy: createInventoryCostResolutionPolicy({ negativeStockAction: "defer" }),
  });
  assert.deepEqual(decision, {
    outcome: "deferred",
    reason: "negative_stock",
    requiresRecalculation: true,
    blocksConfirmation: false,
  });
});

test("outbound cost is resolved only when sufficient costed quantity exists", () => {
  assert.deepEqual(evaluateInventoryOutboundCostResolution({
    requestedQuantity: "2.5",
    availableCostedQuantity: "2.500",
  }), {
    outcome: "resolved",
    reason: null,
    requiresRecalculation: false,
    blocksConfirmation: false,
  });
});

test("upstream unresolved cost defers downstream outbound valuation", () => {
  const decision = evaluateInventoryOutboundCostResolution({
    requestedQuantity: "1",
    availableCostedQuantity: "10",
    hasUpstreamUnresolvedCost: true,
  });
  assert.equal(decision.outcome, "deferred");
  assert.equal(decision.reason, "upstream_cost_unresolved");
  assert.equal(decision.requiresRecalculation, true);
});

test("missing inbound basis is explicit deferred cost rather than zero", () => {
  const decision = evaluateInventoryInboundCostResolution({ hasResolvedCostBasis: false });
  assert.deepEqual(decision, {
    outcome: "deferred",
    reason: "missing_inbound_cost",
    requiresRecalculation: true,
    blocksConfirmation: false,
  });
  const entry = createDeferredInventoryValuationEntry({
    valuationEntryId: "valuation-1",
    movement: movement("3"),
    method: "fifo",
    strategyVersion: 1,
    decision,
  });
  assert.equal(entry.costState, "unresolved");
  assert.equal(entry.unitCost, null);
  assert.equal(entry.totalCost, null);
  assert.equal(entry.unresolvedReason, "missing_inbound_cost");
});

test("resolved inbound basis proceeds without unresolved state", () => {
  assert.deepEqual(evaluateInventoryInboundCostResolution({ hasResolvedCostBasis: true }), {
    outcome: "resolved",
    reason: null,
    requiresRecalculation: false,
    blocksConfirmation: false,
  });
});
