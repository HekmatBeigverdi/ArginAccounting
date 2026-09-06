import assert from "node:assert/strict";
import test from "node:test";

import {
  WAREHOUSE_APPLICATION_ERROR_CODES,
  WarehouseApplicationError,
  WarehouseService,
  type WarehouseDependencyGuard,
  type WarehouseIdempotencyExecutor,
  type WarehouseLocationRepository,
  type WarehousePersistenceState,
  type WarehouseReader,
  type WarehouseRepository,
  type WarehouseUnitOfWork,
  type WarehouseZoneRepository,
} from "../src/index.ts";

const states = new Map<string, WarehousePersistenceState>();
const zones = new Map<string, NonNullable<Awaited<ReturnType<WarehouseZoneRepository["findById"]>>>>();
const locations = new Map<string, NonNullable<Awaited<ReturnType<WarehouseLocationRepository["findById"]>>>>();
const idempotentResults = new Map<string, unknown>();
let unitOfWorkCalls = 0;

const key = (companyId: string, warehouseId: string): string => `${companyId}:${warehouseId}`;

const warehouses: WarehouseRepository = {
  async findById(companyId, warehouseId) { return states.get(key(companyId, warehouseId)) ?? null; },
  async findByCode(companyId, code) {
    return [...states.values()].find((state) => state.warehouse.companyId === companyId && state.warehouse.code === code.toUpperCase()) ?? null;
  },
  async findByExternalIdentifier(companyId, namespace, value) {
    return [...states.values()].find((state) => state.warehouse.companyId === companyId && state.externalIdentifiers.some((item) => item.namespace === namespace.toUpperCase() && item.value === value)) ?? null;
  },
  async add(state) { states.set(key(state.warehouse.companyId, state.warehouse.warehouseId), state); },
  async update(state, expectedVersion) {
    const current = states.get(key(state.warehouse.companyId, state.warehouse.warehouseId));
    if (!current || current.version !== expectedVersion) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.concurrencyConflict);
    states.set(key(state.warehouse.companyId, state.warehouse.warehouseId), state);
  },
  async markDeleted(companyId, warehouseId, expectedVersion) {
    const current = states.get(key(companyId, warehouseId));
    if (!current || current.version !== expectedVersion) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.concurrencyConflict);
    states.delete(key(companyId, warehouseId));
  },
};

const zoneRepository: WarehouseZoneRepository = {
  async findById(companyId, zoneId) { const value = zones.get(zoneId) ?? null; return value?.companyId === companyId ? value : null; },
  async listByWarehouse(companyId, warehouseId) { return [...zones.values()].filter((value) => value.companyId === companyId && value.warehouseId === warehouseId); },
  async add(value) { zones.set(value.zoneId, value); },
  async update(value) { zones.set(value.zoneId, value); },
  async markDeleted(companyId, warehouseId, zoneId) {
    const value = zones.get(zoneId);
    if (!value || value.companyId !== companyId || value.warehouseId !== warehouseId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
    zones.delete(zoneId);
  },
};

const locationRepository: WarehouseLocationRepository = {
  async findById(companyId, locationId) { const value = locations.get(locationId) ?? null; return value?.companyId === companyId ? value : null; },
  async listByWarehouse(companyId, warehouseId) { return [...locations.values()].filter((value) => value.companyId === companyId && value.warehouseId === warehouseId); },
  async listByZone(companyId, warehouseId, zoneId) { return [...locations.values()].filter((value) => value.companyId === companyId && value.warehouseId === warehouseId && value.zoneId === zoneId); },
  async add(value) { locations.set(value.locationId, value); },
  async update(value) { locations.set(value.locationId, value); },
  async move(value) { locations.set(value.locationId, value); },
  async markDeleted(companyId, locationId) {
    const value = locations.get(locationId);
    if (!value || value.companyId !== companyId) throw new WarehouseApplicationError(WAREHOUSE_APPLICATION_ERROR_CODES.notFound);
    locations.delete(locationId);
  },
};

const unitOfWork: WarehouseUnitOfWork = {
  async execute(work) {
    unitOfWorkCalls += 1;
    return work({ warehouses, zones: zoneRepository, locations: locationRepository });
  },
};

const reader: WarehouseReader = {
  async getById() { return null; },
  async getByCode() { return null; },
  async list(query) { return { items: [], page: query.page.page, pageSize: query.page.pageSize, totalCount: 0 }; },
  async select() { return []; },
  async listZones() { return []; },
  async listLocations() { return []; },
};

const idempotency: WarehouseIdempotencyExecutor = {
  async run(scope, requestId, work) {
    const idempotencyKey = `${scope}:${requestId}`;
    if (idempotentResults.has(idempotencyKey)) return idempotentResults.get(idempotencyKey) as Awaited<ReturnType<typeof work>>;
    const result = await work();
    idempotentResults.set(idempotencyKey, result);
    return result;
  },
};

const allowGuard: WarehouseDependencyGuard = {
  async check() { return { allowed: true, blockers: [] }; },
};

function createService(dependencyGuard: WarehouseDependencyGuard = allowGuard): WarehouseService {
  return new WarehouseService({
    unitOfWork,
    reader,
    idempotency,
    dependencyGuard,
    branches: {
      async findById(companyId, branchId) { return { companyId, branchId, status: "active" }; },
    },
  });
}

function reset(): void {
  states.clear();
  zones.clear();
  locations.clear();
  idempotentResults.clear();
  unitOfWorkCalls = 0;
}

async function createBase(service: WarehouseService, companyId = "company-1", warehouseId = "warehouse-1") {
  return service.create({
    requestId: `create-${companyId}-${warehouseId}`,
    companyId,
    warehouseId,
    code: `WH-${warehouseId}`,
    title: "انبار اصلی",
    kind: "general",
    organizationalScope: { mode: "company" },
    occurredAt: "2026-09-06T06:00:00.000Z",
  });
}

test("wrong-company mutation is rejected and cannot modify the owning company state", async () => {
  reset();
  const service = createService();
  const created = await createBase(service);

  await assert.rejects(
    () => service.update({
      requestId: "wrong-company-update",
      companyId: "company-2",
      warehouseId: created.warehouseId,
      code: "ILLEGAL",
      title: "نباید تغییر کند",
      expectedVersion: created.version,
      occurredAt: "2026-09-06T06:01:00.000Z",
    }),
    (error: unknown) => error instanceof WarehouseApplicationError && error.code === WAREHOUSE_APPLICATION_ERROR_CODES.notFound,
  );

  const stored = states.get(key("company-1", created.warehouseId));
  assert.equal(stored?.warehouse.code, created.code);
  assert.equal(stored?.version, 1);
});

test("multiple real mutations form a strict optimistic-version chain", async () => {
  reset();
  const service = createService();
  const created = await createBase(service);
  const updated = await service.update({
    requestId: "version-update",
    companyId: created.companyId,
    warehouseId: created.warehouseId,
    code: "CHAIN-2",
    title: "نسخه دو",
    expectedVersion: 1,
    occurredAt: "2026-09-06T06:01:00.000Z",
  });
  const inactive = await service.changeStatus({
    requestId: "version-status",
    companyId: created.companyId,
    warehouseId: created.warehouseId,
    targetStatus: "inactive",
    expectedVersion: 2,
    occurredAt: "2026-09-06T06:02:00.000Z",
  });
  const scoped = await service.changeScope({
    requestId: "version-scope",
    companyId: created.companyId,
    warehouseId: created.warehouseId,
    organizationalScope: { mode: "branch", branchId: "branch-1" },
    expectedVersion: 3,
    occurredAt: "2026-09-06T06:03:00.000Z",
  });

  assert.deepEqual([created.version, updated.version, inactive.version, scoped.version], [1, 2, 3, 4]);
  await assert.rejects(
    () => service.changeStatus({
      requestId: "stale-after-chain",
      companyId: created.companyId,
      warehouseId: created.warehouseId,
      targetStatus: "active",
      expectedVersion: 2,
      occurredAt: "2026-09-06T06:04:00.000Z",
    }),
    (error: unknown) => error instanceof WarehouseApplicationError && error.code === WAREHOUSE_APPLICATION_ERROR_CODES.concurrencyConflict,
  );
});

test("invalid outer context is rejected before entering the unit of work", async () => {
  reset();
  const service = createService();

  await assert.rejects(
    () => service.create({
      requestId: "invalid-company",
      companyId: "   ",
      warehouseId: "warehouse-invalid",
      code: "INVALID",
      title: "نامعتبر",
      kind: "general",
      organizationalScope: { mode: "company" },
      occurredAt: "2026-09-06T06:00:00.000Z",
    }),
    (error: unknown) => error instanceof WarehouseApplicationError && error.code === WAREHOUSE_APPLICATION_ERROR_CODES.invalidRequest,
  );

  assert.equal(unitOfWorkCalls, 0);
});

test("dependency guard blocks protected lifecycle mutation and receives durable identity", async () => {
  reset();
  const checks: Array<{ operation: string; warehouseId: string; companyId: string }> = [];
  const blockingGuard: WarehouseDependencyGuard = {
    async check(input) {
      checks.push({ operation: input.operation, warehouseId: input.warehouseId, companyId: input.companyId });
      return {
        allowed: false,
        blockers: [{ kind: "stock-balance", code: "stock.non-zero", count: 1, message: "موجودی انبار صفر نیست." }],
      };
    },
  };
  const service = createService(blockingGuard);
  const created = await createBase(service);

  await assert.rejects(
    () => service.changeStatus({
      requestId: "blocked-deactivate",
      companyId: created.companyId,
      warehouseId: created.warehouseId,
      targetStatus: "inactive",
      expectedVersion: created.version,
      occurredAt: "2026-09-06T06:01:00.000Z",
    }),
    (error: unknown) => error instanceof WarehouseApplicationError && error.code === WAREHOUSE_APPLICATION_ERROR_CODES.dependencyBlocked,
  );

  assert.deepEqual(checks, [{ operation: "warehouse.deactivate", warehouseId: created.warehouseId, companyId: created.companyId }]);
  assert.equal(states.get(key(created.companyId, created.warehouseId))?.version, 1);
});

test("same request id is isolated by company and mutation scope", async () => {
  reset();
  const service = createService();
  const first = await service.create({
    requestId: "same-request",
    companyId: "company-1",
    warehouseId: "warehouse-a",
    code: "A",
    title: "A",
    kind: "general",
    organizationalScope: { mode: "company" },
    occurredAt: "2026-09-06T06:00:00.000Z",
  });
  const second = await service.create({
    requestId: "same-request",
    companyId: "company-2",
    warehouseId: "warehouse-b",
    code: "B",
    title: "B",
    kind: "general",
    organizationalScope: { mode: "company" },
    occurredAt: "2026-09-06T06:00:00.000Z",
  });
  const updated = await service.update({
    requestId: "same-request",
    companyId: first.companyId,
    warehouseId: first.warehouseId,
    code: "A2",
    title: "A2",
    expectedVersion: 1,
    occurredAt: "2026-09-06T06:01:00.000Z",
  });

  assert.equal(first.warehouseId, "warehouse-a");
  assert.equal(second.warehouseId, "warehouse-b");
  assert.equal(updated.version, 2);
  assert.equal(states.size, 2);
});

test("active child location blocks zone deactivation before external dependency approval", async () => {
  reset();
  let externalGuardCalls = 0;
  const service = createService({
    async check() { externalGuardCalls += 1; return { allowed: true, blockers: [] }; },
  });
  const warehouse = await createBase(service);
  const zone = await service.createZone({
    requestId: "zone-create",
    companyId: warehouse.companyId,
    warehouseId: warehouse.warehouseId,
    zoneId: "zone-1",
    code: "Z1",
    title: "ناحیه یک",
    occurredAt: "2026-09-06T06:01:00.000Z",
  });
  await service.createLocation({
    requestId: "location-create",
    companyId: warehouse.companyId,
    warehouseId: warehouse.warehouseId,
    zoneId: zone.zoneId,
    locationId: "location-1",
    code: "L1",
    title: "موقعیت یک",
    kind: "bin",
    occurredAt: "2026-09-06T06:02:00.000Z",
  });

  await assert.rejects(
    () => service.changeZoneStatus({
      requestId: "zone-disable",
      companyId: warehouse.companyId,
      warehouseId: warehouse.warehouseId,
      zoneId: zone.zoneId,
      targetStatus: "inactive",
      occurredAt: "2026-09-06T06:03:00.000Z",
    }),
    (error: unknown) => error instanceof WarehouseApplicationError && error.code === WAREHOUSE_APPLICATION_ERROR_CODES.structuralDependencyBlocked,
  );

  assert.equal(externalGuardCalls, 0);
  assert.equal((await zoneRepository.findById(warehouse.companyId, zone.zoneId))?.status, "active");
});
