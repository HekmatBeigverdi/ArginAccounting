import type { DatabaseSession, DatabaseValue } from "@argin/database";
import {
  WAREHOUSE_QUERY_LIMITS,
  WarehouseApplicationError,
  type GetWarehouseByCodeQuery,
  type GetWarehouseByIdQuery,
  type ListWarehouseLocationsQuery,
  type ListWarehousesQuery,
  type ListWarehouseZonesQuery,
  type WarehouseDto,
  type WarehouseListItemDto,
  type WarehouseLocationDto,
  type WarehousePageDto,
  type WarehouseReader,
  type WarehouseSelectorQuery,
  type WarehouseSortField,
  type WarehouseZoneDto,
} from "@argin/warehouse";

import {
  SqliteWarehouseLocationRepository,
  SqliteWarehouseRepository,
  SqliteWarehouseZoneRepository,
} from "./sqlite-warehouse-repositories.ts";

type WarehouseListRow = {
  id: string;
  code: string;
  title: string;
  kind: WarehouseListItemDto["kind"];
  status: WarehouseListItemDto["status"];
  organizational_scope: "company" | "branch";
  branch_id: string | null;
  version: number;
};

type CountRow = { count: number };

const toListItem = (row: WarehouseListRow): WarehouseListItemDto => Object.freeze({
  warehouseId: row.id,
  code: row.code,
  title: row.title,
  kind: row.kind,
  status: row.status,
  organizationalScope: row.organizational_scope === "company"
    ? Object.freeze({ mode: "company" as const })
    : Object.freeze({ mode: "branch" as const, branchId: row.branch_id ?? "" }),
  version: row.version,
});

const toDto = (state: Awaited<ReturnType<SqliteWarehouseRepository["findById"]>>): WarehouseDto | null => {
  if (!state) return null;
  return Object.freeze({
    warehouseId: state.warehouse.warehouseId,
    companyId: state.warehouse.companyId,
    code: state.warehouse.code,
    title: state.warehouse.title,
    description: state.warehouse.description,
    kind: state.warehouse.kind,
    status: state.warehouse.status,
    organizationalScope: state.warehouse.organizationalScope,
    externalIdentifiers: state.externalIdentifiers,
    version: state.version,
    createdAt: state.warehouse.createdAt,
    updatedAt: state.warehouse.updatedAt,
  });
};

const assertPage = (page: number, pageSize: number): void => {
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize)
    || pageSize < WAREHOUSE_QUERY_LIMITS.minPageSize
    || pageSize > WAREHOUSE_QUERY_LIMITS.maxPageSize) {
    throw new WarehouseApplicationError("warehouse.application.invalid-request");
  }
};

const assertSelectorLimit = (limit: number): void => {
  if (!Number.isInteger(limit)
    || limit < WAREHOUSE_QUERY_LIMITS.minSelectorLimit
    || limit > WAREHOUSE_QUERY_LIMITS.maxSelectorLimit) {
    throw new WarehouseApplicationError("warehouse.application.invalid-request");
  }
};

const placeholders = (count: number): string => Array.from({ length: count }, () => "?").join(",");

const sortColumn = (field: WarehouseSortField | undefined): string => ({
  code: "w.code",
  title: "w.title",
  kind: "w.kind",
  status: "w.status",
  createdAt: "w.created_at",
  updatedAt: "w.updated_at",
}[field ?? "code"] ?? "w.code");

const buildWarehouseFilter = (input: {
  companyId: string;
  search?: string | null | undefined;
  kinds?: readonly string[] | undefined;
  statuses?: readonly string[] | undefined;
  branchId?: string | null | undefined;
  includeCompanyWide?: boolean | undefined;
  companyWideOnly?: boolean | undefined;
  externalIdentifierNamespace?: string | null | undefined;
  externalIdentifierValue?: string | null | undefined;
}): { where: string; parameters: DatabaseValue[]; join: string } => {
  const clauses = ["w.company_id = ?", "w.deleted_at IS NULL"];
  const parameters: DatabaseValue[] = [input.companyId];
  let join = "";

  const search = input.search?.trim();
  if (search) {
    clauses.push("(w.code LIKE ? COLLATE NOCASE OR w.title LIKE ?)");
    parameters.push(`%${search}%`, `%${search}%`);
  }
  if (input.kinds?.length) {
    clauses.push(`w.kind IN (${placeholders(input.kinds.length)})`);
    parameters.push(...input.kinds);
  }
  if (input.statuses?.length) {
    clauses.push(`w.status IN (${placeholders(input.statuses.length)})`);
    parameters.push(...input.statuses);
  }
  if (input.companyWideOnly) {
    clauses.push("w.organizational_scope = 'company'");
  } else if (input.branchId) {
    clauses.push(input.includeCompanyWide
      ? "((w.organizational_scope = 'branch' AND w.branch_id = ?) OR w.organizational_scope = 'company')"
      : "(w.organizational_scope = 'branch' AND w.branch_id = ?)");
    parameters.push(input.branchId);
  }
  if (input.externalIdentifierNamespace || input.externalIdentifierValue) {
    join = " JOIN warehouse_external_identifiers i ON i.company_id = w.company_id AND i.warehouse_id = w.id ";
    if (input.externalIdentifierNamespace) {
      clauses.push("i.namespace = ? COLLATE NOCASE");
      parameters.push(input.externalIdentifierNamespace);
    }
    if (input.externalIdentifierValue) {
      clauses.push("i.value = ?");
      parameters.push(input.externalIdentifierValue);
    }
  }

  return { where: clauses.join(" AND "), parameters, join };
};

export class SqliteWarehouseReader implements WarehouseReader {
  private readonly warehouses: SqliteWarehouseRepository;
  private readonly zones: SqliteWarehouseZoneRepository;
  private readonly locations: SqliteWarehouseLocationRepository;

  constructor(private readonly database: DatabaseSession) {
    this.warehouses = new SqliteWarehouseRepository(database);
    this.zones = new SqliteWarehouseZoneRepository(database);
    this.locations = new SqliteWarehouseLocationRepository(database);
  }

  async getById(query: GetWarehouseByIdQuery): Promise<WarehouseDto | null> {
    return toDto(await this.warehouses.findById(query.companyId, query.warehouseId));
  }

  async getByCode(query: GetWarehouseByCodeQuery): Promise<WarehouseDto | null> {
    return toDto(await this.warehouses.findByCode(query.companyId, query.code));
  }

  async list(query: ListWarehousesQuery): Promise<WarehousePageDto<WarehouseListItemDto>> {
    assertPage(query.page.page, query.page.pageSize);
    const filter = buildWarehouseFilter(query.filter);
    const direction = query.sort?.direction === "desc" ? "DESC" : "ASC";
    const offset = (query.page.page - 1) * query.page.pageSize;

    const rows = await this.database.query<WarehouseListRow>(
      `SELECT DISTINCT w.id,w.code,w.title,w.kind,w.status,w.organizational_scope,w.branch_id,w.version
       FROM warehouses w ${filter.join}
       WHERE ${filter.where}
       ORDER BY ${sortColumn(query.sort?.field)} ${direction}, w.id ASC
       LIMIT ? OFFSET ?`,
      [...filter.parameters, query.page.pageSize, offset],
    );
    const count = await this.database.queryOne<CountRow>(
      `SELECT COUNT(DISTINCT w.id) AS count FROM warehouses w ${filter.join} WHERE ${filter.where}`,
      filter.parameters,
    );
    return Object.freeze({
      items: Object.freeze(rows.map(toListItem)),
      page: query.page.page,
      pageSize: query.page.pageSize,
      totalCount: count?.count ?? 0,
    });
  }

  async select(query: WarehouseSelectorQuery): Promise<readonly WarehouseListItemDto[]> {
    assertSelectorLimit(query.limit);
    const filter = buildWarehouseFilter({
      companyId: query.companyId,
      search: query.search,
      kinds: query.kinds,
      statuses: query.statuses,
      branchId: query.branchId,
      includeCompanyWide: query.includeCompanyWide,
      companyWideOnly: query.companyWideOnly,
    });
    const rows = await this.database.query<WarehouseListRow>(
      `SELECT DISTINCT w.id,w.code,w.title,w.kind,w.status,w.organizational_scope,w.branch_id,w.version
       FROM warehouses w ${filter.join}
       WHERE ${filter.where}
       ORDER BY w.code ASC,w.id ASC LIMIT ?`,
      [...filter.parameters, query.limit],
    );
    return Object.freeze(rows.map(toListItem));
  }

  async listZones(query: ListWarehouseZonesQuery): Promise<readonly WarehouseZoneDto[]> {
    const zones = await this.zones.listByWarehouse(query.companyId, query.warehouseId);
    return Object.freeze(zones
      .filter((zone) => !query.statuses?.length || query.statuses.includes(zone.status))
      .map((zone) => Object.freeze({ ...zone })));
  }

  async listLocations(query: ListWarehouseLocationsQuery): Promise<readonly WarehouseLocationDto[]> {
    const locations = query.zoneId
      ? await this.locations.listByZone(query.companyId, query.warehouseId, query.zoneId)
      : await this.locations.listByWarehouse(query.companyId, query.warehouseId);
    return Object.freeze(locations
      .filter((location) => query.parentLocationId === undefined || location.parentLocationId === query.parentLocationId)
      .filter((location) => !query.kinds?.length || query.kinds.includes(location.kind))
      .filter((location) => !query.statuses?.length || query.statuses.includes(location.status))
      .map((location) => Object.freeze({ ...location })));
  }
}
