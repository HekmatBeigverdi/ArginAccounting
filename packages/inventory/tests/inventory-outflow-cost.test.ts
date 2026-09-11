import assert from "node:assert/strict";
import test from "node:test";
import {
  InventoryOutflowCostError,
  InventoryValuationStrategyError,
  calculateInventoryOutflowCost,
  createInitialInventoryValuationPolicy,
  createInventoryValuationPolicyTransition,
} from "../src/index.ts";
import type { InventoryStockMovementSnapshot } from "../src/index.ts";

function movement(input: Partial<InventoryStockMovementSnapshot> = {}): InventoryStockMovementSnapshot {
  return {
    movementId: "movement-out-1",
    companyId: "company-1",
    documentId: "document-1",
    lineId: "line-1",
    businessDate: "2026-06-01",
    businessOrder: 10,
    recordedAt: "2026-06-01T10:00:00.000Z",
    stockKey: {
      companyId: "company-1",
      productId: "product-1",
      warehouseId: "warehouse-1",
      zoneId: null,
      locationId: null,
    },
    transferId: null,
    reversalOfMovementId: null,
    quantityDelta: "-12",
    ...input,
  };
}

const movingAveragePolicy = createInitialInventoryValuationPolicy({
  policyId: "policy-ma",
  companyId: "company-1",
  method: "moving_average",
  effectiveFrom: "2026-01-01",
});

const fifoPolicy = createInitialInventoryValuationPolicy({
  policyId: "policy-fifo",
  companyId: "company-1",
  method: "fifo",
  effectiveFrom: "2026-01-01",
});

test("moving-average outflow resolves historical company policy and reduces pool", () => {
  const result = calculateInventoryOutflowCost({
    movement: movement({ quantityDelta: "-4" }),
    policies: [movingAveragePolicy],
    valuationState: {
      method: "moving_average",
      state: { quantity: "20", totalCost: 3000, currency: "IRR" },
    },
  });

  assert.equal(result.method, "moving_average");
  assert.equal(result.policyId, "policy-ma");
  assert.equal(result.totalCost, -600);
  assert.equal(result.unitCost, "150");
  assert.deepEqual(result.nextState, { quantity: "16", totalCost: 2400, currency: "IRR" });
});

test("FIFO outflow returns exact layer consumptions for traceability", () => {
  const result = calculateInventoryOutflowCost({
    movement: movement(),
    policies: [fifoPolicy],
    valuationState: {
      method: "fifo",
      state: {
        layers: [
          { layerId: "layer-1", remainingQuantity: "10", remainingCost: 1000, currency: "IRR" },
          { layerId: "layer-2", remainingQuantity: "5", remainingCost: 1000, currency: "IRR" },
        ],
      },
    },
  });

  assert.equal(result.method, "fifo");
  assert.equal(result.totalCost, -1400);
  assert.deepEqual(result.consumptions, [
    { layerId: "layer-1", quantity: "10", cost: 1000 },
    { layerId: "layer-2", quantity: "2", cost: 400 },
  ]);
  assert.deepEqual(result.nextState.layers, [
    { layerId: "layer-2", remainingQuantity: "3", remainingCost: 600, currency: "IRR" },
  ]);
});

test("policy is resolved by movement business date instead of current policy", () => {
  const next = createInventoryValuationPolicyTransition({
    policyId: "policy-fifo-next",
    current: movingAveragePolicy,
    method: "fifo",
    effectiveFrom: "2027-01-01",
    changeReason: "new fiscal year",
  });

  const result = calculateInventoryOutflowCost({
    movement: movement({ businessDate: "2026-12-31", quantityDelta: "-2" }),
    policies: [movingAveragePolicy, next],
    valuationState: {
      method: "moving_average",
      state: { quantity: "10", totalCost: 1000, currency: "IRR" },
    },
  });

  assert.equal(result.method, "moving_average");
  assert.equal(result.policyId, "policy-ma");
  assert.equal(result.totalCost, -200);
});

test("engine rejects state whose method does not match effective policy", () => {
  assert.throws(
    () => calculateInventoryOutflowCost({
      movement: movement({ quantityDelta: "-1" }),
      policies: [fifoPolicy],
      valuationState: {
        method: "moving_average",
        state: { quantity: "5", totalCost: 500, currency: "IRR" },
      },
    }),
    (error: unknown) => error instanceof InventoryOutflowCostError && error.code === "OUTFLOW_COST_STATE_METHOD_MISMATCH",
  );
});

test("engine delegates insufficient quantity to strategy instead of inventing cost", () => {
  assert.throws(
    () => calculateInventoryOutflowCost({
      movement: movement({ quantityDelta: "-6" }),
      policies: [movingAveragePolicy],
      valuationState: {
        method: "moving_average",
        state: { quantity: "5", totalCost: 500, currency: "IRR" },
      },
    }),
    (error: unknown) => error instanceof InventoryValuationStrategyError && error.code === "VALUATION_STRATEGY_INSUFFICIENT_QUANTITY",
  );
});

test("transfer and reversal outflows stay deferred to their owning steps", () => {
  assert.throws(
    () => calculateInventoryOutflowCost({
      movement: movement({ transferId: "transfer-1" }),
      policies: [fifoPolicy],
      valuationState: { method: "fifo", state: { layers: [] } },
    }),
    (error: unknown) => error instanceof InventoryOutflowCostError && error.code === "OUTFLOW_COST_TRANSFER_DEFERRED",
  );

  assert.throws(
    () => calculateInventoryOutflowCost({
      movement: movement({ reversalOfMovementId: "movement-original" }),
      policies: [fifoPolicy],
      valuationState: { method: "fifo", state: { layers: [] } },
    }),
    (error: unknown) => error instanceof InventoryOutflowCostError && error.code === "OUTFLOW_COST_REVERSAL_DEFERRED",
  );
});
