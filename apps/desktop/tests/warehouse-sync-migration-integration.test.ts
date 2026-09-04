import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

const migrations = [
  "0002_company_and_branch.sql",
  "0022_warehouses.sql",
  "0023_warehouse_sync_metadata.sql",
] as const;

const sql = migrations.map((name) => readFileSync(
  new URL(`../src-tauri/migrations/${name}`, import.meta.url),
  "utf8",
));
const runner = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const now = "2026-09-04T11:00:00.000Z";

function db(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const migration of sql) database.exec(migration);
  database.prepare("INSERT INTO companies (id, code, legal_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run("company-1", "C01", "Company 1", now, now);
  database.prepare(`INSERT INTO warehouses
    (id, company_id, code, title, kind, status, organizational_scope, branch_id, created_at, updated_at, version)
    VALUES ('warehouse-1','company-1','WH-01','Main','general','active','company',NULL,?,?,1)`)
    .run(now, now);
  return database;
}

describe("Phase 19 Warehouse sync metadata migration", () => {
  it("registers migration 23 in the desktop runner", () => {
    assert.match(runner, /version:\s*23/u);
    assert.match(runner, /0023_warehouse_sync_metadata\.sql/u);
  });

  it("stores tombstone, origin and optional server revision metadata", () => {
    const database = db();
    database.prepare(`UPDATE warehouses
      SET deleted_at=?, origin_system='argin-desktop', origin_instance_id='desktop-1', server_revision=17
      WHERE id='warehouse-1'`).run(now);
    const row = database.prepare(`SELECT deleted_at, origin_system, origin_instance_id, server_revision
      FROM warehouses WHERE id='warehouse-1'`).get() as {
        deleted_at: string;
        origin_system: string;
        origin_instance_id: string;
        server_revision: number;
      };
    assert.deepEqual({ ...row }, {
      deleted_at: now,
      origin_system: "argin-desktop",
      origin_instance_id: "desktop-1",
      server_revision: 17,
    });
  });

  it("enforces company-scoped sync external references", () => {
    const database = db();
    database.prepare(`INSERT INTO warehouse_sync_external_references
      (id, company_id, warehouse_id, source_system, external_id, created_at, updated_at)
      VALUES ('ref-1','company-1','warehouse-1','ERP','W-1',?,?)`).run(now, now);
    assert.throws(() => database.prepare(`INSERT INTO warehouse_sync_external_references
      (id, company_id, warehouse_id, source_system, external_id, created_at, updated_at)
      VALUES ('ref-2','company-1','warehouse-1','erp','W-1',?,?)`).run(now, now), /UNIQUE/u);
  });

  it("rejects sync reference to a warehouse in another company", () => {
    const database = db();
    database.prepare("INSERT INTO companies (id, code, legal_name, created_at, updated_at) VALUES ('company-2','C02','Company 2',?,?)")
      .run(now, now);
    assert.throws(() => database.prepare(`INSERT INTO warehouse_sync_external_references
      (id, company_id, warehouse_id, source_system, external_id, created_at, updated_at)
      VALUES ('ref-x','company-2','warehouse-1','ERP','W-X',?,?)`).run(now, now), /FOREIGN KEY/u);
  });
});
