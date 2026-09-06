import assert from "node:assert/strict";
import test from "node:test";

import {
  WAREHOUSE_DOMAIN_ERROR_CODES,
  WarehouseDomainError,
  assertWarehouseIdentifiersUnique,
  createWarehouse,
  createWarehouseIdentifierSnapshot,
  normalizeWarehouseExternalIdentifier,
} from "../src/index.ts";

const warehouse = createWarehouse({
  warehouseId: "warehouse-001",
  companyId: "company-001",
  code: " wh-01 ",
  title: "انبار مرکزی",
  createdAt: "2026-09-04T10:00:00.000Z",
});

test("creates normalized identifier snapshot without changing durable warehouse identity", () => {
  const snapshot = createWarehouseIdentifierSnapshot(warehouse, [
    { namespace: " legacy-erp ", value: " 100-ABC " },
  ]);

  assert.equal(snapshot.warehouseId, "warehouse-001");
  assert.equal(snapshot.code, "WH-01");
  assert.deepEqual(snapshot.externalIdentifiers, [
    { namespace: "LEGACY-ERP", value: "100-ABC" },
  ]);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.externalIdentifiers), true);
});

test("requires external identifier namespace and value", () => {
  assert.throws(
    () => normalizeWarehouseExternalIdentifier({ namespace: " ", value: "1" }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.externalIdentifierNamespaceRequired,
  );

  assert.throws(
    () => normalizeWarehouseExternalIdentifier({ namespace: "ERP", value: " " }),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.externalIdentifierValueRequired,
  );
});

test("rejects repeated external identifier within one warehouse snapshot", () => {
  assert.throws(
    () =>
      createWarehouseIdentifierSnapshot(warehouse, [
        { namespace: "ERP", value: "X-1" },
        { namespace: " erp ", value: "X-1" },
      ]),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.duplicateExternalIdentifier,
  );
});

test("rejects duplicate durable warehouse identity globally", () => {
  assert.throws(
    () =>
      assertWarehouseIdentifiersUnique(
        {
          warehouseId: "warehouse-001",
          companyId: "company-002",
          code: "WH-99",
        },
        [
          {
            warehouseId: "warehouse-001",
            companyId: "company-001",
            code: "WH-01",
          },
        ],
      ),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.duplicateWarehouseId,
  );
});

test("enforces warehouse code uniqueness only inside the same company", () => {
  const existing = [
    {
      warehouseId: "warehouse-001",
      companyId: "company-001",
      code: "wh-01",
    },
  ] as const;

  assert.throws(
    () =>
      assertWarehouseIdentifiersUnique(
        {
          warehouseId: "warehouse-002",
          companyId: "company-001",
          code: " WH-01 ",
        },
        existing,
      ),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.duplicateCode,
  );

  assert.doesNotThrow(() =>
    assertWarehouseIdentifiersUnique(
      {
        warehouseId: "warehouse-003",
        companyId: "company-002",
        code: "WH-01",
      },
      existing,
    ),
  );
});

test("enforces external identifier uniqueness within company and namespace", () => {
  assert.throws(
    () =>
      assertWarehouseIdentifiersUnique(
        {
          warehouseId: "warehouse-002",
          companyId: "company-001",
          code: "WH-02",
          externalIdentifiers: [{ namespace: "ERP", value: "A-100" }],
        },
        [
          {
            warehouseId: "warehouse-001",
            companyId: "company-001",
            code: "WH-01",
            externalIdentifiers: [{ namespace: "erp", value: "A-100" }],
          },
        ],
      ),
    (error: unknown) =>
      error instanceof WarehouseDomainError &&
      error.code === WAREHOUSE_DOMAIN_ERROR_CODES.duplicateExternalIdentifier,
  );

  assert.doesNotThrow(() =>
    assertWarehouseIdentifiersUnique(
      {
        warehouseId: "warehouse-003",
        companyId: "company-002",
        code: "WH-01",
        externalIdentifiers: [{ namespace: "ERP", value: "A-100" }],
      },
      [
        {
          warehouseId: "warehouse-001",
          companyId: "company-001",
          code: "WH-01",
          externalIdentifiers: [{ namespace: "ERP", value: "A-100" }],
        },
      ],
    ),
  );
});
