import assert from "node:assert/strict";
import test from "node:test";
import {
  allowUnintegratedWarehouseDependencies,
  registerWarehouseDependencyGuard,
  type WarehouseDependencyGuard,
} from "../src/index.ts";

const input = {
  companyId: "company-1",
  operation: "warehouse.delete" as const,
  warehouseId: "warehouse-1",
};

test("registered downstream dependency guard replaces the pre-integration fallback", async () => {
  let calls = 0;
  const guard: WarehouseDependencyGuard = {
    async check(received) {
      calls += 1;
      assert.deepEqual(received, input);
      return {
        allowed: false,
        blockers: [{
          kind: "inventory-document",
          code: "inventory.warehouse-dependency.historical-movement",
          count: 1,
          message: "historical Inventory movement exists",
        }],
      };
    },
  };

  registerWarehouseDependencyGuard(guard);
  try {
    const result = await allowUnintegratedWarehouseDependencies.check(input);
    assert.equal(calls, 1);
    assert.equal(result.allowed, false);
    assert.equal(result.blockers[0]?.code, "inventory.warehouse-dependency.historical-movement");
  } finally {
    registerWarehouseDependencyGuard(null);
  }
});

test("cleanup restores the explicit unintegrated fallback", async () => {
  registerWarehouseDependencyGuard(null);
  const result = await allowUnintegratedWarehouseDependencies.check(input);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.blockers, []);
});
