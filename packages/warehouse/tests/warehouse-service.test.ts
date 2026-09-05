import assert from "node:assert/strict";
import test from "node:test";

import {
  WAREHOUSE_APPLICATION_ERROR_CODES,
  WarehouseApplicationError,
  WarehouseService,
  type WarehouseIdempotencyExecutor,
  type WarehouseLocationRepository,
  type WarehousePersistenceState,
  type WarehouseReader,
  type WarehouseRepository,
  type WarehouseUnitOfWork,
  type WarehouseZoneRepository,
} from "../src/index.ts";

const states = new Map<string, WarehousePersistenceState>();
const zones = new Map<string, Awaited<ReturnType<WarehouseZoneRepository["findById"]>> extends infer T ? Exclude<T, null> : never>();
const locations = new Map<string, Awaited<ReturnType<WarehouseLocationRepository["findById"]>> extends infer T ? Exclude<T, null> : never>();
const warehouseKey = (companyId: string, warehouseId: string): string => `${companyId}:${warehouseId}`;

const warehouses: WarehouseRepository = {
  async findById(companyId, warehouseId) { return states.get(warehouseKey(companyId, warehouseId)) ?? null; },
  async findByCode(companyId, code) { return [...states.values()].find((state) => state.warehouse.companyId === companyId && state.warehouse.code === code) ?? null; },
  async findByExternalIdentifier(companyId, namespace, value) {
    return [...states.values()].find((state) => state.warehouse.companyId === companyId && state.externalIdentifiers.some((identifier) => identifier.namespace === namespace && identifier.value === value)) ?? null;
  },
  async add(state) { states.set(warehouseKey(state.warehouse.companyId, state.warehouse.warehouseId), state); },
  async update(state, expectedVersion) {
    const key = warehouseKey(state.warehouse.companyId, state.warehouse.warehouseId);
    const current = states.get(key);
    if (!current || current.version !== expectedVersion) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.concurrencyConflict);
    states.set(key, state);
  },
  async markDeleted(companyId, warehouseId, expectedVersion) {
    const key = warehouseKey(companyId, warehouseId);
    const current = states.get(key);
    if (!current || current.version !== expectedVersion) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.concurrencyConflict);
    states.delete(key);
  },
};

const zoneRepository: WarehouseZoneRepository = {
  async findById(companyId, zoneId) { const zone = zones.get(zoneId) ?? null; return zone?.companyId === companyId ? zone : null; },
  async listByWarehouse(companyId, warehouseId) { return [...zones.values()].filter((zone) => zone.companyId === companyId && zone.warehouseId === warehouseId); },
  async add(zone) { zones.set(zone.zoneId, zone); },
  async update(zone) { zones.set(zone.zoneId, zone); },
  async markDeleted(companyId, warehouseId, zoneId) {
    const zone = zones.get(zoneId);
    if (!zone || zone.companyId !== companyId || zone.warehouseId !== warehouseId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
    zones.delete(zoneId);
  },
};

const locationRepository: WarehouseLocationRepository = {
  async findById(companyId, locationId) { const location = locations.get(locationId) ?? null; return location?.companyId === companyId ? location : null; },
  async listByWarehouse(companyId, warehouseId) { return [...locations.values()].filter((location) => location.companyId === companyId && location.warehouseId === warehouseId); },
  async listByZone(companyId, warehouseId, zoneId) { return [...locations.values()].filter((location) => location.companyId === companyId && location.warehouseId === warehouseId && location.zoneId === zoneId); },
  async add(location) { locations.set(location.locationId, location); },
  async update(location) { locations.set(location.locationId, location); },
  async move(location) { locations.set(location.locationId, location); },
  async markDeleted(companyId, locationId) {
    const location = locations.get(locationId);
    if (!location || location.companyId !== companyId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
    locations.delete(locationId);
  },
};

const unitOfWork: WarehouseUnitOfWork = {
  async execute(work) { return work({ warehouses, zones: zoneRepository, locations: locationRepository }); },
};

const reader: WarehouseReader = {
  async getById() { return null; },
  async getByCode() { return null; },
  async list(query) { return { items: [], page: query.page.page, pageSize: query.page.pageSize, totalCount: 0 }; },
  async select() { return []; },
  async listZones() { return []; },
  async listLocations() { return []; },
};

const idempotentResults = new Map<string, unknown>();
const idempotency: WarehouseIdempotencyExecutor = {
  async run(scope, requestId, work) {
    const key = `${scope}:${requestId}`;
    if (idempotentResults.has(key)) return idempotentResults.get(key) as Awaited<ReturnType<typeof work>>;
    const result = await work();
    idempotentResults.set(key, result);
    return result;
  },
};

const service = new WarehouseService({
  unitOfWork,
  reader,
  idempotency,
  branches: {
    async findById(companyId, branchId) {
      if (branchId === "inactive") return { branchId, companyId, status: "inactive" };
      return { branchId, companyId, status: "active" };
    },
  },
});

const reset = (): void => { states.clear(); zones.clear(); locations.clear(); idempotentResults.clear(); };

test("creates a versioned warehouse and replays the same request idempotently", async () => {
  reset();
  const command = { requestId: "req-create-1", warehouseId: "warehouse-1", companyId: "company-1", code: " wh-1 ", title: "انبار مرکزی", kind: "general" as const, organizationalScope: { mode: "company" as const }, externalIdentifiers: [{ namespace: "erp", value: "A-1" }], occurredAt: "2026-09-04T12:00:00Z" };
  const first = await service.create(command);
  const second = await service.create(command);
  assert.equal(first.version, 1);
  assert.equal(first.code, "WH-1");
  assert.deepEqual(first.externalIdentifiers, [{ namespace: "ERP", value: "A-1" }]);
  assert.deepEqual(second, first);
  assert.equal(states.size, 1);
});

test("rejects duplicate company-scoped code and stale expected version", async () => {
  reset();
  await service.create({ requestId: "req-a", warehouseId: "warehouse-a", companyId: "company-1", code: "WH-1", title: "A", kind: "general", organizationalScope: { mode: "company" }, occurredAt: "2026-09-04T12:00:00Z" });
  await assert.rejects(() => service.create({ requestId: "req-b", warehouseId: "warehouse-b", companyId: "company-1", code: "wh-1", title: "B", kind: "general", organizationalScope: { mode: "company" }, occurredAt: "2026-09-04T12:01:00Z" }), (error: unknown) => error instanceof WarehouseApplicationError && error.code === WAREHOUSE_APPLICATION_ERROR_CODES.duplicateIdentifier);
  await assert.rejects(() => service.update({ requestId: "req-update", warehouseId: "warehouse-a", companyId: "company-1", code: "WH-2", title: "A2", expectedVersion: 2, occurredAt: "2026-09-04T12:02:00Z" }), (error: unknown) => error instanceof WarehouseApplicationError && error.code === WAREHOUSE_APPLICATION_ERROR_CODES.concurrencyConflict);
});

test("enforces active branch assignment and versions real lifecycle changes", async () => {
  reset();
  await assert.rejects(() => service.create({ requestId: "req-inactive-branch", warehouseId: "warehouse-1", companyId: "company-1", code: "WH-1", title: "انبار", kind: "general", organizationalScope: { mode: "branch", branchId: "inactive" }, occurredAt: "2026-09-04T12:00:00Z" }));
  const created = await service.create({ requestId: "req-active-branch", warehouseId: "warehouse-1", companyId: "company-1", code: "WH-1", title: "انبار", kind: "general", organizationalScope: { mode: "branch", branchId: "branch-1" }, occurredAt: "2026-09-04T12:00:00Z" });
  const inactive = await service.changeStatus({ requestId: "req-status-1", warehouseId: created.warehouseId, companyId: created.companyId, targetStatus: "inactive", expectedVersion: created.version, occurredAt: "2026-09-04T12:10:00Z" });
  assert.equal(inactive.status, "inactive");
  assert.equal(inactive.version, 2);
});

test("validates warehouse/zone/parent boundaries for physical master data", async () => {
  reset();
  await service.create({ requestId: "req-create", warehouseId: "warehouse-1", companyId: "company-1", code: "WH-1", title: "انبار", kind: "general", organizationalScope: { mode: "company" }, occurredAt: "2026-09-04T12:00:00Z" });
  await service.createZone({ requestId: "req-zone", zoneId: "zone-1", warehouseId: "warehouse-1", companyId: "company-1", code: "Z-1", title: "زون ۱", occurredAt: "2026-09-04T12:01:00Z" });
  const rack = await service.createLocation({ requestId: "req-rack", locationId: "rack-1", zoneId: "zone-1", warehouseId: "warehouse-1", companyId: "company-1", code: "R-1", title: "قفسه", kind: "rack", occurredAt: "2026-09-04T12:02:00Z" });
  const bin = await service.createLocation({ requestId: "req-bin", locationId: "bin-1", zoneId: "zone-1", warehouseId: "warehouse-1", companyId: "company-1", code: "B-1", title: "خانه", kind: "bin", parentLocationId: rack.locationId, occurredAt: "2026-09-04T12:03:00Z" });
  assert.equal(bin.parentLocationId, rack.locationId);
  assert.equal(bin.zoneId, "zone-1");
});
