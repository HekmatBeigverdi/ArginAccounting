import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  WAREHOUSE_ERP_CONSUMERS,
  WAREHOUSE_ERP_OWNERSHIP,
  WarehouseIntegrationContractError,
  createWarehouseOperationalReference,
  warehouseIntegrationDirection,
} from "../src/index.ts";

test("downstream ERP reference persists durable warehouse hierarchy ids only", () => {
  const reference = createWarehouseOperationalReference({
    warehouseId: " W-1 ",
    zoneId: " Z-1 ",
    locationId: " L-1 ",
  });

  assert.deepEqual(reference, {
    warehouseId: "W-1",
    zoneId: "Z-1",
    locationId: "L-1",
  });
  assert.equal("code" in reference, false);
  assert.equal("title" in reference, false);
});

test("location reference requires its zone context", () => {
  assert.throws(
    () => createWarehouseOperationalReference({ warehouseId: "W-1", locationId: "L-1" }),
    (error: unknown) =>
      error instanceof WarehouseIntegrationContractError &&
      error.code === "warehouse.integration.zone-id.required-for-location",
  );
});

test("warehouse remains provider-only while ERP transaction ownership stays downstream", () => {
  assert.equal(warehouseIntegrationDirection.direction, "warehouse-to-consumer");
  assert.equal(warehouseIntegrationDirection.reverseDependencyAllowed, false);
  assert.equal(warehouseIntegrationDirection.mutableDisplayMetadataAsForeignIdentity, false);

  assert.ok(WAREHOUSE_ERP_CONSUMERS.includes("inventory"));
  assert.ok(WAREHOUSE_ERP_CONSUMERS.includes("purchases"));
  assert.ok(WAREHOUSE_ERP_CONSUMERS.includes("sales"));
  assert.ok(WAREHOUSE_ERP_CONSUMERS.includes("manufacturing"));
  assert.ok(WAREHOUSE_ERP_CONSUMERS.includes("accounting"));
  assert.ok(WAREHOUSE_ERP_CONSUMERS.includes("taxpayer"));

  assert.ok(WAREHOUSE_ERP_OWNERSHIP.warehouse.includes("warehouse-master-data"));
  assert.ok(WAREHOUSE_ERP_OWNERSHIP.inventory.includes("stock-balance"));
  assert.ok(WAREHOUSE_ERP_OWNERSHIP.valuation.includes("cost-layer"));
  assert.ok(WAREHOUSE_ERP_OWNERSHIP.accounting.includes("journal-posting"));
  assert.ok(WAREHOUSE_ERP_OWNERSHIP.synchronization.includes("conflict-resolution"));
});

test("warehouse package has no runtime dependency on future ERP transaction packages", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { dependencies?: Record<string, string> };

  assert.deepEqual(packageJson.dependencies ?? {}, {});
});
