import assert from "node:assert/strict";
import test from "node:test";

import {
  SecuredWarehouseService,
  WAREHOUSE_APPLICATION_ERROR_CODES,
  WarehouseApplicationError,
  warehouseApprovalIntegration,
  warehouseCorrelationId,
  warehousePermissions,
  type WarehouseAuditEvent,
  type WarehouseAuditSink,
  type WarehouseAuthorizationContext,
  type WarehouseAuthorizationPolicy,
  type WarehouseDto,
  type WarehousePermission,
  type WarehouseService,
} from "../src/index.ts";

const warehouseDto: WarehouseDto = Object.freeze({
  warehouseId: "wh-1",
  companyId: "co-1",
  code: "MAIN",
  title: "انبار اصلی",
  description: null,
  kind: "general",
  status: "active",
  organizationalScope: Object.freeze({ mode: "company" as const }),
  externalIdentifiers: Object.freeze([]),
  version: 1,
  createdAt: "2026-09-04T20:00:00.000Z",
  updatedAt: "2026-09-04T20:00:00.000Z",
});

test("warehouse permission catalog and approval boundary are explicit", () => {
  assert.equal(warehousePermissions.view, "inventory.warehouses.view");
  assert.equal(warehousePermissions.manageLocations, "inventory.warehouses.manage-locations");
  assert.equal(warehouseApprovalIntegration.mode, "not-required");
  assert.equal(warehouseApprovalIntegration.approvalRequestType, null);
  assert.equal(
    warehouseCorrelationId({ actorId: "user-1", correlationId: "  " }, "req-1"),
    "req-1",
  );
});

test("secured warehouse creation requires permission before mutation and records audit", async () => {
  const required: Array<{ context: WarehouseAuthorizationContext; permission: WarehousePermission }> = [];
  const events: WarehouseAuditEvent[] = [];
  let createCalls = 0;

  const authorization: WarehouseAuthorizationPolicy = {
    async require(context, permission) {
      required.push({ context, permission });
    },
  };
  const audit: WarehouseAuditSink = {
    async record(event) {
      events.push(event);
    },
  };
  const inner = {
    async create() {
      createCalls += 1;
      return warehouseDto;
    },
  } as unknown as WarehouseService;

  const service = new SecuredWarehouseService(inner, authorization, audit);
  const result = await service.create(
    { actorId: "user-1", correlationId: "corr-1" },
    {
      requestId: "req-1",
      warehouseId: "wh-1",
      companyId: "co-1",
      code: "MAIN",
      title: "انبار اصلی",
      kind: "general",
      organizationalScope: { mode: "company" },
      occurredAt: "2026-09-04T20:00:00Z",
    },
  );

  assert.equal(result.warehouseId, "wh-1");
  assert.equal(createCalls, 1);
  assert.equal(required.length, 1);
  assert.equal(required[0]?.permission, warehousePermissions.create);
  assert.equal(required[0]?.context.companyId, "co-1");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.action, "warehouse.create");
  assert.equal(events[0]?.actorId, "user-1");
  assert.equal(events[0]?.requestId, "req-1");
  assert.equal(events[0]?.occurredAt, "2026-09-04T20:00:00.000Z");
});

test("authorization failure blocks mutation and audit", async () => {
  let createCalls = 0;
  let auditCalls = 0;
  const authorization: WarehouseAuthorizationPolicy = {
    async require() {
      throw new Error("denied");
    },
  };
  const audit: WarehouseAuditSink = {
    async record() {
      auditCalls += 1;
    },
  };
  const inner = {
    async create() {
      createCalls += 1;
      return warehouseDto;
    },
  } as unknown as WarehouseService;

  const service = new SecuredWarehouseService(inner, authorization, audit);
  await assert.rejects(
    () => service.create(
      { actorId: "user-1" },
      {
        requestId: "req-denied",
        warehouseId: "wh-1",
        companyId: "co-1",
        code: "MAIN",
        title: "انبار اصلی",
        kind: "general",
        organizationalScope: { mode: "company" },
        occurredAt: "2026-09-04T20:00:00Z",
      },
    ),
    (error: unknown) =>
      error instanceof WarehouseApplicationError &&
      error.code === WAREHOUSE_APPLICATION_ERROR_CODES.unauthorized,
  );

  assert.equal(createCalls, 0);
  assert.equal(auditCalls, 0);
});
