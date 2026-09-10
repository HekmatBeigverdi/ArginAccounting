import type { DatabaseExecutor, DatabaseValue } from "@argin/database";
import {
  INVENTORY_APPLICATION_ERROR_CODES,
  InventoryApplicationError,
  addInventoryStockQuantities,
  createInventoryStockKey,
  normalizeInventoryQuantity,
  rehydrateInventoryStockMovement,
  type InventoryKardexCursorPayload,
  type InventoryKardexReport,
  type InventoryKardexReportEntry,
  type InventoryKardexReportQuery,
  type InventoryProductBalanceSummaryQuery,
  type InventoryProductBalanceSummaryReport,
  type InventoryProductBalanceSummaryRow,
  type InventoryProductWarehouseBalanceRow,
  type InventoryQuantityBalanceReport,
  type InventoryQuantityBalanceReportQuery,
  type InventoryQuantityReportReader,
  type InventoryStockKey,
  type InventoryStockMovementSnapshot,
} from "@argin/inventory";

const MAX_LIMIT = 500;
const READ_CHUNK_SIZE = 500;

interface MovementCursorRow {
  business_date: string;
  business_order: number;
  document_id: string;
  line_id: string;
  movement_id: string;
}

interface OpeningQuantityRow extends MovementCursorRow {
  quantity_delta: string;
}

interface WarehouseBalanceAccumulator {
  warehouseId: string;
  warehouseCode: string;
  warehouseTitle: string;
  quantity: string;
  stockKeyCount: number;
}

interface MovementRow {
  movement_id: string;
  company_id: string;
  document_id: string;
  line_id: string;
  transfer_id: string | null;
  reversal_of_movement_id: string | null;
  product_id: string;
  warehouse_id: string;
  zone_id: string | null;
  location_id: string | null;
  business_date: string;
  business_order: number;
  recorded_at: string;
  quantity_delta: string;
  document_number: string | null;
  document_type: "receipt" | "issue" | "opening" | "transfer" | "adjustment";
  display_document_id: string;
  document_description: string | null;
  line_description: string | null;
  line_position: number;
  is_reversal: number;
  source_system: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
  source_line_id: string | null;
}
interface BalanceRow {
  stock_key: string;
  company_id: string;
  product_id: string;
  warehouse_id: string;
  zone_id: string | null;
  location_id: string | null;
  quantity: string;
  last_movement_id: string | null;
  product_code: string;
  product_title: string;
  warehouse_code: string;
  warehouse_title: string;
  zone_code: string | null;
  zone_title: string | null;
  location_code: string | null;
  location_title: string | null;
}
interface WarehouseScopeRow {
  organizational_scope: "company" | "branch";
  branch_id: string | null;
}
interface ProductSeedRow {
  product_id: string;
  product_code: string;
  product_title: string;
}
interface ProductStockRow {
  stock_key: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_title: string;
  quantity: string;
}

function invalid(field: string): never {
  throw new InventoryApplicationError(
    INVENTORY_APPLICATION_ERROR_CODES.invalidRequest,
    field,
  );
}
function unauthorized(field: string): never {
  throw new InventoryApplicationError(
    INVENTORY_APPLICATION_ERROR_CODES.unauthorized,
    field,
  );
}
function assertLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    invalid("limit");
  }
}
function assertDate(value: string | null | undefined, field: string): void {
  if (value == null) {
    return;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  ) {
    invalid(field);
  }
}
function encodeCursor(payload: InventoryKardexCursorPayload): string {
  return encodeURIComponent(JSON.stringify(payload));
}
function decodeCursor(
  value: string | null | undefined,
): InventoryKardexCursorPayload | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      decodeURIComponent(value),
    ) as Partial<InventoryKardexCursorPayload>;
    if (
      typeof parsed.businessDate !== "string" ||
      !Number.isSafeInteger(parsed.businessOrder) ||
      typeof parsed.documentId !== "string" ||
      typeof parsed.lineId !== "string" ||
      typeof parsed.movementId !== "string"
    ) {
      invalid("cursor");
    }
    return Object.freeze({
      businessDate: parsed.businessDate,
      businessOrder: parsed.businessOrder as number,
      documentId: parsed.documentId,
      lineId: parsed.lineId,
      movementId: parsed.movementId,
    });
  } catch {
    return invalid("cursor");
  }
}
const cursorFromRow = (row: MovementCursorRow): InventoryKardexCursorPayload =>
  Object.freeze({
    businessDate: row.business_date,
    businessOrder: row.business_order,
    documentId: row.document_id,
    lineId: row.line_id,
    movementId: row.movement_id,
  });
const stockKeyClauses = (
  key: InventoryStockKey,
): { sql: string; params: DatabaseValue[] } => ({
  sql: "m.company_id=? AND m.product_id=? AND m.warehouse_id=? AND COALESCE(m.zone_id,'')=COALESCE(?,'') AND COALESCE(m.location_id,'')=COALESCE(?,'')",
  params: [
    key.companyId,
    key.productId,
    key.warehouseId,
    key.zoneId,
    key.locationId,
  ],
});
function chronologyAfter(cursor: InventoryKardexCursorPayload): {
  sql: string;
  params: DatabaseValue[];
} {
  return {
    sql: `(m.business_date > ? OR (m.business_date = ? AND m.business_order > ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id > ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id = ? AND m.line_id > ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id = ? AND m.line_id = ? AND m.movement_id > ?))`,
    params: [
      cursor.businessDate,
      cursor.businessDate,
      cursor.businessOrder,
      cursor.businessDate,
      cursor.businessOrder,
      cursor.documentId,
      cursor.businessDate,
      cursor.businessOrder,
      cursor.documentId,
      cursor.lineId,
      cursor.businessDate,
      cursor.businessOrder,
      cursor.documentId,
      cursor.lineId,
      cursor.movementId,
    ],
  };
}
/** Prefix through the cursor itself, because the next page starts strictly after that fact. */
function chronologyThrough(cursor: InventoryKardexCursorPayload): {
  sql: string;
  params: DatabaseValue[];
} {
  return {
    sql: `(m.business_date < ? OR (m.business_date = ? AND m.business_order < ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id < ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id = ? AND m.line_id < ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id = ? AND m.line_id = ? AND m.movement_id <= ?))`,
    params: [
      cursor.businessDate,
      cursor.businessDate,
      cursor.businessOrder,
      cursor.businessDate,
      cursor.businessOrder,
      cursor.documentId,
      cursor.businessDate,
      cursor.businessOrder,
      cursor.documentId,
      cursor.lineId,
      cursor.businessDate,
      cursor.businessOrder,
      cursor.documentId,
      cursor.lineId,
      cursor.movementId,
    ],
  };
}
function movementFromRow(row: MovementRow): InventoryStockMovementSnapshot {
  return rehydrateInventoryStockMovement({
    movementId: row.movement_id,
    companyId: row.company_id,
    documentId: row.document_id,
    lineId: row.line_id,
    businessDate: row.business_date,
    businessOrder: row.business_order,
    recordedAt: row.recorded_at,
    stockKey: {
      companyId: row.company_id,
      productId: row.product_id,
      warehouseId: row.warehouse_id,
      zoneId: row.zone_id,
      locationId: row.location_id,
    },
    transferId: row.transfer_id,
    reversalOfMovementId: row.reversal_of_movement_id,
    quantityDelta: row.quantity_delta,
  });
}
const positiveMagnitude = (value: string): string => {
  const normalized = normalizeInventoryQuantity(value);
  return normalized.startsWith("-") ? normalized.slice(1) : normalized;
};
const isZero = (value: string): boolean =>
  normalizeInventoryQuantity(value) === "0";

export class SqliteInventoryQuantityReportReader implements InventoryQuantityReportReader {
  constructor(private readonly database: DatabaseExecutor) {}

  private normalizeKey(query: InventoryKardexReportQuery): InventoryStockKey {
    if (query.companyId !== query.stockKey.companyId) {
      invalid("companyId");
    }
    return createInventoryStockKey({
      companyId: query.companyId,
      productId: query.stockKey.productId,
      warehouse: query.stockKey,
    });
  }

  private async requireWarehouseVisibility(
    companyId: string,
    branchId: string | null | undefined,
    warehouseId: string,
  ): Promise<void> {
    if (branchId == null) {
      return;
    }
    const warehouse = await this.database.queryOne<WarehouseScopeRow>(
      "SELECT organizational_scope,branch_id FROM warehouses WHERE company_id=? AND id=? AND deleted_at IS NULL",
      [companyId, warehouseId],
    );
    if (!warehouse) {
      unauthorized("warehouseId");
    }
    if (
      warehouse.organizational_scope === "branch" &&
      warehouse.branch_id !== branchId
    ) {
      unauthorized("branchId");
    }
  }

  /** Exact opening before this page. Every SQLite prefix read is bounded to READ_CHUNK_SIZE facts. */
  private async openingQuantity(
    query: InventoryKardexReportQuery,
    pageCursor: InventoryKardexCursorPayload | null,
  ): Promise<string> {
    const base = stockKeyClauses(this.normalizeKey(query));
    let total = "0";
    let chunkCursor: InventoryKardexCursorPayload | null = null;
    while (true) {
      const clauses = [base.sql];
      const params: DatabaseValue[] = [...base.params];
      if (chunkCursor) {
        const after = chronologyAfter(chunkCursor);
        clauses.push(after.sql);
        params.push(...after.params);
      }
      if (pageCursor) {
        const through = chronologyThrough(pageCursor);
        clauses.push(through.sql);
        params.push(...through.params);
      } else if (query.businessDateFrom) {
        clauses.push("m.business_date < ?");
        params.push(query.businessDateFrom);
      } else {
        return "0";
      }
      const rows = await this.database.query<OpeningQuantityRow>(
        `SELECT m.business_date,m.business_order,m.document_id,m.line_id,m.movement_id,m.quantity_delta FROM inventory_all_stock_movements m
         WHERE ${clauses.join(" AND ")} ORDER BY m.business_date,m.business_order,m.document_id,m.line_id,m.movement_id LIMIT ?`,
        [...params, READ_CHUNK_SIZE],
      );
      for (const row of rows) {
        total = addInventoryStockQuantities(total, row.quantity_delta);
      }
      if (rows.length < READ_CHUNK_SIZE) {
        break;
      }
      chunkCursor = cursorFromRow(rows[rows.length - 1]!);
    }
    return total;
  }

  async readKardex(
    query: InventoryKardexReportQuery,
  ): Promise<InventoryKardexReport> {
    assertLimit(query.limit);
    assertDate(query.businessDateFrom, "businessDateFrom");
    assertDate(query.businessDateTo, "businessDateTo");
    if (
      query.businessDateFrom &&
      query.businessDateTo &&
      query.businessDateFrom > query.businessDateTo
    ) {
      invalid("businessDateFrom");
    }
    const key = this.normalizeKey(query);
    await this.requireWarehouseVisibility(
      query.companyId,
      query.branchId,
      key.warehouseId,
    );
    const cursor = decodeCursor(query.cursor);
    const base = stockKeyClauses(key);
    const clauses = [base.sql];
    const params: DatabaseValue[] = [...base.params];
    if (query.businessDateFrom) {
      clauses.push("m.business_date>=?");
      params.push(query.businessDateFrom);
    }
    if (query.businessDateTo) {
      clauses.push("m.business_date<=?");
      params.push(query.businessDateTo);
    }
    if (cursor) {
      const after = chronologyAfter(cursor);
      clauses.push(after.sql);
      params.push(...after.params);
    }
    const rows = await this.database.query<MovementRow>(
      `SELECT m.*,
      COALESCE(original.document_id,m.document_id) AS display_document_id,
      d.document_number,d.document_type,d.description AS document_description,
      l.position AS line_position,l.description AS line_description,
      CASE WHEN m.reversal_of_movement_id IS NULL THEN 0 ELSE 1 END AS is_reversal,
      COALESCE(l.source_system,d.source_system) AS source_system,COALESCE(l.source_document_type,d.source_document_type) AS source_document_type,
      COALESCE(l.source_document_id,d.source_document_id) AS source_document_id,COALESCE(l.source_line_id,d.source_line_id) AS source_line_id
      FROM inventory_all_stock_movements m
      LEFT JOIN inventory_stock_movements original ON original.company_id=m.company_id AND original.movement_id=m.reversal_of_movement_id
      JOIN inventory_documents d ON d.company_id=m.company_id AND d.id=COALESCE(original.document_id,m.document_id)
      JOIN inventory_document_lines l ON l.company_id=m.company_id AND l.document_id=d.id AND l.id=m.line_id
      WHERE ${clauses.join(" AND ")} ORDER BY m.business_date,m.business_order,m.document_id,m.line_id,m.movement_id LIMIT ?`,
      [...params, query.limit + 1],
    );
    const hasMore = rows.length > query.limit;
    const pageRows = rows.slice(0, query.limit);
    const openingQuantity = await this.openingQuantity(query, cursor);
    let running = openingQuantity;
    let incoming = "0";
    let outgoing = "0";
    const entries: InventoryKardexReportEntry[] = pageRows.map((row) => {
      const fact = movementFromRow(row);
      const isOutgoing = fact.quantityDelta.startsWith("-");
      running = addInventoryStockQuantities(running, fact.quantityDelta);
      if (isOutgoing) {
        outgoing = addInventoryStockQuantities(
          outgoing,
          positiveMagnitude(fact.quantityDelta),
        );
      } else {
        incoming = addInventoryStockQuantities(incoming, fact.quantityDelta);
      }
      return Object.freeze({
        movement: fact,
        incomingQuantity: isOutgoing ? "0" : fact.quantityDelta,
        outgoingQuantity: isOutgoing
          ? positiveMagnitude(fact.quantityDelta)
          : "0",
        runningQuantity: running,
        source: Object.freeze({
          documentId: row.display_document_id,
          documentNumber: row.document_number,
          documentType: row.document_type,
          documentDescription: row.document_description,
          lineId: row.line_id,
          linePosition: row.line_position,
          lineDescription: row.line_description,
          isReversal: row.is_reversal === 1,
          sourceSystem: row.source_system,
          sourceDocumentType: row.source_document_type,
          sourceDocumentId: row.source_document_id,
          sourceLineId: row.source_line_id,
        }),
      });
    });
    const last = pageRows.at(-1);
    return Object.freeze({
      stockKey: key,
      openingQuantity,
      incomingQuantity: incoming,
      outgoingQuantity: outgoing,
      closingQuantity: running,
      entries: Object.freeze(entries),
      nextCursor: hasMore && last ? encodeCursor(cursorFromRow(last)) : null,
    });
  }

  async readBalances(
    query: InventoryQuantityBalanceReportQuery,
  ): Promise<InventoryQuantityBalanceReport> {
    assertLimit(query.limit);
    const clauses = ["b.company_id=?"];
    const params: DatabaseValue[] = [query.companyId];
    const addOptionalFilter = (
      sql: string,
      value: string | null | undefined,
    ) => {
      if (value != null && value !== "") {
        clauses.push(sql);
        params.push(value);
      }
    };
    addOptionalFilter("b.product_id=?", query.productId);
    addOptionalFilter("b.warehouse_id=?", query.warehouseId);
    addOptionalFilter("b.zone_id=?", query.zoneId);
    addOptionalFilter("b.location_id=?", query.locationId);
    if (query.branchId != null) {
      clauses.push(
        "(w.organizational_scope='company' OR (w.organizational_scope='branch' AND w.branch_id=?))",
      );
      params.push(query.branchId);
    }
    if (!query.includeZero) {
      clauses.push("b.quantity NOT IN ('0','0.0','-0','-0.0')");
    }
    if (query.cursor) {
      clauses.push("b.stock_key > ?");
      params.push(query.cursor);
    }
    const rows = await this.database.query<BalanceRow>(
      `SELECT b.stock_key,b.company_id,b.product_id,b.warehouse_id,b.zone_id,b.location_id,b.quantity,b.last_movement_id,
      p.code AS product_code,p.title AS product_title,w.code AS warehouse_code,w.title AS warehouse_title,z.code AS zone_code,z.title AS zone_title,l.code AS location_code,l.title AS location_title
      FROM inventory_stock_balances b JOIN products p ON p.company_id=b.company_id AND p.id=b.product_id JOIN warehouses w ON w.company_id=b.company_id AND w.id=b.warehouse_id
      LEFT JOIN warehouse_zones z ON z.company_id=b.company_id AND z.warehouse_id=b.warehouse_id AND z.id=b.zone_id
      LEFT JOIN warehouse_locations l ON l.company_id=b.company_id AND l.warehouse_id=b.warehouse_id AND l.zone_id=b.zone_id AND l.id=b.location_id
      WHERE ${clauses.join(" AND ")} ORDER BY b.stock_key LIMIT ?`,
      [...params, query.limit + 1],
    );
    const hasMore = rows.length > query.limit;
    const pageRows = rows.slice(0, query.limit);
    return Object.freeze({
      items: Object.freeze(
        pageRows.map((row) =>
          Object.freeze({
            stockKey: Object.freeze({
              companyId: row.company_id,
              productId: row.product_id,
              warehouseId: row.warehouse_id,
              zoneId: row.zone_id,
              locationId: row.location_id,
            }),
            quantity: normalizeInventoryQuantity(row.quantity),
            productCode: row.product_code,
            productTitle: row.product_title,
            warehouseCode: row.warehouse_code,
            warehouseTitle: row.warehouse_title,
            zoneCode: row.zone_code,
            zoneTitle: row.zone_title,
            locationCode: row.location_code,
            locationTitle: row.location_title,
            lastMovementId: row.last_movement_id,
          }),
        ),
      ),
      nextCursor:
        hasMore && pageRows.length
          ? pageRows[pageRows.length - 1]!.stock_key
          : null,
    });
  }

  private async aggregateProduct(
    query: InventoryProductBalanceSummaryQuery,
    seed: ProductSeedRow,
  ): Promise<InventoryProductBalanceSummaryRow | null> {
    let total = "0";
    let stockKeyCount = 0;
    let cursor: string | null = null;
    const warehouseMap = new Map<string, WarehouseBalanceAccumulator>();
    while (true) {
      const clauses = ["b.company_id=?", "b.product_id=?"];
      const params: DatabaseValue[] = [query.companyId, seed.product_id];
      if (query.branchId != null) {
        clauses.push(
          "(w.organizational_scope='company' OR (w.organizational_scope='branch' AND w.branch_id=?))",
        );
        params.push(query.branchId);
      }
      if (cursor) {
        clauses.push("b.stock_key > ?");
        params.push(cursor);
      }
      const rows = await this.database.query<ProductStockRow>(
        `SELECT b.stock_key,b.warehouse_id,w.code AS warehouse_code,w.title AS warehouse_title,b.quantity
        FROM inventory_stock_balances b JOIN warehouses w ON w.company_id=b.company_id AND w.id=b.warehouse_id
        WHERE ${clauses.join(" AND ")} ORDER BY b.stock_key LIMIT ?`,
        [...params, READ_CHUNK_SIZE],
      );
      for (const row of rows) {
        const amount = normalizeInventoryQuantity(row.quantity);
        total = addInventoryStockQuantities(total, amount);
        stockKeyCount += 1;
        const existing = warehouseMap.get(row.warehouse_id) ?? {
          warehouseId: row.warehouse_id,
          warehouseCode: row.warehouse_code,
          warehouseTitle: row.warehouse_title,
          quantity: "0",
          stockKeyCount: 0,
        };
        existing.quantity = addInventoryStockQuantities(
          existing.quantity,
          amount,
        );
        existing.stockKeyCount += 1;
        warehouseMap.set(row.warehouse_id, existing);
      }
      if (rows.length < READ_CHUNK_SIZE) {
        break;
      }
      cursor = rows[rows.length - 1]!.stock_key;
    }
    const warehouses: Array<InventoryProductWarehouseBalanceRow> = [];
    for (const value of warehouseMap.values()) {
      if (!query.includeZero && isZero(value.quantity)) {
        continue;
      }
      warehouses.push(
        Object.freeze({
          ...value,
          quantity: normalizeInventoryQuantity(value.quantity),
        }),
      );
    }
    warehouses.sort((a, b) =>
      a.warehouseCode.localeCompare(b.warehouseCode, "fa"),
    );
    if (!query.includeZero && isZero(total)) {
      return null;
    }
    return Object.freeze({
      companyId: query.companyId,
      productId: seed.product_id,
      productCode: seed.product_code,
      productTitle: seed.product_title,
      totalQuantity: normalizeInventoryQuantity(total),
      warehouseCount: warehouses.length,
      stockKeyCount,
      warehouses: Object.freeze(warehouses),
    });
  }

  async readProductSummaries(
    query: InventoryProductBalanceSummaryQuery,
  ): Promise<InventoryProductBalanceSummaryReport> {
    assertLimit(query.limit);
    const result: Array<InventoryProductBalanceSummaryRow> = [];
    const seedLimit = Math.min(READ_CHUNK_SIZE, query.limit + 1);
    let scanCursor = query.cursor ?? null;
    let exhausted = false;
    // Zero-balance products may be skipped, so scan until the page has a lookahead item.
    while (result.length <= query.limit && !exhausted) {
      const clauses = ["p.company_id=?"];
      const params: DatabaseValue[] = [query.companyId];
      if (query.productId) {
        clauses.push("p.id=?");
        params.push(query.productId);
      }
      if (scanCursor) {
        clauses.push("p.id > ?");
        params.push(scanCursor);
      }
      const visibility =
        query.branchId == null
          ? ""
          : " AND (w.organizational_scope='company' OR (w.organizational_scope='branch' AND w.branch_id=?))";
      if (query.branchId != null) {
        params.push(query.branchId);
      }
      params.push(seedLimit);
      const seeds = await this.database.query<ProductSeedRow>(
        `SELECT p.id AS product_id,p.code AS product_code,p.title AS product_title
        FROM products p WHERE ${clauses.join(" AND ")} AND EXISTS(SELECT 1 FROM inventory_stock_balances b
          JOIN warehouses w ON w.company_id=b.company_id AND w.id=b.warehouse_id
          WHERE b.company_id=p.company_id AND b.product_id=p.id${visibility})
        ORDER BY p.id LIMIT ?`,
        params,
      );
      if (!seeds.length) {
        exhausted = true;
        break;
      }
      for (const seed of seeds) {
        scanCursor = seed.product_id;
        const summary = await this.aggregateProduct(query, seed);
        if (summary) {
          result.push(summary);
        }
        if (result.length > query.limit) {
          break;
        }
      }
      if (seeds.length < seedLimit) {
        exhausted = true;
      }
    }
    const hasMore = result.length > query.limit;
    const items = result.slice(0, query.limit);
    const nextCursor =
      hasMore && items.length ? items[items.length - 1]!.productId : null;
    return Object.freeze({ items: Object.freeze(items), nextCursor });
  }
}
