import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

const migrations = [
  "0002_company_and_branch.sql",
  "0018_taxpayer_unit_reference_data.sql",
  "0019_products_services.sql",
  "0020_product_sync_metadata.sql",
  "0021_product_idempotency.sql",
] as const;

const sql = migrations.map((name) => readFileSync(
  new URL(`../src-tauri/migrations/${name}`, import.meta.url),
  "utf8",
));
const runner = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const now = "2026-09-01T08:30:00.000Z";

function db(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const migration of sql) database.exec(migration);
  database.prepare("INSERT INTO companies (id, code, legal_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run("company-1", "C01", "Company 1", now, now);
  database.prepare("INSERT INTO companies (id, code, legal_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run("company-2", "C02", "Company 2", now, now);
  return database;
}

function insertProduct(database: DatabaseSync, id: string, companyId: string, code: string): void {
  database.prepare(`INSERT INTO products
    (id, company_id, code, title, kind, status, purchasable, sellable, created_at, updated_at, version)
    VALUES (?, ?, ?, ?, 'product', 'active', 1, 1, ?, ?, 1)`)
    .run(id, companyId, code, `Product ${code}`, now, now);
  database.prepare(`INSERT INTO product_identifiers
    (company_id, product_id, sku, reference_code, taxpayer_goods_service_id)
    VALUES (?, ?, NULL, NULL, NULL)`).run(companyId, id);
  database.prepare(`INSERT INTO product_master_data
    (company_id, product_id, tax_treatment, vat_rate_basis_points, stock_tracking, serial_tracking, lot_tracking)
    VALUES (?, ?, 'unspecified', NULL, 0, 0, 0)`).run(companyId, id);
}

describe("Phase 18 Product migrations", () => {
  it("registers migrations 18 through 21 in the desktop runner", () => {
    for (const version of [18, 19, 20, 21]) assert.match(runner, new RegExp(`version:\\s*${version}`));
    assert.match(runner, /0019_products_services\.sql/u);
    assert.match(runner, /0020_product_sync_metadata\.sql/u);
    assert.match(runner, /0021_product_idempotency\.sql/u);
  });

  it("upgrades schema and persists product master data with official unit mapping", () => {
    const database = db();
    insertProduct(database, "product-1", "company-1", "PRD-001");
    database.prepare(`INSERT INTO product_units
      (company_id, product_id, unit_id, code, title, ratio_to_base, precision, rounding_mode, taxpayer_unit_code, is_base)
      VALUES (?, ?, 'u-kg', 'KG', 'کیلوگرم', 1, 3, 'half-up', '164', 1)`)
      .run("company-1", "product-1");
    const row = database.prepare(`SELECT p.code, u.taxpayer_unit_code
      FROM products p JOIN product_units u ON u.product_id=p.id WHERE p.id=?`).get("product-1") as { code: string; taxpayer_unit_code: string };
    assert.deepEqual(row, { code: "PRD-001", taxpayer_unit_code: "164" });
  });

  it("enforces company-scoped identifiers while allowing same identifier in another company", () => {
    const database = db();
    insertProduct(database, "p1", "company-1", "A");
    insertProduct(database, "p2", "company-2", "A");
    database.prepare("UPDATE product_identifiers SET sku='SKU-1' WHERE product_id='p1'").run();
    database.prepare("UPDATE product_identifiers SET sku='SKU-1' WHERE product_id='p2'").run();
    insertProduct(database, "p3", "company-1", "B");
    assert.throws(() => database.prepare("UPDATE product_identifiers SET sku='SKU-1' WHERE product_id='p3'").run(), /UNIQUE/u);
  });

  it("rejects cross-company children and unknown Taxpayer unit codes", () => {
    const database = db();
    insertProduct(database, "p1", "company-1", "A");
    assert.throws(() => database.prepare(`INSERT INTO product_barcodes (company_id, product_id, barcode) VALUES ('company-2','p1','6261')`).run(), /FOREIGN KEY/u);
    assert.throws(() => database.prepare(`INSERT INTO product_units
      (company_id, product_id, unit_id, code, title, ratio_to_base, precision, rounding_mode, taxpayer_unit_code, is_base)
      VALUES ('company-1','p1','u','EA','Each',1,0,'half-up','999999',1)`).run(), /FOREIGN KEY/u);
  });

  it("supports tombstone metadata and constrains idempotency state", () => {
    const database = db();
    insertProduct(database, "p1", "company-1", "A");
    database.prepare("UPDATE products SET deleted_at=? WHERE id='p1'").run(now);
    const tombstone = database.prepare("SELECT deleted_at FROM products WHERE id='p1'").get() as { deleted_at: string };
    assert.equal(tombstone.deleted_at, now);
    database.prepare(`INSERT INTO product_idempotency
      (scope, request_id, status, result_json, created_at, completed_at)
      VALUES ('product:create:company-1','r1','completed','{}',?,?)`).run(now, now);
    assert.throws(() => database.prepare(`INSERT INTO product_idempotency
      (scope, request_id, status, result_json, created_at, completed_at)
      VALUES ('product:create:company-1','r2','completed',NULL,?,NULL)`).run(now), /CHECK/u);
  });

  it("rolls back a multi-table Product write when a child constraint fails", () => {
    const database = db();
    assert.throws(() => {
      database.exec("BEGIN");
      try {
        insertProduct(database, "rollback-product", "company-1", "ROLL");
        database.prepare(`INSERT INTO product_units
          (company_id, product_id, unit_id, code, title, ratio_to_base, precision, rounding_mode, taxpayer_unit_code, is_base)
          VALUES ('company-1','rollback-product','bad','BAD','Bad',0,0,'half-up','164',1)`).run();
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }, /CHECK/u);
    const count = database.prepare("SELECT COUNT(*) AS count FROM products WHERE id='rollback-product'").get() as { count: number };
    assert.equal(count.count, 0);
  });
});
