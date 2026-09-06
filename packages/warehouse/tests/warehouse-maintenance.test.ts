import assert from "node:assert/strict";
import test from "node:test";

import {
  WAREHOUSE_DOMAIN_ERROR_CODES,
  WarehouseDomainError,
  assertLocationParentAcyclic,
  createWarehouseLocation,
  createWarehouseZone,
  moveWarehouseLocation,
  setWarehouseLocationStatus,
  setWarehouseZoneStatus,
  updateWarehouseLocation,
  updateWarehouseZone,
} from "../src/index.ts";

const warehouse = Object.freeze({ warehouseId: "W1", companyId: "C1" });
const zone = createWarehouseZone({
  zoneId: "Z1",
  warehouse,
  code: " z-1 ",
  title: "ناحیه یک",
  createdAt: "2026-09-05T10:00:00Z",
});

const location = createWarehouseLocation({
  locationId: "L1",
  zone,
  warehouse,
  code: " l-1 ",
  title: "قفسه یک",
  kind: "rack",
  createdAt: "2026-09-05T10:01:00Z",
});

test("updates zone identity fields and lifecycle deterministically", () => {
  const updated = updateWarehouseZone({
    zone,
    code: " z-2 ",
    title: "  ناحیه دوم  ",
    description: " توضیح ",
    occurredAt: "2026-09-05T10:02:00Z",
  });
  assert.equal(updated.code, "Z-2");
  assert.equal(updated.title, "ناحیه دوم");
  assert.equal(updated.description, "توضیح");

  const inactive = setWarehouseZoneStatus(updated, "inactive", "2026-09-05T10:03:00Z");
  assert.equal(inactive.status, "inactive");
});

test("updates location fields without changing its structural container", () => {
  const updated = updateWarehouseLocation({
    location,
    code: " l-2 ",
    title: "موقعیت دوم",
    kind: "shelf",
    description: "طبقه دوم",
    occurredAt: "2026-09-05T10:04:00Z",
  });
  assert.equal(updated.code, "L-2");
  assert.equal(updated.kind, "shelf");
  assert.equal(updated.zoneId, "Z1");
  assert.equal(updated.warehouseId, "W1");

  const inactive = setWarehouseLocationStatus(updated, "inactive", "2026-09-05T10:05:00Z");
  assert.equal(inactive.status, "inactive");
});

test("moves a location only through an explicit target warehouse and zone", () => {
  const targetWarehouse = Object.freeze({ warehouseId: "W2", companyId: "C1" });
  const targetZone = createWarehouseZone({
    zoneId: "Z2",
    warehouse: targetWarehouse,
    code: "Z2",
    title: "ناحیه مقصد",
    createdAt: "2026-09-05T10:06:00Z",
  });
  const moved = moveWarehouseLocation({
    location,
    targetZone,
    targetWarehouse,
    parentLocationId: null,
    occurredAt: "2026-09-05T10:07:00Z",
  });
  assert.equal(moved.warehouseId, "W2");
  assert.equal(moved.zoneId, "Z2");
  assert.equal(moved.parentLocationId, null);
});

test("rejects cyclic location parent assignment", () => {
  const parents = new Map<string, string | null>([
    ["L2", "L1"],
    ["L3", "L2"],
  ]);
  assert.throws(
    () => assertLocationParentAcyclic("L1", "L3", parents),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.parentLocationCycle,
  );
});
