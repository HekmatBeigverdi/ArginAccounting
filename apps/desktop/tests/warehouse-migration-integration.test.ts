import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

const companyMigration = readFileSync(
  new URL("../src-tauri/migrations/0002_company_and_branch.sql", import.meta.url),
  "utf8",
);
const warehouseMigration = readFileSync(
  new URL("../src-tauri/migrations/0022_warehouses.sql", import.meta.url),
  "utf8",
);
const runner = readFileSync(
  new URL("../src-tauri/src/lib.rs", import.meta.url),
  "utf8",
);
const now = "2026-09-04T12:00:00.000Z";

function db(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(companyMigration);
  database.exec(warehouseMigration);

  database.prepare(
    "INSERT INTO companies (id, code, legal_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("company-1", "C01", "Company 1", now, now);
  database.prepare(
    "INSERT INTO companies (id, code, legal_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("company-2", "C02", "Company 2", now, now);

  database.prepare(`INSERT INTO branches
    (id, company_id, code, name, is_head_office, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 'active', ?, ?)`)
    .run("branch-1", "company-1", "B01", "Branch 1", now, now);
  database.prepare(`INSERT INTO branches
    (id, company_id, code, name, is_head_office, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 'active', ?, ?)`)
    .run("branch-2", "company-2", "B02", "Branch 2", now, now);

  return database;
}

function insertWarehouse(
  database: DatabaseSync,
  id: string,
  companyId: string,
  code: string,
  scope: "company" | "branch" = "company",
  branchId: string | null = null,
): void {
  database.prepare(`INSERT INTO warehouses
    (id, company_id, code, title, kind, status, organizational_scope, branch_id, created_at, updated_at, version)
    VALUES (?, ?, ?, ?, 'general', 'active', ?, ?, ?, ?, 1)`)
    .run(id, companyId, code, `Warehouse ${code}`, scope, branchId, now, now);
}

describe("Phase 19 Warehouse migration", () => {
  it("registers migration 22 in the desktop runner", () => {
    assert.match(runner, /version:\s*22/u);
    assert.match(runner, /0022_warehouses\.sql/u);
  });

  it("persists company-wide and Branch-scoped Warehouses", () => {
    const database = db();
    insertWarehouse(database, "w1", "company-1", "WH-01");
    insertWarehouse(database, "w2", "company-1", "WH-02", "branch", "branch-1");

    const rows = database.prepare(
      "SELECT id, organizational_scope, branch_id FROM warehouses ORDER BY id",
    ).all();
    assert.equal(rows.length, 2);
    assert.deepEqual({ ...rows[0] }, {
      id: "w1",
      organizational_scope: "company",
      branch_id: null,
    });
    assert.deepEqual({ ...rows[1] }, {
      id: "w2",
      organizational_scope: "branch",
      branch_id: "branch-1",
    });
  });

  it("enforces company-scoped case-insensitive Warehouse code uniqueness", () => {
    const database = db();
    insertWarehouse(database, "w1", "company-1", "WH-01");
    assert.throws(
      () => insertWarehouse(database, "w2", "company-1", "wh-01"),
      /UNIQUE/u,
    );
    insertWarehouse(database, "w3", "company-2", "wh-01");
  });

  it("rejects cross-company Branch scope and malformed scope combinations", () => {
    const database = db();
    assert.throws(
      () => insertWarehouse(database, "w1", "company-1", "WH-01", "branch", "branch-2"),
      /FOREIGN KEY/u,
    );
    assert.throws(
      () => database.prepare(`INSERT INTO warehouses
        (id, company_id, code, title, kind, status, organizational_scope, branch_id, created_at, updated_at, version)
        VALUES ('w2', 'company-1', 'WH-02', 'Warehouse 2', 'general', 'active', 'company', 'branch-1', ?, ?, 1)`)
        .run(now, now),
      /CHECK/u,
    );
  });

  it("enforces namespaced external identifier uniqueness per Company", () => {
    const database = db();
    insertWarehouse(database, "w1", "company-1", "WH-01");
    insertWarehouse(database, "w2", "company-1", "WH-02");
    insertWarehouse(database, "w3", "company-2", "WH-01");

    database.prepare(`INSERT INTO warehouse_external_identifiers
      (company_id, warehouse_id, namespace, value) VALUES (?, ?, ?, ?)`)
      .run("company-1", "w1", "ERP", "A-1");

    assert.throws(
      () => database.prepare(`INSERT INTO warehouse_external_identifiers
        (company_id, warehouse_id, namespace, value) VALUES (?, ?, ?, ?)`)
        .run("company-1", "w2", "erp", "A-1"),
      /UNIQUE/u,
    );

    database.prepare(`INSERT INTO warehouse_external_identifiers
      (company_id, warehouse_id, namespace, value) VALUES (?, ?, ?, ?)`)
      .run("company-2", "w3", "ERP", "A-1");
  });

  it("enforces Zone and Location hierarchy inside one Warehouse scope", () => {
    const database = db();
    insertWarehouse(database, "w1", "company-1", "WH-01");
    insertWarehouse(database, "w2", "company-1", "WH-02");

    database.prepare(`INSERT INTO warehouse_zones
      (id, company_id, warehouse_id, code, title, status, created_at, updated_at)
      VALUES ('z1', 'company-1', 'w1', 'Z-01', 'Zone 1', 'active', ?, ?)`)
      .run(now, now);

    database.prepare(`INSERT INTO warehouse_locations
      (id, company_id, warehouse_id, zone_id, parent_location_id, code, title, kind, status, created_at, updated_at)
      VALUES ('rack-1', 'company-1', 'w1', 'z1', NULL, 'R-01', 'Rack 1', 'rack', 'active', ?, ?)`)
      .run(now, now);

    database.prepare(`INSERT INTO warehouse_locations
      (id, company_id, warehouse_id, zone_id, parent_location_id, code, title, kind, status, created_at, updated_at)
      VALUES ('bin-1', 'company-1', 'w1', 'z1', 'rack-1', 'B-01', 'Bin 1', 'bin', 'active', ?, ?)`)
      .run(now, now);

    assert.throws(
      () => database.prepare(`INSERT INTO warehouse_locations
        (id, company_id, warehouse_id, zone_id, parent_location_id, code, title, kind, status, created_at, updated_at)
        VALUES ('bad-1', 'company-1', 'w2', 'z1', NULL, 'BAD', 'Bad', 'bin', 'active', ?, ?)`)
        .run(now, now),
      /FOREIGN KEY/u,
    );

    assert.throws(
      () => database.prepare(`INSERT INTO warehouse_locations
        (id, company_id, warehouse_id, zone_id, parent_location_id, code, title, kind, status, created_at, updated_at)
        VALUES ('self-1', 'company-1', 'w1', 'z1', 'self-1', 'SELF', 'Self', 'bin', 'active', ?, ?)`)
        .run(now, now),
      /CHECK/u,
    );
  });

  it("enforces valid version, lifecycle and classification values", () => {
    const database = db();
    assert.throws(
      () => database.prepare(`INSERT INTO warehouses
        (id, company_id, code, title, kind, status, organizational_scope, branch_id, created_at, updated_at, version)
        VALUES ('w1', 'company-1', 'WH-01', 'Warehouse', 'invalid', 'active', 'company', NULL, ?, ?, 1)`)
        .run(now, now),
      /CHECK/u,
    );
    assert.throws(
      () => database.prepare(`INSERT INTO warehouses
        (id, company_id, code, title, kind, status, organizational_scope, branch_id, created_at, updated_at, version)
        VALUES ('w2', 'company-1', 'WH-02', 'Warehouse', 'general', 'active', 'company', NULL, ?, ?, 0)`)
        .run(now, now),
      /CHECK/u,
    );
  });
});
