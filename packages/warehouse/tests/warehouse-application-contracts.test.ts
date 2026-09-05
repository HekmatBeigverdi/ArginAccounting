import assert from "node:assert/strict";
import test from "node:test";

import {
  WAREHOUSE_QUERY_LIMITS,
  type WarehousePersistenceState,
  type WarehouseRepository,
} from "../src/index.ts";

test("warehouse query limits are bounded and immutable", () => {
  assert.deepEqual(WAREHOUSE_QUERY_LIMITS, {
    minPageSize: 1,
    maxPageSize: 200,
    defaultPageSize: 50,
    minSelectorLimit: 1,
    maxSelectorLimit: 100,
    defaultSelectorLimit: 20,
  });
  assert.equal(Object.isFrozen(WAREHOUSE_QUERY_LIMITS), true);
});

test("repository contract remains company scoped and version aware", async () => {
  const calls: string[] = [];
  const repository: WarehouseRepository = {
    async findById(companyId, warehouseId) {
      calls.push(`id:${companyId}:${warehouseId}`);
      return null;
    },
    async findByCode(companyId, code) {
      calls.push(`code:${companyId}:${code}`);
      return null;
    },
    async findByExternalIdentifier(companyId, namespace, value) {
      calls.push(`external:${companyId}:${namespace}:${value}`);
      return null;
    },
    async add(_state: WarehousePersistenceState) {
      calls.push("add");
    },
    async update(_state: WarehousePersistenceState, expectedVersion) {
      calls.push(`update:${expectedVersion}`);
    },
    async markDeleted(companyId, warehouseId, expectedVersion, deletedAt) {
      calls.push(`delete:${companyId}:${warehouseId}:${expectedVersion}:${deletedAt}`);
    },
  };

  await repository.findById("company-1", "warehouse-1");
  await repository.findByCode("company-1", "WH-1");
  await repository.findByExternalIdentifier("company-1", "ERP", "A-1");

  assert.deepEqual(calls, [
    "id:company-1:warehouse-1",
    "code:company-1:WH-1",
    "external:company-1:ERP:A-1",
  ]);
});
