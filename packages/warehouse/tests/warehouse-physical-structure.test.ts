import assert from "node:assert/strict";
import test from "node:test";

import {
  WAREHOUSE_DOMAIN_ERROR_CODES,
  WarehouseDomainError,
  createWarehouse,
  createWarehouseLocation,
  createWarehouseZone,
  rehydrateWarehouseLocation,
  rehydrateWarehouseZone,
  warehouseReferenceFrom,
} from "../src/index.ts";

const createdAt = "2026-09-04T10:00:00.000Z";

const warehouse = createWarehouse({
  warehouseId: "warehouse-001",
  companyId: "company-001",
  code: "WH-1",
  title: "انبار مرکزی",
  createdAt,
});

const warehouseRef = warehouseReferenceFrom(warehouse);

const zone = createWarehouseZone({
  zoneId: "zone-001",
  warehouse: warehouseRef,
  code: " z-a ",
  title: "  سالن A  ",
  description: "  سالن   اصلی  ",
  createdAt,
});

test("creates immutable warehouse zones under a durable warehouse reference", () => {
  assert.deepEqual(zone, {
    zoneId: "zone-001",
    warehouseId: "warehouse-001",
    companyId: "company-001",
    code: "Z-A",
    title: "سالن A",
    description: "سالن اصلی",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  });
  assert.equal(Object.isFrozen(zone), true);
});

test("creates typed locations and supports future nested physical hierarchy", () => {
  const rack = createWarehouseLocation({
    locationId: "location-rack-01",
    zone,
    warehouse: warehouseRef,
    code: "rack-01",
    title: "قفسه ۱",
    kind: "rack",
    createdAt,
  });

  const bin = createWarehouseLocation({
    locationId: "location-bin-01",
    zone,
    warehouse: warehouseRef,
    parentLocationId: rack.locationId,
    code: "bin-01",
    title: "خانه ۱",
    kind: "bin",
    createdAt,
  });

  assert.equal(rack.parentLocationId, null);
  assert.equal(bin.parentLocationId, rack.locationId);
  assert.equal(bin.zoneId, zone.zoneId);
  assert.equal(bin.warehouseId, warehouse.warehouseId);
  assert.equal(Object.isFrozen(bin), true);
});

test("rejects a zone and warehouse reference from different companies or warehouses", () => {
  assert.throws(
    () =>
      createWarehouseLocation({
        locationId: "location-1",
        zone,
        warehouse: { warehouseId: "warehouse-001", companyId: "company-999" },
        code: "L-1",
        title: "محل",
        kind: "bin",
        createdAt,
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.physicalCompanyMismatch,
  );

  assert.throws(
    () =>
      createWarehouseLocation({
        locationId: "location-1",
        zone,
        warehouse: { warehouseId: "warehouse-999", companyId: "company-001" },
        code: "L-1",
        title: "محل",
        kind: "bin",
        createdAt,
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.physicalWarehouseMismatch,
  );
});

test("rejects invalid location kinds and parent self-reference", () => {
  assert.throws(
    () =>
      createWarehouseLocation({
        locationId: "location-1",
        zone,
        warehouse: warehouseRef,
        code: "L-1",
        title: "محل",
        kind: "room" as never,
        createdAt,
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.locationKindInvalid,
  );

  assert.throws(
    () =>
      createWarehouseLocation({
        locationId: "location-1",
        zone,
        warehouse: warehouseRef,
        parentLocationId: "location-1",
        code: "L-1",
        title: "محل",
        kind: "bin",
        createdAt,
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.parentLocationSelfReference,
  );
});

test("rehydration validates historical physical references and timestamp ordering", () => {
  const inactiveZone = rehydrateWarehouseZone({
    ...zone,
    status: "inactive",
    updatedAt: "2026-09-04T11:00:00.000Z",
  });

  const location = rehydrateWarehouseLocation(
    {
      locationId: "location-1",
      zoneId: inactiveZone.zoneId,
      warehouseId: inactiveZone.warehouseId,
      companyId: inactiveZone.companyId,
      parentLocationId: null,
      code: " l-1 ",
      title: " محل ۱ ",
      kind: "shelf",
      description: null,
      status: "inactive",
      createdAt,
      updatedAt: "2026-09-04T11:00:00.000Z",
    },
    inactiveZone,
  );

  assert.equal(location.code, "L-1");
  assert.equal(location.status, "inactive");

  assert.throws(
    () =>
      rehydrateWarehouseLocation(
        { ...location, updatedAt: "2026-09-04T09:59:59.000Z" },
        inactiveZone,
      ),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.timestampOrderInvalid,
  );
});

test("rehydration rejects a location attached to a different zone", () => {
  const otherZone = createWarehouseZone({
    zoneId: "zone-002",
    warehouse: warehouseRef,
    code: "Z-B",
    title: "سالن B",
    createdAt,
  });

  assert.throws(
    () =>
      rehydrateWarehouseLocation(
        {
          locationId: "location-1",
          zoneId: zone.zoneId,
          warehouseId: warehouse.warehouseId,
          companyId: warehouse.companyId,
          parentLocationId: null,
          code: "L-1",
          title: "محل",
          kind: "bin",
          description: null,
          status: "active",
          createdAt,
          updatedAt: createdAt,
        },
        otherZone,
      ),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.zoneReferenceMismatch,
  );
});
