import assert from "node:assert/strict";
import test from "node:test";

import {
  WAREHOUSE_DOMAIN_ERROR_CODES,
  WarehouseDomainError,
  archiveWarehouse,
  assignWarehouseOrganizationalScope,
  changeWarehouseOrganizationalScope,
  classifyWarehouse,
  createWarehouse,
  rehydrateOrganizedWarehouse,
} from "../src/index.ts";

const createdAt = "2026-09-04T08:00:00.000Z";

const createClassifiedWarehouse = () =>
  classifyWarehouse({
    warehouse: createWarehouse({
      warehouseId: "warehouse-001",
      companyId: "company-001",
      code: "WH-1",
      title: "انبار مرکزی",
      createdAt,
    }),
    kind: "general",
  });

const activeBranch = {
  branchId: "branch-001",
  companyId: "company-001",
  status: "active",
} as const;

test("supports an explicit company-wide warehouse scope", () => {
  const warehouse = assignWarehouseOrganizationalScope({
    warehouse: createClassifiedWarehouse(),
    scope: { mode: "company" },
  });

  assert.deepEqual(warehouse.organizationalScope, { mode: "company" });
  assert.equal(Object.isFrozen(warehouse), true);
  assert.equal(Object.isFrozen(warehouse.organizationalScope), true);
});

test("assigns a warehouse to one active branch in the same company", () => {
  const warehouse = assignWarehouseOrganizationalScope({
    warehouse: createClassifiedWarehouse(),
    scope: { mode: "branch", branchId: " branch-001 " },
    branch: activeBranch,
  });

  assert.deepEqual(warehouse.organizationalScope, {
    mode: "branch",
    branchId: "branch-001",
  });
});

test("rejects cross-company and inactive branch assignment", () => {
  assert.throws(
    () =>
      assignWarehouseOrganizationalScope({
        warehouse: createClassifiedWarehouse(),
        scope: { mode: "branch", branchId: "branch-002" },
        branch: {
          branchId: "branch-002",
          companyId: "company-002",
          status: "active",
        },
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.branchCompanyMismatch,
  );

  assert.throws(
    () =>
      assignWarehouseOrganizationalScope({
        warehouse: createClassifiedWarehouse(),
        scope: { mode: "branch", branchId: "branch-001" },
        branch: { ...activeBranch, status: "inactive" },
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.branchInactive,
  );
});

test("requires the requested branch reference to match the branch scope", () => {
  assert.throws(
    () =>
      assignWarehouseOrganizationalScope({
        warehouse: createClassifiedWarehouse(),
        scope: { mode: "branch", branchId: "branch-002" },
        branch: activeBranch,
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.branchReferenceMismatch,
  );

  assert.throws(
    () =>
      assignWarehouseOrganizationalScope({
        warehouse: createClassifiedWarehouse(),
        scope: { mode: "branch", branchId: "branch-001" },
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.branchReferenceRequired,
  );
});

test("rehydrates a historical branch association after the branch becomes inactive", () => {
  const warehouse = assignWarehouseOrganizationalScope({
    warehouse: createClassifiedWarehouse(),
    scope: { mode: "branch", branchId: "branch-001" },
    branch: activeBranch,
  });

  const rehydrated = rehydrateOrganizedWarehouse(warehouse, {
    ...activeBranch,
    status: "inactive",
  });

  assert.equal(rehydrated.organizationalScope.mode, "branch");
});

test("changes organization scope with forward timestamps and idempotent same-scope behavior", () => {
  const companyScoped = assignWarehouseOrganizationalScope({
    warehouse: createClassifiedWarehouse(),
    scope: { mode: "company" },
  });

  const same = changeWarehouseOrganizationalScope({
    warehouse: companyScoped,
    scope: { mode: "company" },
    occurredAt: "2026-09-04T09:00:00.000Z",
  });
  assert.equal(same, companyScoped);

  const branchScoped = changeWarehouseOrganizationalScope({
    warehouse: companyScoped,
    scope: { mode: "branch", branchId: "branch-001" },
    branch: activeBranch,
    occurredAt: "2026-09-04T09:00:00.000Z",
  });

  assert.deepEqual(branchScoped.organizationalScope, {
    mode: "branch",
    branchId: "branch-001",
  });
  assert.equal(branchScoped.updatedAt, "2026-09-04T09:00:00.000Z");

  assert.throws(
    () =>
      changeWarehouseOrganizationalScope({
        warehouse: branchScoped,
        scope: { mode: "company" },
        occurredAt: "2026-09-04T08:30:00.000Z",
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.timestampOrderInvalid,
  );
});

test("prevents organizational reassignment after archival", () => {
  const warehouse = assignWarehouseOrganizationalScope({
    warehouse: createClassifiedWarehouse(),
    scope: { mode: "company" },
  });
  const archived = archiveWarehouse(warehouse, "2026-09-04T09:00:00.000Z");

  assert.throws(
    () =>
      changeWarehouseOrganizationalScope({
        warehouse: { ...archived, organizationalScope: warehouse.organizationalScope },
        scope: { mode: "branch", branchId: "branch-001" },
        branch: activeBranch,
        occurredAt: "2026-09-04T10:00:00.000Z",
      }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code ===
        WAREHOUSE_DOMAIN_ERROR_CODES.archivedOrganizationChangeForbidden,
  );
});
