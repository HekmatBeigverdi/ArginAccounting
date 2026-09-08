import type { DatabaseExecutor } from "@argin/database";
import type {
  WarehouseDependencyBlocker,
  WarehouseDependencyCheck,
  WarehouseDependencyGuard,
  WarehouseProtectedOperation,
} from "@argin/warehouse";

const OPEN_STATUSES = Object.freeze(["draft", "submitted", "approved"] as const);

type ScopeInput = {
  readonly companyId: string;
  readonly operation: WarehouseProtectedOperation;
  readonly warehouseId: string;
  readonly zoneId?: string | null;
  readonly locationId?: string | null;
};

type CountRow = { count: number | string };
type QuantityRow = { quantity: string };

const countOf = (row: CountRow | null): number => Number(row?.count ?? 0);

const isZeroDecimal = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized) return true;
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return false;
  return `${match[2] ?? ""}${match[3] ?? ""}`.split("").every((digit) => digit === "0");
};

const scopePredicate = (alias: string, input: ScopeInput): { sql: string; parameters: readonly (string | null)[] } => {
  const parameters: (string | null)[] = [input.companyId, input.warehouseId];
  let sql = `${alias}.company_id=? AND ${alias}.warehouse_id=?`;
  if (input.zoneId !== undefined && input.zoneId !== null) {
    sql += ` AND ${alias}.zone_id=?`;
    parameters.push(input.zoneId);
  }
  if (input.locationId !== undefined && input.locationId !== null) {
    sql += ` AND ${alias}.location_id=?`;
    parameters.push(input.locationId);
  }
  return { sql, parameters };
};

const lineScopePredicate = (input: ScopeInput): { sql: string; parameters: readonly (string | null)[] } => {
  const parameters: (string | null)[] = [input.companyId];
  const branches: string[] = [];
  const addSide = (prefix: "" | "destination_") => {
    const conditions = [`l.${prefix}warehouse_id=?`];
    parameters.push(input.warehouseId);
    if (input.zoneId !== undefined && input.zoneId !== null) {
      conditions.push(`l.${prefix}zone_id=?`);
      parameters.push(input.zoneId);
    }
    if (input.locationId !== undefined && input.locationId !== null) {
      conditions.push(`l.${prefix}location_id=?`);
      parameters.push(input.locationId);
    }
    branches.push(`(${conditions.join(" AND ")})`);
  };
  addSide("");
  addSide("destination_");
  return { sql: `d.company_id=? AND (${branches.join(" OR ")})`, parameters };
};

const blocksHistoricalReferences = (operation: WarehouseProtectedOperation): boolean =>
  operation === "warehouse.delete" ||
  operation === "zone.delete" ||
  operation === "location.delete" ||
  operation === "location.move";

export class InventoryWarehouseDependencyGuard implements WarehouseDependencyGuard {
  constructor(private readonly database: DatabaseExecutor) {}

  async check(input: ScopeInput): Promise<WarehouseDependencyCheck> {
    const blockers: WarehouseDependencyBlocker[] = [];

    const balanceScope = scopePredicate("b", input);
    const balanceRows = await this.database.query<QuantityRow>(
      `SELECT b.quantity FROM inventory_stock_balances b WHERE ${balanceScope.sql}`,
      balanceScope.parameters,
    );
    const nonZeroCount = balanceRows.filter((row) => !isZeroDecimal(row.quantity)).length;
    if (nonZeroCount > 0) {
      blockers.push(Object.freeze({
        kind: "stock-balance",
        code: "inventory.warehouse-dependency.nonzero-stock",
        count: nonZeroCount,
        message: "Warehouse reference has non-zero Inventory stock.",
      }));
    }

    const lineScope = lineScopePredicate(input);
    const open = await this.database.queryOne<CountRow>(
      `SELECT COUNT(DISTINCT d.id) AS count
       FROM inventory_documents d
       JOIN inventory_document_lines l ON l.company_id=d.company_id AND l.document_id=d.id
       WHERE ${lineScope.sql}
         AND d.deleted_at IS NULL
         AND d.status IN (${OPEN_STATUSES.map(() => "?").join(",")})`,
      [...lineScope.parameters, ...OPEN_STATUSES],
    );
    const openCount = countOf(open);
    if (openCount > 0) {
      blockers.push(Object.freeze({
        kind: "inventory-document",
        code: "inventory.warehouse-dependency.open-document",
        count: openCount,
        message: "Warehouse reference is used by open Inventory documents.",
      }));
    }

    if (blocksHistoricalReferences(input.operation)) {
      const movementScope = scopePredicate("m", input);
      const historical = await this.database.queryOne<CountRow>(
        `SELECT COUNT(*) AS count FROM inventory_all_stock_movements m WHERE ${movementScope.sql}`,
        movementScope.parameters,
      );
      const historicalCount = countOf(historical);
      if (historicalCount > 0) {
        blockers.push(Object.freeze({
          kind: "inventory-document",
          code: "inventory.warehouse-dependency.historical-movement",
          count: historicalCount,
          message: "Warehouse reference is part of immutable Inventory movement history.",
        }));
      }
    }

    return Object.freeze({
      allowed: blockers.length === 0,
      blockers: Object.freeze(blockers),
    });
  }
}
