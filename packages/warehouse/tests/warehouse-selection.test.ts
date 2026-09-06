import assert from "node:assert/strict";
import test from "node:test";

import {
  WAREHOUSE_SELECTOR_CONSUMERS,
  WarehouseSelectionContractError,
  buildWarehouseLocationSelectorQuery,
  buildWarehouseSelectorQuery,
  buildWarehouseZoneSelectorQuery,
  isWarehouseVisibleToBranch,
  toWarehouseLocationSelectionReference,
  toWarehouseSelectionReference,
  toWarehouseZoneSelectionReference,
  type WarehouseListItemDto,
} from "../src/index.ts";

const companyWide: WarehouseListItemDto = {
  warehouseId: "W-COMPANY",
  code: "MAIN",
  title: "انبار اصلی",
  kind: "general",
  status: "active",
  organizationalScope: { mode: "company" },
  version: 1,
};

const branchWarehouse: WarehouseListItemDto = {
  warehouseId: "W-B1",
  code: "B1-WH",
  title: "انبار شعبه یک",
  kind: "general",
  status: "active",
  organizationalScope: { mode: "branch", branchId: "B1" },
  version: 1,
};

test("selector exposes the frozen future consumer list", () => {
  assert.deepEqual(WAREHOUSE_SELECTOR_CONSUMERS, [
    "inventory",
    "purchases",
    "sales",
    "manufacturing",
    "transfer",
    "adjustment",
  ]);
});

test("selector without branch is fail-safe company-wide only and active-only", () => {
  const query = buildWarehouseSelectorQuery(" C1 ", " main ", {
    consumer: "inventory",
  });
  assert.equal(query.companyId, "C1");
  assert.equal(query.search, "main");
  assert.equal(query.companyWideOnly, true);
  assert.deepEqual(query.statuses, ["active"]);
  assert.equal(query.limit, 20);
});

test("branch selector includes only that branch plus company-wide by policy", () => {
  const query = buildWarehouseSelectorQuery("C1", null, {
    consumer: "sales",
    branchId: " B1 ",
  });
  assert.equal(query.branchId, "B1");
  assert.equal(query.includeCompanyWide, true);
  assert.equal(query.companyWideOnly, undefined);

  assert.equal(isWarehouseVisibleToBranch(companyWide, "B1"), true);
  assert.equal(isWarehouseVisibleToBranch(branchWarehouse, "B1"), true);
  assert.equal(isWarehouseVisibleToBranch(branchWarehouse, "B2"), false);
  assert.equal(isWarehouseVisibleToBranch(branchWarehouse, null), false);
});

test("selection references preserve durable ids rather than display codes", () => {
  const warehouse = toWarehouseSelectionReference(companyWide);
  assert.equal(warehouse.warehouseId, "W-COMPANY");
  assert.equal(warehouse.code, "MAIN");

  const zone = toWarehouseZoneSelectionReference({
    zoneId: "Z1",
    warehouseId: "W-COMPANY",
    companyId: "C1",
    code: "Z-01",
    title: "ناحیه ۱",
    description: null,
    status: "active",
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
  });
  assert.deepEqual(zone, { warehouseId: "W-COMPANY", zoneId: "Z1", code: "Z-01", title: "ناحیه ۱" });

  const location = toWarehouseLocationSelectionReference({
    locationId: "L1",
    zoneId: "Z1",
    warehouseId: "W-COMPANY",
    companyId: "C1",
    code: "BIN-01",
    title: "قفسه ۱",
    description: null,
    kind: "bin",
    parentLocationId: null,
    status: "active",
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
  });
  assert.equal(location.locationId, "L1");
  assert.equal(location.zoneId, "Z1");
});

test("zone and location selector builders always request active physical nodes", () => {
  assert.deepEqual(buildWarehouseZoneSelectorQuery("C1", "W1").statuses, ["active"]);
  const query = buildWarehouseLocationSelectorQuery({
    companyId: "C1",
    warehouseId: "W1",
    zoneId: "Z1",
    kinds: ["rack", "bin", "rack"],
  });
  assert.deepEqual(query.statuses, ["active"]);
  assert.deepEqual(query.kinds, ["rack", "bin"]);
});

test("invalid selector limits are rejected at the shared contract boundary", () => {
  assert.throws(
    () => buildWarehouseSelectorQuery("C1", null, { consumer: "transfer", limit: 101 }),
    (error: unknown) => error instanceof WarehouseSelectionContractError && error.code === "warehouse.selection.limit.invalid",
  );
});
