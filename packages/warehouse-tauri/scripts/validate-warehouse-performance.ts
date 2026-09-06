import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const warehouseMigration = readFileSync(
  new URL("../../../apps/desktop/src-tauri/migrations/0022_warehouses.sql", import.meta.url),
  "utf8",
);
const syncMigration = readFileSync(
  new URL("../../../apps/desktop/src-tauri/migrations/0023_warehouse_sync_metadata.sql", import.meta.url),
  "utf8",
);
const maintenanceMigration = readFileSync(
  new URL("../../../apps/desktop/src-tauri/migrations/0025_warehouse_maintenance_tombstones.sql", import.meta.url),
  "utf8",
);

type QueryPlanRow = { detail?: string };

function requirePlan(plan: readonly QueryPlanRow[], acceptedIndexes: readonly string[], label: string): string {
  const text = plan.map((row) => row.detail ?? "").join("\n");
  const matched = acceptedIndexes.find((index) => text.includes(index));
  if (!matched) {
    throw new Error(`${label} did not use an accepted index (${acceptedIndexes.join(", ")}).\n${text}`);
  }
  return matched;
}

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");
database.exec(`
  CREATE TABLE companies (
    id TEXT PRIMARY KEY NOT NULL
  );
  CREATE TABLE branches (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_head_office INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );
  INSERT INTO companies(id) VALUES ('company-1'), ('company-noise');
  INSERT INTO branches(id, company_id, code, name, is_head_office, status, created_at, updated_at)
  VALUES
    ('branch-1', 'company-1', 'B01', 'Branch 1', 1, 'active', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
    ('branch-2', 'company-1', 'B02', 'Branch 2', 0, 'active', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
    ('branch-noise', 'company-noise', 'BN', 'Noise', 1, 'active', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
`);
database.exec(warehouseMigration);
database.exec(syncMigration);
database.exec(maintenanceMigration);

database.exec("BEGIN");
try {
  const insertWarehouse = database.prepare(`
    INSERT INTO warehouses (
      id, company_id, code, title, kind, status, organizational_scope,
      branch_id, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const insertExternal = database.prepare(`
    INSERT INTO warehouse_external_identifiers (
      company_id, warehouse_id, namespace, value
    ) VALUES (?, ?, 'ERP', ?)
  `);

  for (let x = 1; x <= 50_000; x += 1) {
    const scoped = x <= 40_000;
    const companyId = scoped ? "company-1" : "company-noise";
    const id = `warehouse-${String(x).padStart(6, "0")}`;
    const code = `WH-${String(x).padStart(6, "0")}`;
    const title = `Warehouse ${String(x).padStart(6, "0")}`;
    const status = x % 10 === 0 ? "inactive" : "active";
    const kind = x % 7 === 0 ? "raw-material" : x % 11 === 0 ? "finished-goods" : "general";
    const branchScoped = x % 3 !== 0;
    const scope = branchScoped ? "branch" : "company";
    const branchId = branchScoped
      ? (scoped ? (x % 2 === 0 ? "branch-1" : "branch-2") : "branch-noise")
      : null;
    insertWarehouse.run(
      id,
      companyId,
      code,
      title,
      kind,
      status,
      scope,
      branchId,
      "2026-09-01T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
    );
    if (x <= 10_000) insertExternal.run(companyId, id, `EXT-${x}`);
  }

  const insertZone = database.prepare(`
    INSERT INTO warehouse_zones (
      id, company_id, warehouse_id, code, title, status, created_at, updated_at
    ) VALUES (?, 'company-1', 'warehouse-000001', ?, ?, 'active', ?, ?)
  `);
  for (let x = 1; x <= 5_000; x += 1) {
    const suffix = String(x).padStart(5, "0");
    insertZone.run(`zone-${suffix}`, `Z-${suffix}`, `Zone ${suffix}`, "2026-09-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
  }

  const insertLocation = database.prepare(`
    INSERT INTO warehouse_locations (
      id, company_id, warehouse_id, zone_id, parent_location_id,
      code, title, kind, status, created_at, updated_at
    ) VALUES (?, 'company-1', 'warehouse-000001', ?, NULL, ?, ?, 'bin', 'active', ?, ?)
  `);
  for (let x = 1; x <= 20_000; x += 1) {
    const suffix = String(x).padStart(6, "0");
    const zone = `zone-${String(((x - 1) % 5_000) + 1).padStart(5, "0")}`;
    insertLocation.run(`location-${suffix}`, zone, `L-${suffix}`, `Location ${suffix}`, "2026-09-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
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
  FROM warehouses
  WHERE company_id = 'company-1'
    AND status = 'active'
    AND deleted_at IS NULL
  ORDER BY title, id
  LIMIT 50 OFFSET 500
`).all() as readonly QueryPlanRow[];
const listIndex = requirePlan(
  listPlan,
  ["ix_warehouses_company_status_title"],
  "Warehouse list",
);

const branchSelectorPlan = database.prepare(`
  EXPLAIN QUERY PLAN
  SELECT id, code, title
  FROM warehouses
  WHERE company_id = 'company-1'
    AND organizational_scope = 'branch'
    AND branch_id = 'branch-1'
    AND status = 'active'
    AND deleted_at IS NULL
  ORDER BY title, id
  LIMIT 20
`).all() as readonly QueryPlanRow[];
const selectorIndex = requirePlan(
  branchSelectorPlan,
  ["ix_warehouses_company_scope_branch_status"],
  "Branch Warehouse selector",
);

const duplicatePlan = database.prepare(`
  EXPLAIN QUERY PLAN
  SELECT warehouse_id
  FROM warehouse_external_identifiers
  WHERE company_id = 'company-1'
    AND namespace = 'ERP'
    AND value = 'EXT-1234'
  LIMIT 1
`).all() as readonly QueryPlanRow[];
const duplicateIndex = requirePlan(
  duplicatePlan,
  ["uq_warehouse_external_identifiers_company_namespace_value"],
  "Warehouse external-identifier duplicate lookup",
);

const zonePlan = database.prepare(`
  EXPLAIN QUERY PLAN
  SELECT id, code, title
  FROM warehouse_zones
  WHERE company_id = 'company-1'
    AND warehouse_id = 'warehouse-000001'
    AND status = 'active'
    AND deleted_at IS NULL
  ORDER BY code, id
  LIMIT 100
`).all() as readonly QueryPlanRow[];
const zoneIndex = requirePlan(
  zonePlan,
  ["ix_warehouse_zones_active_lookup", "ix_warehouse_zones_warehouse_status_code"],
  "Warehouse Zone lookup",
);

const locationPlan = database.prepare(`
  EXPLAIN QUERY PLAN
  SELECT id, code, title
  FROM warehouse_locations
  WHERE company_id = 'company-1'
    AND warehouse_id = 'warehouse-000001'
    AND zone_id = 'zone-00001'
    AND status = 'active'
    AND deleted_at IS NULL
  ORDER BY code, id
  LIMIT 100
`).all() as readonly QueryPlanRow[];
const locationIndex = requirePlan(
  locationPlan,
  ["ix_warehouse_locations_active_lookup", "ix_warehouse_locations_warehouse_zone_status_code"],
  "Warehouse Location lookup",
);

const activeScopedRows = (database.prepare(`
  SELECT COUNT(*) AS count
  FROM warehouses
  WHERE company_id = 'company-1'
    AND status = 'active'
    AND deleted_at IS NULL
`).get() as { count: number }).count;

if (activeScopedRows !== 36_000) {
  throw new Error(`Expected 36000 active scoped Warehouses, got ${activeScopedRows}.`);
}

console.log(JSON.stringify({
  warehouseRows: 50_000,
  scopedWarehouseRows: 40_000,
  activeScopedWarehouseRows: activeScopedRows,
  zoneRows: 5_000,
  locationRows: 20_000,
  indexes: [listIndex, selectorIndex, duplicateIndex, zoneIndex, locationIndex],
}, null, 2));
