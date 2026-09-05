import assert from "node:assert/strict";
import test from "node:test";

import {
  WAREHOUSE_DOMAIN_ERROR_CODES,
  WAREHOUSE_KINDS,
  WarehouseDomainError,
  activateWarehouse,
  archiveWarehouse,
  restoreWarehouse,
  classifyWarehouse,
  createWarehouse,
  deactivateWarehouse,
  rehydrateClassifiedWarehouse,
  rehydrateWarehouse,
} from "../src/index.ts";

const createdAt = "2026-09-02T00:00:00.000Z";

const createBaseWarehouse = () =>
  createWarehouse({
    warehouseId: "warehouse-001",
    companyId: "company-001",
    code: "WH-1",
    title: "انبار مرکزی",
    createdAt,
  });

test("creates a canonical warehouse with durable identity and company scope", () => {
  const warehouse = createWarehouse({
    warehouseId: "warehouse-001",
    companyId: "company-001",
    code: " wh-100 ",
    title: "  انبار مرکزی  ",
    description: "  انبار   اصلی شرکت  ",
    createdAt,
  });

  assert.deepEqual(warehouse, {
    warehouseId: "warehouse-001",
    companyId: "company-001",
    code: "WH-100",
    title: "انبار مرکزی",
    description: "انبار اصلی شرکت",
    createdAt,
    updatedAt: createdAt,
  });
  assert.equal(Object.isFrozen(warehouse), true);
});

test("keeps durable warehouse identity distinct from display code", () => {
  const warehouse = createWarehouse({
    warehouseId: "01J-WAREHOUSE-DURABLE-ID",
    companyId: "company-001",
    code: "10001",
    title: "انبار مرکزی",
    createdAt,
  });

  assert.notEqual(warehouse.warehouseId, warehouse.code);
});

test("normalizes an empty optional description to null", () => {
  const warehouse = createWarehouse({
    warehouseId: "warehouse-001",
    companyId: "company-001",
    code: "WH-1",
    title: "انبار",
    description: "   ",
    createdAt,
  });

  assert.equal(warehouse.description, null);
});

test("rejects missing required warehouse invariants", () => {
  const base = {
    warehouseId: "warehouse-001",
    companyId: "company-001",
    code: "WH-1",
    title: "انبار",
    createdAt,
  } as const;

  assert.throws(
    () => createWarehouse({ ...base, warehouseId: " " }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.idRequired,
  );

  assert.throws(
    () => createWarehouse({ ...base, companyId: " " }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.companyIdRequired,
  );

  assert.throws(
    () => createWarehouse({ ...base, code: " " }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.codeRequired,
  );

  assert.throws(
    () => createWarehouse({ ...base, title: " " }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.titleRequired,
  );
});

test("rehydration canonicalizes persisted data and validates timestamp order", () => {
  const warehouse = rehydrateWarehouse({
    warehouseId: "warehouse-001",
    companyId: "company-001",
    code: " wh-1 ",
    title: "  انبار مرکزی ",
    description: null,
    createdAt,
    updatedAt: "2026-09-02T01:00:00.000Z",
  });

  assert.equal(warehouse.code, "WH-1");
  assert.equal(warehouse.title, "انبار مرکزی");
  assert.equal(Object.isFrozen(warehouse), true);

  assert.throws(
    () =>
      rehydrateWarehouse({
        ...warehouse,
        updatedAt: "2026-09-01T23:59:59.000Z",
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.timestampOrderInvalid,
  );
});

test("rejects invalid creation and rehydration timestamps", () => {
  assert.throws(
    () =>
      createWarehouse({
        warehouseId: "warehouse-001",
        companyId: "company-001",
        code: "WH-1",
        title: "انبار",
        createdAt: "not-a-date",
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.createdAtInvalid,
  );

  assert.throws(
    () =>
      rehydrateWarehouse({
        warehouseId: "warehouse-001",
        companyId: "company-001",
        code: "WH-1",
        title: "انبار",
        description: null,
        createdAt,
        updatedAt: "not-a-date",
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.updatedAtInvalid,
  );
});

test("supports the frozen warehouse classifications", () => {
  assert.deepEqual(WAREHOUSE_KINDS, [
    "general",
    "raw-material",
    "finished-goods",
    "consumables",
    "spare-parts",
    "wip",
    "transit",
    "consignment",
    "other",
  ]);

  for (const kind of WAREHOUSE_KINDS) {
    const warehouse = classifyWarehouse({ warehouse: createBaseWarehouse(), kind });
    assert.equal(warehouse.kind, kind);
    assert.equal(warehouse.status, "active");
    assert.equal(Object.isFrozen(warehouse), true);
  }
});

test("rejects invalid warehouse classification on creation and rehydration", () => {
  assert.throws(
    () =>
      classifyWarehouse({
        warehouse: createBaseWarehouse(),
        kind: "invalid-kind" as never,
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.kindInvalid,
  );

  assert.throws(
    () =>
      rehydrateClassifiedWarehouse({
        ...createBaseWarehouse(),
        kind: "general",
        status: "deleted" as never,
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.statusInvalid,
  );
});

test("moves active warehouse to inactive and back to active", () => {
  const active = classifyWarehouse({
    warehouse: createBaseWarehouse(),
    kind: "general",
  });

  const inactive = deactivateWarehouse(active, "2026-09-02T01:00:00.000Z");
  assert.equal(inactive.status, "inactive");
  assert.equal(inactive.updatedAt, "2026-09-02T01:00:00.000Z");

  const reactivated = activateWarehouse(
    inactive,
    "2026-09-02T02:00:00.000Z",
  );
  assert.equal(reactivated.status, "active");
  assert.equal(reactivated.updatedAt, "2026-09-02T02:00:00.000Z");
});

test("treats repeated active/inactive requests as idempotent domain transitions", () => {
  const active = classifyWarehouse({
    warehouse: createBaseWarehouse(),
    kind: "general",
  });
  assert.equal(activateWarehouse(active, "2026-09-02T01:00:00.000Z"), active);

  const inactive = deactivateWarehouse(active, "2026-09-02T01:00:00.000Z");
  assert.equal(
    deactivateWarehouse(inactive, "2026-09-02T02:00:00.000Z"),
    inactive,
  );
});

test("requires explicit restoration before changing an archived warehouse status", () => {
  const active = classifyWarehouse({
    warehouse: createBaseWarehouse(),
    kind: "finished-goods",
  });
  const archived = archiveWarehouse(active, "2026-09-02T01:00:00.000Z");

  assert.equal(archived.status, "archived");
  assert.equal(archiveWarehouse(archived, "2026-09-02T02:00:00.000Z"), archived);

  assert.throws(
    () => activateWarehouse(archived, "2026-09-02T02:00:00.000Z"),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.archivedTransitionForbidden,
  );

  assert.throws(
    () => deactivateWarehouse(archived, "2026-09-02T02:00:00.000Z"),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.archivedTransitionForbidden,
  );
});

test("rejects lifecycle transitions that move updatedAt backwards", () => {
  const active = classifyWarehouse({
    warehouse: rehydrateWarehouse({
      ...createBaseWarehouse(),
      updatedAt: "2026-09-02T03:00:00.000Z",
    }),
    kind: "general",
  });

  assert.throws(
    () => deactivateWarehouse(active, "2026-09-02T02:59:59.000Z"),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.timestampOrderInvalid,
  );
});


test("restoration only accepts archived warehouses and validates timestamp order", () => {
  const active = classifyWarehouse({ warehouse: createBaseWarehouse(), kind: "general" });
  const archived = archiveWarehouse(active, "2026-09-02T01:00:00Z");
  const restored = restoreWarehouse(archived, "2026-09-02T02:00:00Z");
  assert.equal(restored.status, "inactive");
  assert.equal(restored.updatedAt, "2026-09-02T02:00:00.000Z");
  assert.equal(archived.status, "archived");
  assert.equal(Object.isFrozen(restored), true);
  assert.throws(() => restoreWarehouse(active, "2026-09-02T02:00:00Z"), /warehouse.restore.requires-archived/u);
  assert.throws(() => restoreWarehouse(restored, "2026-09-02T03:00:00Z"), /warehouse.restore.requires-archived/u);
  assert.throws(() => restoreWarehouse(archived, "2026-09-02T00:00:00Z"), (error: unknown) => error instanceof WarehouseDomainError && error.code === WAREHOUSE_DOMAIN_ERROR_CODES.timestampOrderInvalid);
  assert.throws(() => restoreWarehouse(archived, "invalid"), (error: unknown) => error instanceof WarehouseDomainError && error.code === WAREHOUSE_DOMAIN_ERROR_CODES.updatedAtInvalid);
});
