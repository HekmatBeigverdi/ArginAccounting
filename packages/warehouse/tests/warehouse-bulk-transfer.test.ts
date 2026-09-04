import assert from "node:assert/strict";
import test from "node:test";

import {
  WarehouseBulkTransferService,
  defaultInitialWarehouse,
  warehouseImportFields,
  warehousePermissions,
  type WarehouseAuditEvent,
  type WarehouseAuditSink,
  type WarehouseAuthorizationPolicy,
  type WarehouseBranchResolver,
  type WarehousePersistenceState,
  type WarehouseRepository,
  type WarehouseUnitOfWork,
} from "../src/index.ts";

class MemoryWarehouseRepository implements WarehouseRepository {
  readonly states: WarehousePersistenceState[] = [];
  async findById(companyId: string, warehouseId: string) { return this.states.find((x) => x.warehouse.companyId === companyId && x.warehouse.warehouseId === warehouseId) ?? null; }
  async findByCode(companyId: string, code: string) { return this.states.find((x) => x.warehouse.companyId === companyId && x.warehouse.code.toUpperCase() === code.toUpperCase()) ?? null; }
  async findByExternalIdentifier(companyId: string, namespace: string, value: string) { return this.states.find((x) => x.warehouse.companyId === companyId && x.externalIdentifiers.some((id) => id.namespace === namespace && id.value === value)) ?? null; }
  async add(state: WarehousePersistenceState) { this.states.push(state); }
  async update(): Promise<void> { throw new Error("not-used"); }
}

const repository = new MemoryWarehouseRepository();
const unitOfWork: WarehouseUnitOfWork = {
  async execute<T>(work: (context: any) => Promise<T>): Promise<T> {
    return work({ warehouses: repository, zones: {}, locations: {} });
  },
};
const branches: WarehouseBranchResolver = { async findById(companyId, branchId) { return branchId === "B1" ? { branchId, companyId, status: "active" } : null; } };
const permissions: string[] = [];
const authorization: WarehouseAuthorizationPolicy = { async require(_context, permission) { permissions.push(permission); } };
const events: WarehouseAuditEvent[] = [];
const audit: WarehouseAuditSink = { async record(event) { events.push(event); } };
let id = 0;

const service = new WarehouseBulkTransferService(
  unitOfWork,
  branches,
  { async readPage() { return { items: [], page: 1, pageSize: 50, totalCount: 0 }; } },
  authorization,
  audit,
  { nextId: () => `W-${++id}` },
);

const mapping = {
  code: "Code",
  title: "Title",
  kind: "Kind",
  status: "Status",
  scopeMode: "Scope",
  branchId: "Branch",
  externalIdentifiers: "External",
} as const;

const context = {
  companyId: "C1",
  actorId: "U1",
  correlationId: "CORR-1",
  requestId: "REQ-1",
  occurredAt: "2026-09-04T20:00:00.000Z",
};

test("warehouse import contract exposes the stable root-master fields", () => {
  assert.deepEqual(warehouseImportFields, ["code", "title", "description", "kind", "status", "scopeMode", "branchId", "externalIdentifiers"]);
  assert.equal(defaultInitialWarehouse.code, "MAIN");
  assert.equal(defaultInitialWarehouse.title, "انبار اصلی");
  assert.equal(defaultInitialWarehouse.organizationalScope.mode, "company");
});

test("preview rejects duplicate code and external identifiers inside the same batch", async () => {
  const preview = await service.previewImport([
    { Code: "WH-01", Title: "انبار یک", Kind: "general", Status: "active", Scope: "company", External: "ERP=A1" },
    { Code: "wh-01", Title: "انبار دو", Kind: "general", Status: "active", Scope: "company", External: "ERP=A2" },
    { Code: "WH-03", Title: "انبار سه", Kind: "general", Status: "active", Scope: "company", External: "ERP=A2" },
  ], mapping, context);

  assert.equal(preview.validRows, 0);
  assert.equal(preview.invalidRows, 3);
  assert.ok(preview.rows.every((row) => row.issues.some((issue) => issue.code === "warehouse.import.batch-duplicate")));
  assert.ok(permissions.includes(warehousePermissions.import));
});

test("atomic import writes valid company and branch-scoped warehouses and records one audit fact", async () => {
  repository.states.length = 0;
  events.length = 0;
  const result = await service.import([
    { Code: "MAIN-2", Title: "انبار مرکزی", Kind: "general", Status: "active", Scope: "company", External: "ERP=MAIN2" },
    { Code: "BR-1", Title: "انبار شعبه", Kind: "consumables", Status: "inactive", Scope: "branch", Branch: "B1", External: "ERP=BR1" },
  ], mapping, { ...context, requestId: "REQ-2" }, { atomic: true });

  assert.equal(result.importedCount, 2);
  assert.equal(result.failedCount, 0);
  assert.equal(repository.states.length, 2);
  assert.equal(repository.states[1]?.warehouse.organizationalScope.mode, "branch");
  assert.equal(repository.states[1]?.warehouse.status, "inactive");
  assert.equal(events.at(-1)?.action, "warehouse.import");
});

test("branch-scoped import requires a resolvable branch", async () => {
  const preview = await service.previewImport([
    { Code: "BAD-BR", Title: "انبار نامعتبر", Kind: "general", Status: "active", Scope: "branch", Branch: "UNKNOWN" },
  ], mapping, { ...context, requestId: "REQ-3" });

  assert.equal(preview.validRows, 0);
  assert.equal(preview.rows[0]?.issues[0]?.code, "warehouse.import.invalid-row");
});
