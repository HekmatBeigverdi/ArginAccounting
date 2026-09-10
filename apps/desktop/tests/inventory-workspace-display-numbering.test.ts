import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import type { DatabaseExecutor, DatabaseValue } from "@argin/database";
import type { InventoryDocumentLineSnapshot } from "@argin/inventory";
import { ensureInventoryNumberSeries } from "../../../packages/inventory-tauri/src/ensure-inventory-number-series.ts";
import { SqliteInventoryWorkspaceReader } from "../../../packages/inventory-tauri/src/sqlite-inventory-workspace-reader.ts";
import { SqliteFiscalUnitOfWork } from "../../../packages/fiscal-tauri/src/sqlite-fiscal-unit-of-work.ts";
import { formatInventoryLineLocation } from "../src/pages/inventory/inventory-line-location.ts";

function executor(db: DatabaseSync): DatabaseExecutor {
  const values = (parameters: readonly DatabaseValue[] = []): SQLInputValue[] =>
    parameters.map((value) =>
      typeof value === "boolean" ? Number(value) : value,
    );
  const database: DatabaseExecutor = {
    async execute(sql, parameters) {
      const result = db.prepare(sql).run(...values(parameters));
      return { rowsAffected: Number(result.changes) };
    },
    async query<T>(sql: string, parameters?: readonly DatabaseValue[]) {
      return db.prepare(sql).all(...values(parameters)) as T[];
    },
    async queryOne<T>(sql: string, parameters?: readonly DatabaseValue[]) {
      return (db.prepare(sql).get(...values(parameters)) ?? null) as T | null;
    },
    async transaction(operation) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = await operation(database);
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    async close() {
      db.close();
    },
  };
  return database;
}

test("missing inventory numbering is created once and existing configuration is preserved", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE companies(id TEXT PRIMARY KEY);
      CREATE TABLE branches(id TEXT PRIMARY KEY);
      CREATE TABLE fiscal_years(id TEXT PRIMARY KEY);
      INSERT INTO companies VALUES ('company-1'), ('company-2');`);
    const migration = await readFile(
      new URL(
        "../src-tauri/migrations/0003_fiscal_management.sql",
        import.meta.url,
      ),
      "utf8",
    );
    db.exec(migration.slice(migration.indexOf("CREATE TABLE number_series")));
    const database = executor(db);
    await database.transaction(async (session) => {
      await ensureInventoryNumberSeries(session, "company-1", "receipt");
      const fiscal = SqliteFiscalUnitOfWork.fromSession(session);
      await fiscal.run(async ({ numberSeries }) => {
        const series = await numberSeries.findApplicable(
          "company-1",
          null,
          null,
          "inventory.receipt",
        );
        assert.ok(series);
        assert.equal(series.paddingLength, 6);
        assert.equal(
          (await numberSeries.reserveNext(series.id)).reservedNumber,
          1,
        );
      });
      await ensureInventoryNumberSeries(session, "company-1", "receipt");
    });
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM number_series").get()?.count,
      1,
    );
    assert.equal(
      db.prepare("SELECT next_number FROM number_series").get()?.next_number,
      2,
    );
    db.exec(
      "UPDATE number_series SET is_active=0, prefix='CUSTOM-', next_number=42",
    );
    await ensureInventoryNumberSeries(database, "company-1", "receipt");
    assert.equal(
      db.prepare("SELECT next_number FROM number_series").get()?.next_number,
      42,
    );
    assert.equal(
      db.prepare("SELECT is_active FROM number_series").get()?.is_active,
      0,
    );
    await assert.rejects(
      () =>
        database.transaction(async (session) => {
          await ensureInventoryNumberSeries(session, "company-2", "receipt");
          throw new Error("submission failed");
        }),
      /submission failed/,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM number_series").get()?.count,
      1,
    );
    await ensureInventoryNumberSeries(database, "company-2", "receipt");
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM number_series").get()?.count,
      2,
    );
  } finally {
    db.close();
  }
});

test("line location titles include inactive masters, respect company scope and render readable paths", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE inventory_document_lines(id TEXT, company_id TEXT, document_id TEXT,
      product_id TEXT, warehouse_id TEXT, zone_id TEXT, location_id TEXT,
      destination_warehouse_id TEXT, destination_zone_id TEXT, destination_location_id TEXT);
      CREATE TABLE products(id TEXT, company_id TEXT, code TEXT, title TEXT);
      CREATE TABLE warehouses(id TEXT, company_id TEXT, title TEXT, status TEXT);
      CREATE TABLE warehouse_zones(id TEXT, company_id TEXT, warehouse_id TEXT, title TEXT);
      CREATE TABLE warehouse_locations(id TEXT, company_id TEXT, warehouse_id TEXT, zone_id TEXT, title TEXT);
      INSERT INTO products VALUES ('product','c','P-001','کالای آزمایشی');
      INSERT INTO warehouses VALUES ('w','c','انبار اصلی','inactive'), ('dest','c','انبار مقصد','active'), ('w','other','نام شرکت دیگر','active');
      INSERT INTO warehouse_zones VALUES ('z','c','w','ناحیه اول');
      INSERT INTO warehouse_locations VALUES ('p','c','w','z','قفسه دوم');
      INSERT INTO inventory_document_lines VALUES ('line','c','doc','product','w','z','p','dest',NULL,NULL);`);
    const reader = new SqliteInventoryWorkspaceReader(executor(db));
    const titles = await reader.getLineLocationTitles("c", "doc");
    assert.equal(titles.length, 1);
    assert.equal(titles[0]?.productTitle, "کالای آزمایشی");
    assert.equal(titles[0]?.productCode, "P-001");
    const line = {
      operation: {
        warehouse: { warehouseId: "w", zoneId: "z", locationId: "p" },
        destination: { warehouseId: "dest", zoneId: null, locationId: null },
      },
    } as InventoryDocumentLineSnapshot;
    assert.equal(
      formatInventoryLineLocation(line, titles[0]),
      "انبار اصلی / ناحیه اول / قفسه دوم",
    );
    assert.equal(
      formatInventoryLineLocation(line, titles[0], true),
      "انبار مقصد",
    );
    assert.deepEqual(await reader.getLineLocationTitles("other", "doc"), []);
    assert.equal(
      formatInventoryLineLocation(line, undefined),
      "نام انبار در دسترس نیست / نام ناحیه در دسترس نیست / نام موقعیت در دسترس نیست",
    );
  } finally {
    db.close();
  }
});
