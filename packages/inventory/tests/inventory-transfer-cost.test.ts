import assert from "node:assert/strict";
import test from "node:test";
import {
  InventoryTransferCostError,
  calculateInventoryTransferCost,
  createInitialInventoryValuationPolicy,
  type InventoryStockMovementSnapshot,
} from "../src/index.ts";

const policy = createInitialInventoryValuationPolicy({
  policyId: "policy-1",
  companyId: "company-1",
  method: "fifo",
  effectiveFrom: "2026-01-01",
});

function movement(input: {
  movementId: string;
  warehouseId: string;
  quantityDelta: string;
  transferId?: string | null;
  businessDate?: string;
}): InventoryStockMovementSnapshot {
  return Object.freeze({
    movementId: input.movementId,
    companyId: "company-1",
    documentId: "transfer-doc-1",
    lineId: "line-1",
    businessDate: input.businessDate ?? "2026-09-12",
    businessOrder: 10,
    recordedAt: "2026-09-12T08:00:00.000Z",
    stockKey: Object.freeze({
      companyId: "company-1",
      productId: "product-1",
      warehouseId: input.warehouseId,
      zoneId: null,
      locationId: null,
    }),
    transferId: input.transferId ?? "transfer-1",
    reversalOfMovementId: null,
    quantityDelta: input.quantityDelta,
  });
}

test("FIFO transfer carries exact consumed cost into destination layers", () => {
  const source = movement({ movementId: "move-source", warehouseId: "warehouse-a", quantityDelta: "-12" });
  const destination = movement({ movementId: "move-destination", warehouseId: "warehouse-b", quantityDelta: "12" });

  const result = calculateInventoryTransferCost({
    sourceMovement: source,
    destinationMovement: destination,
    policies: [policy],
    sourceState: {
      method: "fifo",
      state: {
        layers: [
          { layerId: "src-layer-1", remainingQuantity: "10", remainingCost: 1000, currency: "IRR" },
          { layerId: "src-layer-2", remainingQuantity: "5", remainingCost: 1000, currency: "IRR" },
        ],
      },
    },
    destinationState: { method: "fifo", state: { layers: [] } },
    destinationLayerIds: ["dst-layer-1", "dst-layer-2"],
  });

  assert.equal(result.sourceTotalCost, -1400);
  assert.equal(result.destinationTotalCost, 1400);
  assert.equal(result.netTotalCost, 0);
  assert.deepEqual(result.sourceConsumptions, [
    { layerId: "src-layer-1", quantity: "10", cost: 1000 },
    { layerId: "src-layer-2", quantity: "2", cost: 400 },
  ]);
  assert.deepEqual(result.destinationLayers, [
    { layerId: "dst-layer-1", remainingQuantity: "10", remainingCost: 1000, currency: "IRR" },
    { layerId: "dst-layer-2", remainingQuantity: "2", remainingCost: 400, currency: "IRR" },
  ]);
});

test("FIFO transfer appends carried layers after existing destination cost basis", () => {
  const source = movement({ movementId: "move-source", warehouseId: "warehouse-a", quantityDelta: "-2" });
  const destination = movement({ movementId: "move-destination", warehouseId: "warehouse-b", quantityDelta: "2" });

  const result = calculateInventoryTransferCost({
    sourceMovement: source,
    destinationMovement: destination,
    policies: [policy],
    sourceState: {
      method: "fifo",
      state: { layers: [{ layerId: "src", remainingQuantity: "5", remainingCost: 500, currency: "IRR" }] },
    },
    destinationState: {
      method: "fifo",
      state: { layers: [{ layerId: "existing", remainingQuantity: "3", remainingCost: 600, currency: "IRR" }] },
    },
    destinationLayerIds: ["transferred"],
  });

  assert.deepEqual(result.destinationNextState, {
    method: "fifo",
    state: {
      layers: [
        { layerId: "existing", remainingQuantity: "3", remainingCost: 600, currency: "IRR" },
        { layerId: "transferred", remainingQuantity: "2", remainingCost: 200, currency: "IRR" },
      ],
    },
  });
});

test("moving average transfer moves exact monetary amount without re-rounding", () => {
  const movingPolicy = createInitialInventoryValuationPolicy({
    policyId: "policy-ma",
    companyId: "company-1",
    method: "moving_average",
    effectiveFrom: "2026-01-01",
  });
  const source = movement({ movementId: "move-source", warehouseId: "warehouse-a", quantityDelta: "-1" });
  const destination = movement({ movementId: "move-destination", warehouseId: "warehouse-b", quantityDelta: "1" });

  const result = calculateInventoryTransferCost({
    sourceMovement: source,
    destinationMovement: destination,
    policies: [movingPolicy],
    sourceState: { method: "moving_average", state: { quantity: "3", totalCost: 10, currency: "IRR" } },
    destinationState: { method: "moving_average", state: { quantity: "2", totalCost: 8, currency: "IRR" } },
  });

  assert.equal(result.sourceTotalCost, -3);
  assert.equal(result.destinationTotalCost, 3);
  assert.equal(result.netTotalCost, 0);
  assert.deepEqual(result.sourceNextState, {
    method: "moving_average",
    state: { quantity: "2", totalCost: 7, currency: "IRR" },
  });
  assert.deepEqual(result.destinationNextState, {
    method: "moving_average",
    state: { quantity: "3", totalCost: 11, currency: "IRR" },
  });
});

test("transfer rejects non-conserving quantity pair", () => {
  assert.throws(
    () => calculateInventoryTransferCost({
      sourceMovement: movement({ movementId: "s", warehouseId: "warehouse-a", quantityDelta: "-5" }),
      destinationMovement: movement({ movementId: "d", warehouseId: "warehouse-b", quantityDelta: "4" }),
      policies: [policy],
      sourceState: {
        method: "fifo",
        state: { layers: [{ layerId: "src", remainingQuantity: "5", remainingCost: 500, currency: "IRR" }] },
      },
      destinationState: { method: "fifo", state: { layers: [] } },
      destinationLayerIds: ["dst"],
    }),
    (error: unknown) => error instanceof InventoryTransferCostError && error.code === "TRANSFER_COST_MOVEMENT_PAIR_INVALID",
  );
});

test("FIFO transfer requires one unique destination layer id per source consumption", () => {
  assert.throws(
    () => calculateInventoryTransferCost({
      sourceMovement: movement({ movementId: "s", warehouseId: "warehouse-a", quantityDelta: "-12" }),
      destinationMovement: movement({ movementId: "d", warehouseId: "warehouse-b", quantityDelta: "12" }),
      policies: [policy],
      sourceState: {
        method: "fifo",
        state: {
          layers: [
            { layerId: "src-1", remainingQuantity: "10", remainingCost: 1000, currency: "IRR" },
            { layerId: "src-2", remainingQuantity: "5", remainingCost: 1000, currency: "IRR" },
          ],
        },
      },
      destinationState: { method: "fifo", state: { layers: [] } },
      destinationLayerIds: ["only-one"],
    }),
    (error: unknown) => error instanceof InventoryTransferCostError && error.code === "TRANSFER_COST_DESTINATION_LAYER_ID_INVALID",
  );
});

test("transfer uses policy effective for transfer business date", () => {
  const fifoPolicy = createInitialInventoryValuationPolicy({
    policyId: "old",
    companyId: "company-1",
    method: "fifo",
    effectiveFrom: "2026-01-01",
  });
  const source = movement({ movementId: "s", warehouseId: "warehouse-a", quantityDelta: "-1", businessDate: "2026-09-12" });
  const destination = movement({ movementId: "d", warehouseId: "warehouse-b", quantityDelta: "1", businessDate: "2026-09-12" });

  const result = calculateInventoryTransferCost({
    sourceMovement: source,
    destinationMovement: destination,
    policies: [fifoPolicy],
    sourceState: {
      method: "fifo",
      state: { layers: [{ layerId: "src", remainingQuantity: "1", remainingCost: 50, currency: "IRR" }] },
    },
    destinationState: { method: "fifo", state: { layers: [] } },
    destinationLayerIds: ["dst"],
  });

  assert.equal(result.policyId, "old");
  assert.equal(result.method, "fifo");
});
