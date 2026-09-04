import type { DatabaseSession } from "@argin/database";
import {
  WarehouseApplicationError,
  rehydrateClassifiedWarehouse,
  rehydrateOrganizedWarehouse,
  rehydrateWarehouse,
  rehydrateWarehouseLocation,
  rehydrateWarehouseZone,
  type WarehouseBranchReference,
  type WarehouseLocationRepository,
  type WarehouseLocationSnapshot,
  type WarehousePersistenceState,
  type WarehouseRepository,
  type WarehouseZoneRepository,
  type WarehouseZoneSnapshot,
} from "@argin/warehouse";

type WarehouseRow = {
  id: string;
  company_id: string;
  code: string;
  title: string;
  description: string | null;
  kind: WarehousePersistenceState["warehouse"]["kind"];
  status: WarehousePersistenceState["warehouse"]["status"];
  organizational_scope: "company" | "branch";
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

type ExternalRow = { namespace: string; value: string };
type BranchRow = { id: string; company_id: string; status: "active" | "inactive" };
type ZoneRow = {
  id: string; company_id: string; warehouse_id: string; code: string; title: string;
  description: string | null; status: "active" | "inactive"; created_at: string; updated_at: string;
};
type LocationRow = {
  id: string; company_id: string; warehouse_id: string; zone_id: string; parent_location_id: string | null;
  code: string; title: string; kind: WarehouseLocationSnapshot["kind"]; description: string | null;
  status: "active" | "inactive"; created_at: string; updated_at: string;
};

const mapWriteError = (error: unknown): never => {
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (text.includes("unique constraint failed") || text.includes("uq_warehouse")) {
    throw new WarehouseApplicationError("warehouse.application.duplicate-identifier");
  }
  throw error;
};

const loadBranch = async (db: DatabaseSession, row: WarehouseRow): Promise<WarehouseBranchReference | undefined> => {
  if (row.organizational_scope === "company") return undefined;
  const branch = await db.queryOne<BranchRow>(
    "SELECT id, company_id, status FROM branches WHERE company_id = ? AND id = ?",
    [row.company_id, row.branch_id],
  );
  if (!branch) throw new WarehouseApplicationError("warehouse.application.branch-reference-invalid");
  return Object.freeze({ branchId: branch.id, companyId: branch.company_id, status: branch.status });
};

const hydrateWarehouse = async (db: DatabaseSession, row: WarehouseRow): Promise<WarehousePersistenceState> => {
  const base = rehydrateWarehouse({
    warehouseId: row.id, companyId: row.company_id, code: row.code, title: row.title,
    description: row.description, createdAt: row.created_at, updatedAt: row.updated_at,
  });
  const classified = rehydrateClassifiedWarehouse({ ...base, kind: row.kind, status: row.status });
  const scope = row.organizational_scope === "company"
    ? ({ mode: "company" } as const)
    : ({ mode: "branch", branchId: row.branch_id ?? "" } as const);
  const branch = await loadBranch(db, row);
  const warehouse = rehydrateOrganizedWarehouse({ ...classified, organizationalScope: scope }, branch);
  const externalIdentifiers = await db.query<ExternalRow>(
    "SELECT namespace, value FROM warehouse_external_identifiers WHERE company_id = ? AND warehouse_id = ? ORDER BY namespace, value",
    [row.company_id, row.id],
  );
  return Object.freeze({
    warehouse,
    externalIdentifiers: Object.freeze(externalIdentifiers.map((item) => Object.freeze({ ...item }))),
    version: row.version,
  });
};

const replaceExternalIdentifiers = async (db: DatabaseSession, state: WarehousePersistenceState): Promise<void> => {
  await db.execute(
    "DELETE FROM warehouse_external_identifiers WHERE company_id = ? AND warehouse_id = ?",
    [state.warehouse.companyId, state.warehouse.warehouseId],
  );
  for (const identifier of state.externalIdentifiers) {
    await db.execute(
      "INSERT INTO warehouse_external_identifiers (company_id, warehouse_id, namespace, value) VALUES (?, ?, ?, ?)",
      [state.warehouse.companyId, state.warehouse.warehouseId, identifier.namespace, identifier.value],
    );
  }
};

export class SqliteWarehouseRepository implements WarehouseRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findById(companyId: string, warehouseId: string): Promise<WarehousePersistenceState | null> {
    const row = await this.db.queryOne<WarehouseRow>("SELECT * FROM warehouses WHERE company_id = ? AND id = ?", [companyId, warehouseId]);
    return row ? hydrateWarehouse(this.db, row) : null;
  }

  async findByCode(companyId: string, code: string): Promise<WarehousePersistenceState | null> {
    const row = await this.db.queryOne<WarehouseRow>("SELECT * FROM warehouses WHERE company_id = ? AND code = ? COLLATE NOCASE", [companyId, code]);
    return row ? hydrateWarehouse(this.db, row) : null;
  }

  async findByExternalIdentifier(companyId: string, namespace: string, value: string): Promise<WarehousePersistenceState | null> {
    const row = await this.db.queryOne<WarehouseRow>(
      `SELECT w.* FROM warehouses w
       JOIN warehouse_external_identifiers i ON i.company_id = w.company_id AND i.warehouse_id = w.id
       WHERE i.company_id = ? AND i.namespace = ? COLLATE NOCASE AND i.value = ?`,
      [companyId, namespace, value],
    );
    return row ? hydrateWarehouse(this.db, row) : null;
  }

  async add(state: WarehousePersistenceState): Promise<void> {
    const scope = state.warehouse.organizationalScope;
    try {
      await this.db.execute(
        `INSERT INTO warehouses
         (id, company_id, code, title, description, kind, status, organizational_scope, branch_id, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [state.warehouse.warehouseId, state.warehouse.companyId, state.warehouse.code, state.warehouse.title,
          state.warehouse.description, state.warehouse.kind, state.warehouse.status, scope.mode,
          scope.mode === "branch" ? scope.branchId : null, state.warehouse.createdAt, state.warehouse.updatedAt, state.version],
      );
      await replaceExternalIdentifiers(this.db, state);
    } catch (error) { mapWriteError(error); }
  }

  async update(state: WarehousePersistenceState, expectedVersion: number): Promise<void> {
    const scope = state.warehouse.organizationalScope;
    try {
      const result = await this.db.execute(
        `UPDATE warehouses SET code=?, title=?, description=?, kind=?, status=?, organizational_scope=?, branch_id=?, updated_at=?, version=?
         WHERE company_id=? AND id=? AND version=?`,
        [state.warehouse.code, state.warehouse.title, state.warehouse.description, state.warehouse.kind,
          state.warehouse.status, scope.mode, scope.mode === "branch" ? scope.branchId : null,
          state.warehouse.updatedAt, state.version, state.warehouse.companyId, state.warehouse.warehouseId, expectedVersion],
      );
      if (result.rowsAffected !== 1) {
        const exists = await this.db.queryOne<{ id: string }>(
          "SELECT id FROM warehouses WHERE company_id=? AND id=?",
          [state.warehouse.companyId, state.warehouse.warehouseId],
        );
        throw new WarehouseApplicationError(
          exists ? "warehouse.application.concurrency-conflict" : "warehouse.application.not-found",
        );
      }
      await replaceExternalIdentifiers(this.db, state);
    } catch (error) {
      if (error instanceof WarehouseApplicationError) throw error;
      mapWriteError(error);
    }
  }
}

const mapZone = (row: ZoneRow): WarehouseZoneSnapshot => rehydrateWarehouseZone({
  zoneId: row.id, warehouseId: row.warehouse_id, companyId: row.company_id,
  code: row.code, title: row.title, description: row.description, status: row.status,
  createdAt: row.created_at, updatedAt: row.updated_at,
});

export class SqliteWarehouseZoneRepository implements WarehouseZoneRepository {
  constructor(private readonly db: DatabaseSession) {}
  async findById(companyId: string, zoneId: string): Promise<WarehouseZoneSnapshot | null> {
    const row = await this.db.queryOne<ZoneRow>("SELECT * FROM warehouse_zones WHERE company_id=? AND id=?", [companyId, zoneId]);
    return row ? mapZone(row) : null;
  }
  async listByWarehouse(companyId: string, warehouseId: string): Promise<readonly WarehouseZoneSnapshot[]> {
    const rows = await this.db.query<ZoneRow>("SELECT * FROM warehouse_zones WHERE company_id=? AND warehouse_id=? ORDER BY code,id", [companyId, warehouseId]);
    return Object.freeze(rows.map(mapZone));
  }
  async add(zone: WarehouseZoneSnapshot): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO warehouse_zones (id,company_id,warehouse_id,code,title,description,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [zone.zoneId, zone.companyId, zone.warehouseId, zone.code, zone.title, zone.description, zone.status, zone.createdAt, zone.updatedAt],
      );
    } catch (error) { mapWriteError(error); }
  }
  async update(zone: WarehouseZoneSnapshot): Promise<void> {
    try {
      const result = await this.db.execute(
        `UPDATE warehouse_zones SET code=?,title=?,description=?,status=?,updated_at=?
         WHERE company_id=? AND warehouse_id=? AND id=?`,
        [zone.code, zone.title, zone.description, zone.status, zone.updatedAt, zone.companyId, zone.warehouseId, zone.zoneId],
      );
      if (result.rowsAffected !== 1) throw new WarehouseApplicationError("warehouse.application.not-found");
    } catch (error) {
      if (error instanceof WarehouseApplicationError) throw error;
      mapWriteError(error);
    }
  }
}

const locationSnapshot = (row: LocationRow): WarehouseLocationSnapshot => ({
  locationId: row.id, zoneId: row.zone_id, warehouseId: row.warehouse_id, companyId: row.company_id,
  parentLocationId: row.parent_location_id, code: row.code, title: row.title, kind: row.kind,
  description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
});

export class SqliteWarehouseLocationRepository implements WarehouseLocationRepository {
  constructor(private readonly db: DatabaseSession) {}
  private async hydrate(row: LocationRow): Promise<WarehouseLocationSnapshot> {
    const zone = await this.db.queryOne<ZoneRow>(
      "SELECT * FROM warehouse_zones WHERE company_id=? AND warehouse_id=? AND id=?",
      [row.company_id, row.warehouse_id, row.zone_id],
    );
    if (!zone) throw new WarehouseApplicationError("warehouse.application.not-found");
    return rehydrateWarehouseLocation(locationSnapshot(row), mapZone(zone));
  }
  async findById(companyId: string, locationId: string): Promise<WarehouseLocationSnapshot | null> {
    const row = await this.db.queryOne<LocationRow>("SELECT * FROM warehouse_locations WHERE company_id=? AND id=?", [companyId, locationId]);
    return row ? this.hydrate(row) : null;
  }
  async listByWarehouse(companyId: string, warehouseId: string): Promise<readonly WarehouseLocationSnapshot[]> {
    const rows = await this.db.query<LocationRow>("SELECT * FROM warehouse_locations WHERE company_id=? AND warehouse_id=? ORDER BY zone_id,code,id", [companyId, warehouseId]);
    return Object.freeze(await Promise.all(rows.map((row) => this.hydrate(row))));
  }
  async listByZone(companyId: string, warehouseId: string, zoneId: string): Promise<readonly WarehouseLocationSnapshot[]> {
    const rows = await this.db.query<LocationRow>("SELECT * FROM warehouse_locations WHERE company_id=? AND warehouse_id=? AND zone_id=? ORDER BY code,id", [companyId, warehouseId, zoneId]);
    return Object.freeze(await Promise.all(rows.map((row) => this.hydrate(row))));
  }
  async add(location: WarehouseLocationSnapshot): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO warehouse_locations
         (id,company_id,warehouse_id,zone_id,parent_location_id,code,title,kind,description,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [location.locationId, location.companyId, location.warehouseId, location.zoneId, location.parentLocationId,
          location.code, location.title, location.kind, location.description, location.status, location.createdAt, location.updatedAt],
      );
    } catch (error) { mapWriteError(error); }
  }
  async update(location: WarehouseLocationSnapshot): Promise<void> {
    try {
      const result = await this.db.execute(
        `UPDATE warehouse_locations SET parent_location_id=?,code=?,title=?,kind=?,description=?,status=?,updated_at=?
         WHERE company_id=? AND warehouse_id=? AND zone_id=? AND id=?`,
        [location.parentLocationId, location.code, location.title, location.kind, location.description, location.status,
          location.updatedAt, location.companyId, location.warehouseId, location.zoneId, location.locationId],
      );
      if (result.rowsAffected !== 1) throw new WarehouseApplicationError("warehouse.application.not-found");
    } catch (error) {
      if (error instanceof WarehouseApplicationError) throw error;
      mapWriteError(error);
    }
  }
}
