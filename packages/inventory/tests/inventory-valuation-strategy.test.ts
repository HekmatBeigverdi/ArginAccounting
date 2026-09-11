import assert from "node:assert/strict";
import test from "node:test";
import {
  INVENTORY_VALUATION_ROUNDING_MODE,
  INVENTORY_VALUATION_STRATEGY_VERSION,
  InventoryValuationStrategyError,
  createInventoryValuationStrategyIdentity,
  fifoInventoryValuationStrategy,
  getInventoryValuationStrategy,
  movingAverageInventoryValuationStrategy,
} from "../src/index.ts";

test("strategy identity freezes method, version and deterministic rounding mode", () => {
  const identity = createInventoryValuationStrategyIdentity("fifo");
  assert.deepEqual(identity, {
    method: "fifo",
    version: INVENTORY_VALUATION_STRATEGY_VERSION,
    roundingMode: INVENTORY_VALUATION_ROUNDING_MODE,
  });
  assert.throws(
    () => createInventoryValuationStrategyIdentity("fifo", 99),
    (error: unknown) => error instanceof InventoryValuationStrategyError && error.code === "VALUATION_STRATEGY_VERSION_UNSUPPORTED",
  );
});

test("FIFO consumes oldest layers first and preserves exact layer remainder", () => {
  let state = { layers: [] as const };
  const first = fifoInventoryValuationStrategy.receive(state, {
    quantity: "10",
    unitCost: "100",
    currency: "IRR",
    layerId: "layer-1",
  });
  const second = fifoInventoryValuationStrategy.receive(first.state, {
    quantity: "5",
    unitCost: "200",
    currency: "IRR",
    layerId: "layer-2",
  });

  const issue = fifoInventoryValuationStrategy.issue(second.state, {
    quantity: "12",
    currency: "IRR",
  });

  assert.equal(issue.totalCost, -1400);
  assert.equal(issue.unitCost, "116.666666666667");
  assert.deepEqual(issue.consumptions, [
    { layerId: "layer-1", quantity: "10", cost: 1000 },
    { layerId: "layer-2", quantity: "2", cost: 400 },
  ]);
  assert.deepEqual(issue.state.layers, [
    { layerId: "layer-2", remainingQuantity: "3", remainingCost: 600, currency: "IRR" },
  ]);
});

test("FIFO partial layer consumption uses deterministic half-away-from-zero rounding and conserves remainder", () => {
  const received = fifoInventoryValuationStrategy.receive({ layers: [] }, {
    quantity: "3",
    unitCost: "1",
    currency: "IRR",
    layerId: "layer-1",
  });

  const firstIssue = fifoInventoryValuationStrategy.issue(received.state, { quantity: "1.5", currency: "IRR" });
  assert.equal(firstIssue.totalCost, -2);
  assert.equal(firstIssue.state.layers[0]?.remainingCost, 1);

  const secondIssue = fifoInventoryValuationStrategy.issue(firstIssue.state, { quantity: "1.5", currency: "IRR" });
  assert.equal(secondIssue.totalCost, -1);
  assert.deepEqual(secondIssue.state.layers, []);
  assert.equal(firstIssue.totalCost + secondIssue.totalCost, -3);
});

test("moving average updates weighted basis and values issue from current pool", () => {
  let state = { quantity: "0", totalCost: 0, currency: "IRR" };
  const first = movingAverageInventoryValuationStrategy.receive(state, {
    quantity: "10",
    unitCost: "100",
    currency: "IRR",
  });
  const second = movingAverageInventoryValuationStrategy.receive(first.state, {
    quantity: "10",
    unitCost: "200",
    currency: "IRR",
  });

  assert.deepEqual(second.state, { quantity: "20", totalCost: 3000, currency: "IRR" });

  const issue = movingAverageInventoryValuationStrategy.issue(second.state, {
    quantity: "4",
    currency: "IRR",
  });

  assert.equal(issue.totalCost, -600);
  assert.equal(issue.unitCost, "150");
  assert.deepEqual(issue.state, { quantity: "16", totalCost: 2400, currency: "IRR" });
});

test("moving average full issue consumes exact remaining monetary basis", () => {
  const state = { quantity: "3", totalCost: 10, currency: "IRR" };
  const issue = movingAverageInventoryValuationStrategy.issue(state, { quantity: "3", currency: "IRR" });
  assert.equal(issue.totalCost, -10);
  assert.equal(issue.unitCost, "3.333333333333");
  assert.deepEqual(issue.state, { quantity: "0", totalCost: 0, currency: "IRR" });
});

test("same ordered inputs always produce identical deterministic outputs", () => {
  const run = () => {
    const first = movingAverageInventoryValuationStrategy.receive(
      { quantity: "0", totalCost: 0, currency: "IRR" },
      { quantity: "2.5", unitCost: "123.4", currency: "IRR" },
    );
    const second = movingAverageInventoryValuationStrategy.receive(
      first.state,
      { quantity: "1.25", unitCost: "200.8", currency: "IRR" },
    );
    return movingAverageInventoryValuationStrategy.issue(second.state, { quantity: "1.75", currency: "IRR" });
  };

  assert.deepEqual(run(), run());
});

test("strategies reject over-consumption instead of inventing negative-stock cost", () => {
  assert.throws(
    () => movingAverageInventoryValuationStrategy.issue(
      { quantity: "1", totalCost: 100, currency: "IRR" },
      { quantity: "2", currency: "IRR" },
    ),
    (error: unknown) => error instanceof InventoryValuationStrategyError && error.code === "VALUATION_STRATEGY_INSUFFICIENT_QUANTITY",
  );

  assert.throws(
    () => fifoInventoryValuationStrategy.issue(
      { layers: [{ layerId: "one", remainingQuantity: "1", remainingCost: 100, currency: "IRR" }] },
      { quantity: "2", currency: "IRR" },
    ),
    (error: unknown) => error instanceof InventoryValuationStrategyError && error.code === "VALUATION_STRATEGY_INSUFFICIENT_QUANTITY",
  );
});

test("strategy lookup is versioned and extensible behind one consumer contract", () => {
  assert.equal(getInventoryValuationStrategy("fifo").identity.method, "fifo");
  assert.equal(getInventoryValuationStrategy("moving_average").identity.method, "moving_average");
});
