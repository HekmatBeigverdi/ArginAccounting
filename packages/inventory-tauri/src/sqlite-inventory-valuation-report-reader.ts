import type { DatabaseExecutor, DatabaseValue } from "@argin/database";
import {
  INVENTORY_VALUATION_REPORT_MAX_LIMIT,
  type InventoryValuationAsOfQuery,
  type InventoryValuationAsOfReport,
  type InventoryValuationKardexCursor,
  type InventoryValuationLayerQuery,
  type InventoryValuationLayerReport,
  type InventoryValuationMonetaryKardexQuery,
  type InventoryValuationMonetaryKardexReport,
  type InventoryValuationRecalculationStatusQuery,
  type InventoryValuationRecalculationStatusReport,
  type InventoryValuationReportReader,
  type InventoryValuationUnresolvedQuery,
  type InventoryValuationUnresolvedReport,
} from "@argin/inventory/valuation-reports";
const invalidInput = (field: string): never => {
  throw new Error(`VALUATION_REPORT_INPUT_INVALID:${field}`);
};

const requiredText = (value: string, field: string): string => {
  if (typeof value !== "string" || !value.trim()) return invalidInput(field);
  return value.trim();
};

const optionalBusinessDate = (
  value: string | null | undefined,
  field: string,
): string | null => {
  if (value == null) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  )
    return invalidInput(field);
  return value;
};

const validateLimit = (value: number): number => {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > INVENTORY_VALUATION_REPORT_MAX_LIMIT
  )
    return invalidInput("limit");
  return value;
};

const encodeCursor = (value: InventoryValuationKardexCursor): string =>
  encodeURIComponent(JSON.stringify(value));
const decodeCursor = (
  value: string | null | undefined,
): InventoryValuationKardexCursor | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(value),
    ) as Partial<InventoryValuationKardexCursor>;
    if (
      typeof parsed.businessDate !== "string" ||
      !Number.isSafeInteger(parsed.businessOrder) ||
      typeof parsed.documentId !== "string" ||
      typeof parsed.lineId !== "string" ||
      typeof parsed.movementId !== "string"
    )
      return invalidInput("cursor");

    return Object.freeze({
      businessDate: parsed.businessDate,
      businessOrder: parsed.businessOrder!,
      documentId: parsed.documentId,
      lineId: parsed.lineId,
      movementId: parsed.movementId,
    });
  } catch {
    return invalidInput("cursor");
  }
};

const chronologyAfter = (
  alias: string,
  cursor: InventoryValuationKardexCursor,
) => ({
  sql: `(${alias}.business_date>?
    OR (${alias}.business_date=? AND ${alias}.business_order>?)
    OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id>?)
    OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id=? AND ${alias}.line_id>?)
    OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id=? AND ${alias}.line_id=? AND ${alias}.movement_id>?))`,
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
  ] as DatabaseValue[],
});

const chronologyBeforeOrEqual = (
  alias: string,
  cursor: InventoryValuationKardexCursor,
) => ({
  sql: `(${alias}.business_date<?
    OR (${alias}.business_date=? AND ${alias}.business_order<?)
    OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id<?)
    OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id=? AND ${alias}.line_id<?)
    OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id=? AND ${alias}.line_id=? AND ${alias}.movement_id<=?))`,
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
  ] as DatabaseValue[],
});
interface StateRow {
  product_id: string;
  warehouse_id: string;
  zone_key: string;
  location_key: string;
  business_date: string;
  policy_id: string;
  method: "fifo" | "moving_average";
  strategy_version: number;
  currency: string;
  quantity: string;
  total_cost: number | null;
  unresolved_count: number;
}

interface EntryRow {
  valuation_entry_id: string;
  movement_id: string;
  document_id: string;
  line_id: string;
  product_id: string;
  warehouse_id: string;
  business_date: string;
  business_order: number;
  kind: "inbound" | "outbound" | "transfer" | "reversal";
  method: "fifo" | "moving_average";
  currency: string;
  quantity: string;
  unit_cost: string | null;
  total_cost: number | null;
  cost_state: "resolved" | "unresolved";
  unresolved_reason: string | null;
}

interface LayerRow {
  cost_layer_id: string;
  product_id: string;
  warehouse_id: string;
  zone_id: string | null;
  location_id: string | null;
  source_movement_id: string;
  source_valuation_entry_id: string;
  opened_business_date: string;
  opened_business_order: number;
  currency: string;
  original_quantity: string;
  remaining_quantity: string;
  unit_cost: string;
  original_cost: number;
  remaining_cost: number;
  revision: number;
}

interface CountRow {
  n: number;
}

interface DateRow {
  d: string | null;
}

interface RevisionRow {
  revision: number;
}

function visibilitySql(
  branchId: string | null | undefined,
  alias = "w",
): {
  sql: string;
  params: DatabaseValue[];
} {
  if (branchId == null) return { sql: "1=1", params: [] };
  return {
    sql: `(${alias}.organizational_scope='company' OR ${alias}.branch_id=?)`,
    params: [branchId],
  };
}

export class SqliteInventoryValuationReportReader implements InventoryValuationReportReader {
  constructor(private readonly db: DatabaseExecutor) {}
  async readAsOf(
    query: InventoryValuationAsOfQuery,
  ): Promise<InventoryValuationAsOfReport> {
    const companyId = requiredText(query.companyId, "companyId");
    const asOfBusinessDate = optionalBusinessDate(
      query.asOfBusinessDate,
      "asOfBusinessDate",
    )!;
    const pageLimit = validateLimit(query.limit);
    const clauses = ["s.company_id=?"];
    const params: DatabaseValue[] = [companyId];
    if (query.productId) {
      clauses.push("s.product_id=?");
      params.push(requiredText(query.productId, "productId"));
    }
    if (query.warehouseId) {
      clauses.push("s.warehouse_id=?");
      params.push(requiredText(query.warehouseId, "warehouseId"));
    }
    clauses.push("s.business_date<=?");
    params.push(asOfBusinessDate);

    const visibility = visibilitySql(query.branchId, "w");
    clauses.push(visibility.sql);
    params.push(...visibility.params);

    const rows = await this.db.query<StateRow>(
      `WITH ranked AS (
        SELECT s.*, ROW_NUMBER() OVER(
          PARTITION BY s.company_id, s.product_id, s.warehouse_id, s.zone_key, s.location_key
          ORDER BY s.business_date DESC
        ) rn
        FROM inventory_valuation_states s
        JOIN warehouses w
          ON w.company_id=s.company_id AND w.id=s.warehouse_id AND w.deleted_at IS NULL
        WHERE ${clauses.join(" AND ")}
      )
      SELECT *
      FROM ranked
      WHERE rn=1
      ORDER BY product_id,warehouse_id,zone_key,location_key
      LIMIT ?`,
      [...params, pageLimit + 1],
    );
    // The extra row indicates truncation and is excluded from report totals.

    const page = rows.slice(0, pageLimit);
    let resolvedTotalCost = 0;
    let unresolvedRowCount = 0;

    const reportRows = page.map((row) => {
      if (row.total_cost !== null) resolvedTotalCost += row.total_cost;
      if (row.unresolved_count > 0 || row.total_cost === null)
        unresolvedRowCount++;

      return Object.freeze({
        productId: row.product_id,
        warehouseId: row.warehouse_id,
        zoneId: row.zone_key || null,
        locationId: row.location_key || null,
        businessDate: row.business_date,
        policyId: row.policy_id,
        method: row.method,
        strategyVersion: row.strategy_version,
        currency: row.currency,
        quantity: row.quantity,
        totalCost: row.total_cost,
        unresolvedCount: row.unresolved_count,
      });
    });

    return Object.freeze({
      asOfBusinessDate,
      rows: Object.freeze(reportRows),
      resolvedTotalCost,
      unresolvedRowCount,
      truncated: rows.length > pageLimit,
    });
  }

  async readMonetaryKardex(
    query: InventoryValuationMonetaryKardexQuery,
  ): Promise<InventoryValuationMonetaryKardexReport> {
    const companyId = requiredText(query.companyId, "companyId");
    const productId = requiredText(query.productId, "productId");
    const warehouseId = requiredText(query.warehouseId, "warehouseId");
    const pageLimit = validateLimit(query.limit);
    const businessDateFrom = optionalBusinessDate(
      query.businessDateFrom,
      "businessDateFrom",
    );
    const businessDateTo = optionalBusinessDate(
      query.businessDateTo,
      "businessDateTo",
    );
    if (businessDateFrom && businessDateTo && businessDateFrom > businessDateTo)
      invalidInput("businessDateFrom");

    const visibility = visibilitySql(query.branchId, "w");
    const warehouse = await this.db.queryOne<{
      ok: number;
    }>(
      `SELECT 1 ok
      FROM warehouses w
      WHERE w.company_id=? AND w.id=? AND w.deleted_at IS NULL AND ${visibility.sql}`,
      [companyId, warehouseId, ...visibility.params],
    );
    if (!warehouse) invalidInput("warehouseId");
    const cursor = decodeCursor(query.cursor);
    const base = ["e.company_id=?", "e.product_id=?", "e.warehouse_id=?"];
    const baseParams: DatabaseValue[] = [companyId, productId, warehouseId];
    // Opening cost includes all resolved entries through the cursor, or before the date range.
    let openingResolvedCost = 0;
    if (cursor) {
      const through = chronologyBeforeOrEqual("e", cursor);
      const row = await this.db.queryOne<{
        v: number | null;
      }>(
        `SELECT COALESCE(SUM(CASE WHEN e.cost_state='resolved' THEN e.total_cost ELSE 0 END),0) v
      FROM inventory_valuation_entries e
      WHERE ${base.join(" AND ")} AND ${through.sql}`,
        [...baseParams, ...through.params],
      );
      openingResolvedCost = row?.v ?? 0;
    } else if (businessDateFrom) {
      const row = await this.db.queryOne<{
        v: number | null;
      }>(
        `SELECT COALESCE(SUM(CASE WHEN e.cost_state='resolved' THEN e.total_cost ELSE 0 END),0) v
      FROM inventory_valuation_entries e
      WHERE ${base.join(" AND ")} AND e.business_date<?`,
        [...baseParams, businessDateFrom],
      );
      openingResolvedCost = row?.v ?? 0;
    }

    const clauses = [...base];
    const params = [...baseParams];
    if (businessDateFrom) {
      clauses.push("e.business_date>=?");
      params.push(businessDateFrom);
    }
    if (businessDateTo) {
      clauses.push("e.business_date<=?");
      params.push(businessDateTo);
    }
    if (cursor) {
      const after = chronologyAfter("e", cursor);
      clauses.push(after.sql);
      params.push(...after.params);
    }

    const rows = await this.db.query<EntryRow>(
      `SELECT e.*
      FROM inventory_valuation_entries e
      WHERE ${clauses.join(" AND ")}
      ORDER BY e.business_date,e.business_order,e.document_id,e.line_id,e.movement_id
      LIMIT ?`,
      [...params, pageLimit + 1],
    );

    const page = rows.slice(0, pageLimit);
    let runningResolvedCost = openingResolvedCost;
    let unresolvedCount = 0;
    const entries = page.map((row) => {
      if (row.cost_state === "resolved" && row.total_cost !== null)
        runningResolvedCost += row.total_cost;
      else unresolvedCount++;

      return Object.freeze({
        valuationEntryId: row.valuation_entry_id,
        movementId: row.movement_id,
        documentId: row.document_id,
        lineId: row.line_id,
        businessDate: row.business_date,
        businessOrder: row.business_order,
        kind: row.kind,
        method: row.method,
        currency: row.currency,
        quantity: row.quantity,
        unitCost: row.unit_cost,
        monetaryDelta: row.total_cost,
        runningResolvedCost,
        costState: row.cost_state,
        unresolvedReason: row.unresolved_reason,
      });
    });

    const last = page.at(-1);
    const nextCursor =
      rows.length > pageLimit && last
        ? encodeCursor({
            businessDate: last.business_date,
            businessOrder: last.business_order,
            documentId: last.document_id,
            lineId: last.line_id,
            movementId: last.movement_id,
          })
        : null;

    return Object.freeze({
      openingResolvedCost,
      entries: Object.freeze(entries),
      closingResolvedCost: runningResolvedCost,
      unresolvedCount,
      nextCursor,
    });
  }

  async readLayers(
    query: InventoryValuationLayerQuery,
  ): Promise<InventoryValuationLayerReport> {
    const companyId = requiredText(query.companyId, "companyId");
    const pageLimit = validateLimit(query.limit);
    const clauses = ["l.company_id=?"];
    const params: DatabaseValue[] = [companyId];
    if (query.productId) {
      clauses.push("l.product_id=?");
      params.push(requiredText(query.productId, "productId"));
    }
    if (query.warehouseId) {
      clauses.push("l.warehouse_id=?");
      params.push(requiredText(query.warehouseId, "warehouseId"));
    }
    if (query.onlyOpen !== false) clauses.push("l.remaining_quantity<>'0'");

    const visibility = visibilitySql(query.branchId, "w");
    clauses.push(visibility.sql);
    params.push(...visibility.params);

    const rows = await this.db.query<LayerRow>(
      `SELECT l.*
      FROM inventory_valuation_cost_layers l
      JOIN warehouses w
      ON w.company_id=l.company_id AND w.id=l.warehouse_id AND w.deleted_at IS NULL
      WHERE ${clauses.join(" AND ")}
      ORDER BY l.opened_business_date,l.opened_business_order,l.cost_layer_id
      LIMIT ?`,
      [...params, pageLimit + 1],
    );

    const reportRows = rows.slice(0, pageLimit).map((row) =>
      Object.freeze({
        costLayerId: row.cost_layer_id,
        productId: row.product_id,
        warehouseId: row.warehouse_id,
        zoneId: row.zone_id,
        locationId: row.location_id,
        sourceMovementId: row.source_movement_id,
        sourceValuationEntryId: row.source_valuation_entry_id,
        openedBusinessDate: row.opened_business_date,
        openedBusinessOrder: row.opened_business_order,
        currency: row.currency,
        originalQuantity: row.original_quantity,
        remainingQuantity: row.remaining_quantity,
        unitCost: row.unit_cost,
        originalCost: row.original_cost,
        remainingCost: row.remaining_cost,
        revision: row.revision,
      }),
    );

    return Object.freeze({
      rows: Object.freeze(reportRows),
      truncated: rows.length > pageLimit,
    });
  }

  async readUnresolved(
    query: InventoryValuationUnresolvedQuery,
  ): Promise<InventoryValuationUnresolvedReport> {
    const companyId = requiredText(query.companyId, "companyId");
    const pageLimit = validateLimit(query.limit);
    const businessDateFrom = optionalBusinessDate(
      query.fromBusinessDate,
      "fromBusinessDate",
    );
    const clauses = ["e.company_id=?", "e.cost_state='unresolved'"];
    const params: DatabaseValue[] = [companyId];
    if (query.productId) {
      clauses.push("e.product_id=?");
      params.push(requiredText(query.productId, "productId"));
    }
    if (query.warehouseId) {
      clauses.push("e.warehouse_id=?");
      params.push(requiredText(query.warehouseId, "warehouseId"));
    }
    if (businessDateFrom) {
      clauses.push("e.business_date>=?");
      params.push(businessDateFrom);
    }

    const visibility = visibilitySql(query.branchId, "w");
    clauses.push(visibility.sql);
    params.push(...visibility.params);

    const rows = await this.db.query<EntryRow>(
      `SELECT e.*
      FROM inventory_valuation_entries e
      JOIN warehouses w
      ON w.company_id=e.company_id AND w.id=e.warehouse_id AND w.deleted_at IS NULL
      WHERE ${clauses.join(" AND ")}
      ORDER BY e.business_date,e.business_order,e.document_id,e.line_id,e.movement_id
      LIMIT ?`,
      [...params, pageLimit + 1],
    );

    const reportRows = rows.slice(0, pageLimit).map((row) =>
      Object.freeze({
        valuationEntryId: row.valuation_entry_id,
        movementId: row.movement_id,
        productId: row.product_id,
        warehouseId: row.warehouse_id,
        businessDate: row.business_date,
        businessOrder: row.business_order,
        quantity: row.quantity,
        method: row.method,
        currency: row.currency,
        reason: row.unresolved_reason ?? "upstream_cost_unresolved",
      }),
    );

    return Object.freeze({
      rows: Object.freeze(reportRows),
      truncated: rows.length > pageLimit,
    });
  }

  async readRecalculationStatus(
    query: InventoryValuationRecalculationStatusQuery,
  ): Promise<InventoryValuationRecalculationStatusReport> {
    const companyId = requiredText(query.companyId, "companyId");
    const productId = query.productId
      ? requiredText(query.productId, "productId")
      : null;
    const scopeWhere = productId
      ? "company_id=? AND product_id=?"
      : "company_id=?";
    const scopeParams: DatabaseValue[] = productId
      ? [companyId, productId]
      : [companyId];
    const latestMovement = await this.db.queryOne<DateRow>(
      `SELECT MAX(business_date) d
      FROM inventory_all_stock_movements
      WHERE ${scopeWhere}`,
      scopeParams,
    );
    const latestValued = await this.db.queryOne<DateRow>(
      `SELECT MAX(business_date) d
      FROM inventory_valuation_entries
      WHERE ${scopeWhere}`,
      scopeParams,
    );
    const unresolved = await this.db.queryOne<CountRow>(
      `SELECT COUNT(*) n
      FROM inventory_valuation_entries
      WHERE ${scopeWhere} AND cost_state='unresolved'`,
      scopeParams,
    );
    const missing = await this.db.queryOne<CountRow>(
      `SELECT COUNT(*) n
      FROM inventory_all_stock_movements m
      LEFT JOIN inventory_valuation_entries e
      ON e.company_id=m.company_id AND e.movement_id=m.movement_id
      WHERE ${productId ? "m.company_id=? AND m.product_id=?" : "m.company_id=?"} AND e.valuation_entry_id IS NULL`,
      scopeParams,
    );
    const streamKey = productId
      ? `valuation:${companyId}:${productId}`
      : `policy:${companyId}`;
    const streamRevision = await this.db.queryOne<RevisionRow>(
      `SELECT revision FROM inventory_valuation_stream_versions WHERE company_id=? AND stream_key=?`,
      [companyId, streamKey],
    );
    const noMovements = !latestMovement?.d;
    const needsAttention =
      (unresolved?.n ?? 0) > 0 ||
      (missing?.n ?? 0) > 0 ||
      (!noMovements && !latestValued?.d);

    return Object.freeze({
      companyId,
      productId,
      latestMovementBusinessDate: latestMovement?.d ?? null,
      latestValuedBusinessDate: latestValued?.d ?? null,
      unresolvedCount: (unresolved?.n ?? 0) + (missing?.n ?? 0),
      streamRevision: streamRevision?.revision ?? 0,
      status: noMovements
        ? "empty"
        : needsAttention
          ? "attention-required"
          : "current",
    });
  }
}
