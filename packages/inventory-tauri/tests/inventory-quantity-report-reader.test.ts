import assert from "node:assert/strict";
import test from "node:test";
import type {
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import { InventoryApplicationError } from "@argin/inventory";
import { SqliteInventoryQuantityReportReader } from "../src/sqlite-inventory-quantity-report-reader.ts";

const key = Object.freeze({
  companyId: "company-1",
  productId: "product-1",
  warehouseId: "warehouse-1",
  zoneId: null,
  locationId: null,
});

function movementRow(input: {
  movementId: string;
  date: string;
  order: number;
  delta: string;
}) {
  return {
    movement_id: input.movementId,
    company_id: "company-1",
    document_id: `document-${input.movementId}`,
    line_id: `line-${input.movementId}`,
    transfer_id: null,
    reversal_of_movement_id: null,
    product_id: "product-1",
    warehouse_id: "warehouse-1",
    zone_id: null,
    location_id: null,
    business_date: input.date,
    business_order: input.order,
    recorded_at: `${input.date}T08:00:00.000Z`,
    quantity_delta: input.delta,
    document_number: input.movementId.toUpperCase(),
    document_type: input.delta.startsWith("-") ? "issue" : "receipt",
    display_document_id: `document-${input.movementId}`,
    document_description: null,
    line_description: null,
    line_position: 1,
    is_reversal: 0,
    source_system: null,
    source_document_type: null,
    source_document_id: null,
    source_line_id: null,
  } as const;
}

function fakeExecutor(): DatabaseExecutor {
  let mainCall = 0;
  let prefixCall = 0;
  const opening = movementRow({
    movementId: "opening",
    date: "2026-01-01",
    order: 1,
    delta: "5",
  });
  const receipt = movementRow({
    movementId: "receipt",
    date: "2026-01-02",
    order: 1,
    delta: "10",
  });
  const issue = movementRow({
    movementId: "issue",
    date: "2026-01-03",
    order: 1,
    delta: "-3",
  });
  const session: DatabaseSession = {
    async execute() {
      return { rowsAffected: 0 };
    },
    async query<T>(sql: string): Promise<T[]> {
      if (
        sql.includes("d.document_number") &&
        sql.includes("FROM inventory_all_stock_movements m")
      ) {
        assert.match(sql, /LEFT JOIN inventory_stock_movements original/u);
        assert.match(
          sql,
          /d\.id=COALESCE\(original\.document_id,m\.document_id\)/u,
        );
        mainCall += 1;
        return (mainCall === 1 ? [receipt, issue] : [issue]) as T[];
      }
      if (sql.includes("SELECT m.business_date")) {
        prefixCall += 1;
        const rows = prefixCall === 1 ? [opening] : [opening, receipt];
        return rows.map((row) => ({
          business_date: row.business_date,
          business_order: row.business_order,
          document_id: row.document_id,
          line_id: row.line_id,
          movement_id: row.movement_id,
          quantity_delta: row.quantity_delta,
        })) as T[];
      }
      return [];
    },
    async queryOne<T>() {
      return null as T | null;
    },
  };
  return {
    ...session,
    async transaction<T>(
      operation: (transaction: DatabaseSession) => Promise<T>,
    ): Promise<T> {
      return operation(session);
    },
    async close() {},
  };
}

test("carries exact closing quantity into the next kardex page opening", async () => {
  const reader = new SqliteInventoryQuantityReportReader(fakeExecutor());
  const first = await reader.readKardex({
    companyId: "company-1",
    stockKey: key,
    businessDateFrom: "2026-01-02",
    businessDateTo: "2026-12-31",
    limit: 1,
  });
  assert.equal(first.openingQuantity, "5");
  assert.equal(first.incomingQuantity, "10");
  assert.equal(first.closingQuantity, "15");
  assert.ok(first.nextCursor);

  const second = await reader.readKardex({
    companyId: "company-1",
    stockKey: key,
    businessDateFrom: "2026-01-02",
    businessDateTo: "2026-12-31",
    cursor: first.nextCursor,
    limit: 1,
  });
  assert.equal(second.openingQuantity, first.closingQuantity);
  assert.equal(second.outgoingQuantity, "3");
  assert.equal(second.closingQuantity, "12");
});

test("includes reversal compensation in kardex and links it to the readable original document", async () => {
  const database = fakeExecutor();
  const originalQuery = database.query.bind(database);
  const receipt = movementRow({
    movementId: "receipt",
    date: "2026-01-02",
    order: 1,
    delta: "20",
  });
  const reversal = {
    ...movementRow({
      movementId: "reversal",
      date: "2026-01-03",
      order: 2,
      delta: "-20",
    }),
    document_id: "technical-reversal-effect-id",
    display_document_id: receipt.document_id,
    document_number: receipt.document_number,
    document_type: "receipt" as const,
    line_id: receipt.line_id,
    reversal_of_movement_id: receipt.movement_id,
    is_reversal: 1,
  };
  database.query = async function <T>(
    sql: string,
    parameters?: readonly DatabaseValue[],
  ) {
    if (
      sql.includes("d.document_number") &&
      sql.includes("FROM inventory_all_stock_movements m")
    ) {
      assert.match(sql, /LEFT JOIN inventory_stock_movements original/u);
      return [receipt, reversal] as T[];
    }
    return originalQuery<T>(sql, parameters);
  };

  const result = await new SqliteInventoryQuantityReportReader(
    database,
  ).readKardex({
    companyId: "company-1",
    stockKey: key,
    limit: 100,
  });

  assert.equal(result.incomingQuantity, "20");
  assert.equal(result.outgoingQuantity, "20");
  assert.equal(result.closingQuantity, "0");
  assert.equal(result.entries[1]?.source.isReversal, true);
  assert.equal(result.entries[1]?.source.documentId, receipt.document_id);
  assert.equal(result.entries[1]?.source.documentNumber, "RECEIPT");
});

test("returns exact canonical balance strings without floating-point conversion", async () => {
  const exact = "12345678901234567890.000000000000000001";
  const database = fakeExecutor();
  const originalQuery = database.query.bind(database);
  database.query = async function <T>(
    sql: string,
    parameters?: readonly DatabaseValue[],
  ) {
    if (sql.includes("FROM inventory_stock_balances b")) {
      return [
        {
          stock_key: "key-1",
          company_id: "company-1",
          product_id: "product-1",
          warehouse_id: "warehouse-1",
          zone_id: null,
          location_id: null,
          quantity: exact,
          last_movement_id: "movement-1",
          product_code: "P-1",
          product_title: "کالا",
          warehouse_code: "W-1",
          warehouse_title: "انبار",
          zone_code: null,
          zone_title: null,
          location_code: null,
          location_title: null,
        },
      ] as T[];
    }
    return originalQuery<T>(sql, parameters);
  };
  const result = await new SqliteInventoryQuantityReportReader(
    database,
  ).readBalances({ companyId: "company-1", limit: 100 });
  assert.equal(result.items[0]?.quantity, exact);
});

test("rejects kardex access to a warehouse owned by another branch", async () => {
  const database = fakeExecutor();
  database.queryOne = async function <T>(sql: string) {
    if (sql.includes("FROM warehouses")) {
      return { organizational_scope: "branch", branch_id: "branch-2" } as T;
    }
    return null;
  };

  await assert.rejects(
    () =>
      new SqliteInventoryQuantityReportReader(database).readKardex({
        companyId: "company-1",
        branchId: "branch-1",
        stockKey: key,
        limit: 100,
      }),
    (error: unknown) =>
      error instanceof InventoryApplicationError &&
      error.code === "inventory.application.unauthorized",
  );
});
