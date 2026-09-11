import assert from "node:assert/strict";
import test from "node:test";
import {
  InventoryInboundCostError,
  allocateInventoryLandedCost,
  createInventoryInboundCostBasisLine,
  createInventoryLandedCostComponent,
  inventoryValuationInboundInputFromCostBasis,
  resolveInventoryInboundCostBasis,
} from "../src/index.ts";

const line = (id: string, quantity: string, baseCost: number, allocationWeight?: string) =>
  createInventoryInboundCostBasisLine({
    basisLineId: id,
    movementId: `mov-${id}`,
    productId: `product-${id}`,
    warehouseId: "warehouse-1",
    quantity,
    baseCost,
    currency: "IRR",
    allocationWeight,
  });

const component = (id: string, amount: number, allocationMethod: "quantity" | "value" | "weight") =>
  createInventoryLandedCostComponent({
    componentId: id,
    source: { sourceType: "freight", sourceId: `source-${id}`, sourceLineId: null },
    amount,
    currency: "IRR",
    allocationMethod,
  });

test("resolves inbound base cost without landed-cost components", () => {
  const [resolved] = resolveInventoryInboundCostBasis({ lines: [line("1", "4", 1000)] });
  assert.ok(resolved);
  assert.equal(resolved.baseCost, 1000);
  assert.equal(resolved.landedCost, 0);
  assert.equal(resolved.totalCost, 1000);
  assert.equal(resolved.unitCost, "250");
});

test("allocates landed cost by quantity and preserves exact monetary total", () => {
  const lines = [line("1", "2", 200), line("2", "3", 300)];
  const allocations = allocateInventoryLandedCost({ lines, components: [component("freight", 101, "quantity")] });
  assert.deepEqual(allocations.map((item) => item.amount), [40, 61]);
  assert.equal(allocations.reduce((total, item) => total + item.amount, 0), 101);
});

test("allocates landed cost by base value", () => {
  const resolved = resolveInventoryInboundCostBasis({
    lines: [line("1", "1", 100), line("2", "1", 300)],
    components: [component("insurance", 80, "value")],
  });
  assert.deepEqual(resolved.map((item) => item.landedCost), [20, 60]);
  assert.deepEqual(resolved.map((item) => item.totalCost), [120, 360]);
});

test("allocates landed cost by explicit weight basis", () => {
  const resolved = resolveInventoryInboundCostBasis({
    lines: [line("1", "10", 1000, "2.5"), line("2", "10", 1000, "7.5")],
    components: [component("freight", 400, "weight")],
  });
  assert.deepEqual(resolved.map((item) => item.landedCost), [100, 300]);
});

test("multiple landed cost components remain traceable to their sources", () => {
  const resolved = resolveInventoryInboundCostBasis({
    lines: [line("1", "2", 200), line("2", "2", 200)],
    components: [component("freight", 100, "quantity"), component("insurance", 40, "value")],
  });
  assert.equal(resolved[0]?.allocations.length, 2);
  assert.equal(resolved[1]?.allocations.length, 2);
  assert.equal(resolved.reduce((sum, item) => sum + item.totalCost, 0), 540);
});

test("resolved basis maps directly to the versioned valuation strategy inbound contract", () => {
  const [resolved] = resolveInventoryInboundCostBasis({
    lines: [line("1", "3", 1000)],
    components: [component("freight", 200, "quantity")],
  });
  assert.ok(resolved);
  const input = inventoryValuationInboundInputFromCostBasis(resolved, "layer-1");
  assert.deepEqual(input, { quantity: "3", unitCost: "400", currency: "IRR", layerId: "layer-1" });
});

test("currency mismatch and missing weight are rejected instead of guessed", () => {
  const lines = [line("1", "1", 100)];
  const foreign = createInventoryLandedCostComponent({
    componentId: "foreign",
    source: { sourceType: "freight", sourceId: "f-1", sourceLineId: null },
    amount: 10,
    currency: "USD",
    allocationMethod: "quantity",
  });
  assert.throws(
    () => allocateInventoryLandedCost({ lines, components: [foreign] }),
    (error: unknown) => error instanceof InventoryInboundCostError && error.code === "INBOUND_COST_CURRENCY_MISMATCH",
  );
  assert.throws(
    () => allocateInventoryLandedCost({ lines, components: [component("weight", 10, "weight")] }),
    (error: unknown) => error instanceof InventoryInboundCostError && error.code === "INBOUND_COST_ALLOCATION_INVALID",
  );
});
