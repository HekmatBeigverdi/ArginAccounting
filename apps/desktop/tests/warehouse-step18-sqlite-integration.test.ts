import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import type { DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import {
  WarehouseBulkTransferService,
  WarehouseReaderBulkExportAdapter,
  warehousePermissions,
  type WarehouseAuditEvent,
  type WarehouseAuditSink,
  type WarehouseAuthorizationPolicy,
} from "@argin/warehouse";
import {
  SqliteWarehouseBranchResolver,
  SqliteWarehouseReader,
  SqliteWarehouseRepository,
  SqliteWarehouseUnitOfWork,
} from "@argin/warehouse-tauri";

const readMigration = (name: string): string => readFileSync(
  new URL(`../src-tauri/migrations/${name}`, import.meta.url),
  "utf8",
);

const migrations = [
  readMigration("0002_company_and_branch.sql"),
  readMigration("0022_warehouses.sql"),
  readMigration("0023_warehouse_sync_metadata.sql"),
  readMigration("0024_warehouse_idempotency.sql"),
  readMigration("0025_warehouse_maintenance_tombstones.sql"),
];

const bind = (values: readonly DatabaseValue[]): readonly (string | number | bigint | Uint8Array | null)[] =>
  values.map((value) => typeof value === "boolean" ? Number(value) : value) as readonly (string | number | bigint | Uint8Array | null)[];

class NodeSqliteExecutor implements DatabaseExecutor {
  constructor(readonly database: DatabaseSync) {}

  async execute(sql: string, parameters: readonly DatabaseValue[] = []) {
    const result = this.database.prepare(sql).run(...bind(parameters));
    return { rowsAffected: Number(result.changes) };
  }

  async query<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T[]> {
    return this.database.prepare(sql).all(...bind(parameters)) as T[];
  }

  async queryOne<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    return (this.database.prepare(sql).get(...bind(parameters)) ?? null) as T | null;
  }

  async transaction<T>(operation: (transaction: DatabaseSession) => Promise<T>): Promise<T> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = await operation(this);
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async close(): Promise<void> { this.database.close(); }
}

function createExecutor(): NodeSqliteExecutor {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) database.exec(migration);
  const now = "2026-09-06T06:00:00.000Z";
  database.prepare(
    "INSERT INTO companies (id, code, legal_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("company-1", "C01", "Company One", now, now);
  database.prepare(
    "INSERT INTO companies (id, code, legal_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("company-2", "C02", "Company Two", now, now);
  database.prepare(`INSERT INTO branches
    (id, company_id, code, name, is_head_office, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 'active', ?, ?)`)
    .run("branch-1", "company-1", "B01", "Branch One", now, now);
  database.prepare(`INSERT INTO branches
    (id, company_id, code, name, is_head_office, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 'active', ?, ?)`)
    .run("branch-2", "company-2", "B02", "Branch Two", now, now);
  return new NodeSqliteExecutor(database);
}

const authorization: WarehouseAuthorizationPolicy = {
  async require(_context, permission) {
    assert.ok(Object.values(warehousePermissions).includes(permission));
  },
};

const auditEvents: WarehouseAuditEvent[] = [];
const audit: WarehouseAuditSink = { async record(event) { auditEvents.push(event); } };

const mapping = {
  code: "Code",
  title: "Title",
  description: "Description",
  kind: "Kind",
  status: "Status",
  scopeMode: "Scope",
  branchId: "Branch",
  externalIdentifiers: "External",
} as const;

const context = {
  companyId: "company-1",
  actorId: "user-1",
  correlationId: "corr-step18",
  requestId: "req-step18",
  occurredAt: "2026-09-06T06:30:00.000Z",
};

test("real SQLite UoW rolls back all Warehouse writes when a transaction fails", async () => {
  const executor = createExecutor();
  try {
    const uow = new SqliteWarehouseUnitOfWork(executor);
    await assert.rejects(
      () => uow.execute(async ({ warehouses }) => {
        const repository = warehouses as SqliteWarehouseRepository;
        const state = await import("@argin/warehouse").then(({ createWarehouse, classifyWarehouse, assignWarehouseOrganizationalScope }) => {
          const base = createWarehouse({
            warehouseId: "rollback-1",
            companyId: "company-1",
            code: "ROLLBACK",
            title: "Rollback",
            createdAt: context.occurredAt,
          });
          const classified = classifyWarehouse({ warehouse: base, kind: "general" });
          return Object.freeze({
            warehouse: assignWarehouseOrganizationalScope({ warehouse: classified, scope: { mode: "company" } }),
            externalIdentifiers: Object.freeze([]),
            version: 1,
          });
        });
        await repository.add(state);
        throw new Error("force-rollback");
      }),
      /force-rollback/u,
    );
    const count = executor.database.prepare("SELECT COUNT(*) AS count FROM warehouses WHERE id='rollback-1'").get() as { count: number };
    assert.equal(Number(count.count), 0);
  } finally {
    await executor.close();
  }
});

test("real SQLite bulk import/export preserves Company, Branch and external identifiers", async () => {
  const executor = createExecutor();
  auditEvents.length = 0;
  try {
    const uow = new SqliteWarehouseUnitOfWork(executor);
    const reader = new SqliteWarehouseReader(executor);
    const branches = new SqliteWarehouseBranchResolver(executor);
    let sequence = 0;
    const bulk = new WarehouseBulkTransferService(
      uow,
      branches,
      new WarehouseReaderBulkExportAdapter(reader),
      authorization,
      audit,
      { nextId: () => `import-${++sequence}` },
    );

    const rows = [
      { Code: "MAIN", Title: "انبار اصلی", Description: "مرکزی", Kind: "general", Status: "active", Scope: "company", External: "ERP=MAIN-01" },
      { Code: "BR-01", Title: "انبار شعبه", Description: "شعبه", Kind: "consumables", Status: "inactive", Scope: "branch", Branch: "branch-1", External: "ERP=BR-01|LEGACY=42" },
    ];

    const preview = await bulk.previewImport(rows, mapping, context);
    assert.equal(preview.validRows, 2);
    assert.equal(preview.invalidRows, 0);

    const imported = await bulk.import(rows, mapping, context, { atomic: true });
    assert.deepEqual({ importedCount: imported.importedCount, failedCount: imported.failedCount }, { importedCount: 2, failedCount: 0 });

    const persisted = await reader.list({
      filter: { companyId: "company-1" },
      page: { page: 1, pageSize: 20 },
      sort: { field: "code", direction: "asc" },
    });
    assert.equal(persisted.totalCount, 2);
    assert.equal(persisted.items.find((item) => item.code === "BR-01")?.organizationalScope.mode, "branch");

    const batches: unknown[][] = [];
    const exportedCount = await bulk.export({ ...context, requestId: "req-export" }, {
      async write(batch) { batches.push([...batch]); },
    }, 1);
    assert.equal(exportedCount, 2);
    assert.equal(batches.length, 2);
    const flat = batches.flat() as Array<{ code: string; branchId: string; externalIdentifiers: string }>;
    assert.equal(flat.find((row) => row.code === "BR-01")?.branchId, "branch-1");
    assert.match(flat.find((row) => row.code === "BR-01")?.externalIdentifiers ?? "", /ERP=BR-01/u);
    assert.match(flat.find((row) => row.code === "BR-01")?.externalIdentifiers ?? "", /LEGACY=42/u);
    assert.equal(auditEvents.some((event) => event.action === "warehouse.import"), true);
    assert.equal(auditEvents.some((event) => event.action === "warehouse.export"), true);
  } finally {
    await executor.close();
  }
});

test("real SQLite reader excludes Warehouse/Zone/Location tombstones from ordinary reads", async () => {
  const executor = createExecutor();
  try {
    const now = context.occurredAt;
    executor.database.prepare(`INSERT INTO warehouses
      (id, company_id, code, title, kind, status, organizational_scope, branch_id, created_at, updated_at, version, deleted_at)
      VALUES ('w-live','company-1','LIVE','Live','general','active','company',NULL,?,?,1,NULL)`).run(now, now);
    executor.database.prepare(`INSERT INTO warehouses
      (id, company_id, code, title, kind, status, organizational_scope, branch_id, created_at, updated_at, version, deleted_at)
      VALUES ('w-deleted','company-1','DELETED','Deleted','general','active','company',NULL,?,?,2,?)`).run(now, now, now);
    executor.database.prepare(`INSERT INTO warehouse_zones
      (id,company_id,warehouse_id,code,title,status,created_at,updated_at,deleted_at)
      VALUES ('z-live','company-1','w-live','Z1','Zone','active',?,?,NULL)`).run(now, now);
    executor.database.prepare(`INSERT INTO warehouse_zones
      (id,company_id,warehouse_id,code,title,status,created_at,updated_at,deleted_at)
      VALUES ('z-deleted','company-1','w-live','Z2','Deleted Zone','active',?,?,?)`).run(now, now, now);
    executor.database.prepare(`INSERT INTO warehouse_locations
      (id,company_id,warehouse_id,zone_id,parent_location_id,code,title,kind,status,created_at,updated_at,deleted_at)
      VALUES ('l-live','company-1','w-live','z-live',NULL,'L1','Location','bin','active',?,?,NULL)`).run(now, now);
    executor.database.prepare(`INSERT INTO warehouse_locations
      (id,company_id,warehouse_id,zone_id,parent_location_id,code,title,kind,status,created_at,updated_at,deleted_at)
      VALUES ('l-deleted','company-1','w-live','z-live',NULL,'L2','Deleted Location','bin','active',?,?,?)`).run(now, now, now);

    const reader = new SqliteWarehouseReader(executor);
    const warehouses = await reader.list({ filter: { companyId: "company-1" }, page: { page: 1, pageSize: 20 } });
    const zones = await reader.listZones({ companyId: "company-1", warehouseId: "w-live" });
    const locations = await reader.listLocations({ companyId: "company-1", warehouseId: "w-live" });
    assert.deepEqual(warehouses.items.map((item) => item.warehouseId), ["w-live"]);
    assert.deepEqual(zones.map((item) => item.zoneId), ["z-live"]);
    assert.deepEqual(locations.map((item) => item.locationId), ["l-live"]);
  } finally {
    await executor.close();
  }
});

test("real SQLite selector enforces Branch visibility before LIMIT", async () => {
  const executor = createExecutor();
  try {
    const now = context.occurredAt;
    const insert = executor.database.prepare(`INSERT INTO warehouses
      (id, company_id, code, title, kind, status, organizational_scope, branch_id, created_at, updated_at, version)
      VALUES (?, 'company-1', ?, ?, 'general', 'active', ?, ?, ?, ?, 1)`);
    insert.run("company-wide", "A-COMPANY", "Company", "company", null, now, now);
    insert.run("branch-one", "B-BRANCH1", "Branch 1", "branch", "branch-1", now, now);
    const branchTwo = executor.database.prepare(`INSERT INTO branches
      (id, company_id, code, name, is_head_office, status, created_at, updated_at)
      VALUES ('branch-other','company-1','B02','Other',0,'active',?,?)`);
    branchTwo.run(now, now);
    insert.run("branch-other", "C-OTHER", "Other", "branch", "branch-other", now, now);

    const reader = new SqliteWarehouseReader(executor);
    const companyOnly = await reader.select({ companyId: "company-1", companyWideOnly: true, statuses: ["active"], includeCompanyWide: true, limit: 1 });
    assert.deepEqual(companyOnly.map((item) => item.warehouseId), ["company-wide"]);

    const branch = await reader.select({ companyId: "company-1", branchId: "branch-1", statuses: ["active"], includeCompanyWide: true, limit: 2 });
    assert.deepEqual(branch.map((item) => item.warehouseId).sort(), ["branch-one", "company-wide"].sort());
    assert.equal(branch.some((item) => item.warehouseId === "branch-other"), false);
  } finally {
    await executor.close();
  }
});
