import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const read = (name: string): string => readFileSync(
  new URL(`../src-tauri/migrations/${name}`, import.meta.url),
  "utf8",
);
const runner = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const company = read("0002_company_and_branch.sql");
const warehouse = read("0022_warehouses.sql");
const sync = read("0023_warehouse_sync_metadata.sql");
const idempotency = read("0024_warehouse_idempotency.sql");
const maintenance = read("0025_warehouse_maintenance_tombstones.sql");
const now = "2026-09-06T07:00:00.000Z";

function database(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of [company, warehouse, sync, idempotency, maintenance]) db.exec(migration);
  db.prepare("INSERT INTO companies (id, code, legal_name, created_at, updated_at) VALUES ('c1','C1','Company',?,?)").run(now, now);
  db.prepare(`INSERT INTO branches
    (id,company_id,code,name,is_head_office,status,created_at,updated_at)
    VALUES ('b1','c1','B1','Branch',1,'active',?,?)`).run(now, now);
  return db;
}

test("desktop runner registers the complete Warehouse migration chain 22 through 25", () => {
  for (const [version, file] of [
    [22, "0022_warehouses.sql"],
    [23, "0023_warehouse_sync_metadata.sql"],
    [24, "0024_warehouse_idempotency.sql"],
    [25, "0025_warehouse_maintenance_tombstones.sql"],
  ] as const) {
    assert.match(runner, new RegExp(`version:\\s*${version}`, "u"));
    assert.ok(runner.includes(file));
  }
});

test("Warehouse migrations 22 through 25 apply sequentially to a real SQLite database", () => {
  const db = database();
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
    const names = new Set(tables.map((row) => row.name));
    for (const expected of [
      "warehouses",
      "warehouse_external_identifiers",
      "warehouse_zones",
      "warehouse_locations",
      "warehouse_sync_external_references",
      "warehouse_idempotency",
    ]) assert.equal(names.has(expected), true, `${expected} must exist`);

    const warehouseColumns = db.prepare("PRAGMA table_info(warehouses)").all() as Array<{ name: string }>;
    for (const expected of ["deleted_at", "origin_system", "origin_instance_id", "server_revision", "version"]) {
      assert.equal(warehouseColumns.some((column) => column.name === expected), true, `${expected} must exist on warehouses`);
    }
    const zoneColumns = db.prepare("PRAGMA table_info(warehouse_zones)").all() as Array<{ name: string }>;
    const locationColumns = db.prepare("PRAGMA table_info(warehouse_locations)").all() as Array<{ name: string }>;
    assert.equal(zoneColumns.some((column) => column.name === "deleted_at"), true);
    assert.equal(locationColumns.some((column) => column.name === "deleted_at"), true);
  } finally { db.close(); }
});

test("sync external references stay Company-scoped and unique by source identity", () => {
  const db = database();
  try {
    db.prepare(`INSERT INTO warehouses
      (id,company_id,code,title,kind,status,organizational_scope,branch_id,created_at,updated_at,version)
      VALUES ('w1','c1','W1','Warehouse','general','active','company',NULL,?,?,1)`).run(now, now);
    db.prepare(`INSERT INTO warehouse_sync_external_references
      (id,company_id,warehouse_id,source_system,external_id,created_at,updated_at)
      VALUES ('r1','c1','w1','legacy','X-1',?,?)`).run(now, now);
    assert.throws(() => db.prepare(`INSERT INTO warehouse_sync_external_references
      (id,company_id,warehouse_id,source_system,external_id,created_at,updated_at)
      VALUES ('r2','c1','w1','LEGACY','X-1',?,?)`).run(now, now), /UNIQUE/u);
  } finally { db.close(); }
});

test("maintenance tombstones and idempotency state constraints remain enforceable together", () => {
  const db = database();
  try {
    db.prepare(`INSERT INTO warehouses
      (id,company_id,code,title,kind,status,organizational_scope,branch_id,created_at,updated_at,version)
      VALUES ('w1','c1','W1','Warehouse','general','active','company',NULL,?,?,1)`).run(now, now);
    db.prepare(`INSERT INTO warehouse_zones
      (id,company_id,warehouse_id,code,title,status,created_at,updated_at,deleted_at)
      VALUES ('z1','c1','w1','Z1','Zone','active',?,?,?)`).run(now, now, now);
    const tombstone = db.prepare("SELECT deleted_at FROM warehouse_zones WHERE id='z1'").get() as { deleted_at: string };
    assert.equal(tombstone.deleted_at, now);

    assert.throws(() => db.prepare(`INSERT INTO warehouse_idempotency
      (scope,request_id,status,result_json,created_at,completed_at)
      VALUES ('scope','request','completed',NULL,?,NULL)`).run(now), /CHECK/u);

    db.prepare(`INSERT INTO warehouse_idempotency
      (scope,request_id,status,result_json,created_at,completed_at)
      VALUES ('scope','request','in-progress',NULL,?,NULL)`).run(now);
    assert.throws(() => db.prepare(`INSERT INTO warehouse_idempotency
      (scope,request_id,status,result_json,created_at,completed_at)
      VALUES ('scope','request','in-progress',NULL,?,NULL)`).run(now), /UNIQUE/u);
  } finally { db.close(); }
});
