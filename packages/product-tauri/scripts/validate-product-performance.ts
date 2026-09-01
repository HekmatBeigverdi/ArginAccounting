import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync(
  new URL("../../../apps/desktop/src-tauri/migrations/0019_products_services.sql", import.meta.url),
  "utf8",
);
const syncMigration = readFileSync(
  new URL("../../../apps/desktop/src-tauri/migrations/0020_product_sync_metadata.sql", import.meta.url),
  "utf8",
);

function requirePlan(plan: readonly { detail?: string }[], index: string, label: string): void {
  const text = plan.map((row) => row.detail ?? "").join("\n");
  if (!text.includes(index)) {
    throw new Error(`${label} did not use expected index ${index}.\n${text}`);
  }
}

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");
database.exec(`
  CREATE TABLE companies (id TEXT PRIMARY KEY NOT NULL);
  CREATE TABLE taxpayer_units (code TEXT PRIMARY KEY NOT NULL);
  INSERT INTO companies(id) VALUES ('company-1'), ('company-noise');
  INSERT INTO taxpayer_units(code) VALUES ('1627'), ('164');
`);
database.exec(migration);
database.exec(syncMigration);

database.exec("BEGIN");
try {
  const insertProduct = database.prepare(`
    INSERT INTO products (
      id, company_id, code, title, kind, status, category_id,
      purchasable, sellable, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const insertIdentifiers = database.prepare(`
    INSERT INTO product_identifiers (
      company_id, product_id, sku, reference_code, taxpayer_goods_service_id
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertMaster = database.prepare(`
    INSERT INTO product_master_data (
      company_id, product_id, tax_treatment, vat_rate_basis_points,
      stock_tracking, serial_tracking, lot_tracking, shelf_life_days
    ) VALUES (?, ?, 'unspecified', NULL, ?, 0, 0, NULL)
  `);

  for (let x = 1; x <= 50_000; x += 1) {
    const scoped = x <= 40_000;
    const companyId = scoped ? "company-1" : "company-noise";
    const id = `product-${String(x).padStart(6, "0")}`;
    const code = `PRD-${String(x).padStart(6, "0")}`;
    const title = `Product ${String(x).padStart(6, "0")}`;
    const kind = x % 5 === 0 ? "service" : "product";
    const status = x % 10 === 0 ? "inactive" : "active";
    const purchasable = x % 3 === 0 ? 0 : 1;
    const sellable = x % 4 === 0 ? 0 : 1;
    const stockTracking = kind === "product" && x % 2 === 0 ? 1 : 0;
    const taxpayerId = scoped ? `272${String(x).padStart(10, "0")}` : null;
    insertProduct.run(
      id,
      companyId,
      code,
      title,
      kind,
      status,
      x % 7 === 0 ? "category-1" : null,
      purchasable,
      sellable,
      "2026-09-01T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
    );
    insertIdentifiers.run(companyId, id, scoped ? `SKU-${x}` : null, null, taxpayerId);
    insertMaster.run(companyId, id, stockTracking);
  }
  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
}

database.exec("ANALYZE");

const listPlan = database.prepare(`
  EXPLAIN QUERY PLAN
  SELECT id, code, title
  FROM products
  WHERE company_id = 'company-1'
    AND status = 'active'
    AND deleted_at IS NULL
  ORDER BY title, id
  LIMIT 40 OFFSET 400
`).all() as readonly { detail?: string }[];
requirePlan(listPlan, "ix_products_company_status_title", "Product list");

const selectorPlan = database.prepare(`
  EXPLAIN QUERY PLAN
  SELECT p.id, p.code, p.title
  FROM products p
  LEFT JOIN product_master_data m
    ON m.company_id = p.company_id AND m.product_id = p.id
  WHERE p.company_id = 'company-1'
    AND p.kind = 'product'
    AND p.status = 'active'
    AND p.deleted_at IS NULL
    AND m.stock_tracking = 1
  ORDER BY p.title, p.code, p.id
  LIMIT 20
`).all() as readonly { detail?: string }[];
requirePlan(selectorPlan, "ix_products_company_kind_status_title", "Inventory selector");

const duplicatePlan = database.prepare(`
  EXPLAIN QUERY PLAN
  SELECT product_id
  FROM product_identifiers
  WHERE company_id = 'company-1' AND sku = 'SKU-1234'
  LIMIT 1
`).all() as readonly { detail?: string }[];
requirePlan(duplicatePlan, "uq_product_identifiers_company_sku", "SKU duplicate lookup");

const activeCount = (database.prepare(`
  SELECT COUNT(*) AS count
  FROM products
  WHERE company_id = 'company-1' AND status = 'active' AND deleted_at IS NULL
`).get() as { count: number }).count;

if (activeCount !== 36_000) {
  throw new Error(`Expected 36000 active scoped Products, got ${activeCount}.`);
}

console.log(JSON.stringify({
  datasetRows: 50_000,
  scopedRows: 40_000,
  activeScopedRows: activeCount,
  indexes: [
    "ix_products_company_status_title",
    "ix_products_company_kind_status_title",
    "uq_product_identifiers_company_sku",
  ],
}, null, 2));
