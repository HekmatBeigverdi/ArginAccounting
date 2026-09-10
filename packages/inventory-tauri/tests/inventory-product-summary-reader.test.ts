import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import { SqliteInventoryQuantityReportReader } from "../src/sqlite-inventory-quantity-report-reader.ts";

function executor(): DatabaseExecutor {
  const session: DatabaseSession = {
    async execute() { return { rowsAffected: 0 }; },
    async query<T>(sql: string): Promise<T[]> {
      if (sql.includes("SELECT p.id AS product_id")) {
        return [{ product_id: "product-1", product_code: "SSD-512", product_title: "حافظه SSD" }] as T[];
      }
      if (sql.includes("SELECT b.stock_key,b.warehouse_id")) {
        return [
          { stock_key: "1", warehouse_id: "warehouse-1", warehouse_code: "WH-01", warehouse_title: "انبار مرکزی", quantity: "1.25" },
          { stock_key: "2", warehouse_id: "warehouse-1", warehouse_code: "WH-01", warehouse_title: "انبار مرکزی", quantity: "1.75" },
          { stock_key: "3", warehouse_id: "warehouse-2", warehouse_code: "WH-02", warehouse_title: "انبار فروشگاه", quantity: "3" },
        ] as T[];
      }
      return [];
    },
    async queryOne<T>() { return null as T | null; },
  };
  return {
    ...session,
    async transaction<T>(operation: (transaction: DatabaseSession) => Promise<T>): Promise<T> { return operation(session); },
    async close() {},
  };
}

test("aggregates one product exactly across stock keys and warehouses", async () => {
  const report = await new SqliteInventoryQuantityReportReader(executor()).readProductSummaries({
    companyId: "company-1",
    branchId: null,
    limit: 50,
  });
  const row = report.items[0];
  assert.ok(row);
  assert.equal(row.productCode, "SSD-512");
  assert.equal(row.totalQuantity, "6");
  assert.equal(row.warehouseCount, 2);
  assert.equal(row.stockKeyCount, 3);
  assert.deepEqual(row.warehouses.map((warehouse) => [warehouse.warehouseCode, warehouse.quantity]), [
    ["WH-01", "3"],
    ["WH-02", "3"],
  ]);
});

test("keeps aggregation branch-scoped when a branch context is supplied", async () => {
  let sawBranchScope = false;
  const database = executor();
  const originalQuery = database.query.bind(database);
  database.query = async function <T>(sql: string, parameters?: readonly DatabaseValue[]) {
    if (sql.includes("w.organizational_scope='branch' AND w.branch_id=?")) sawBranchScope = true;
    return originalQuery<T>(sql, parameters);
  };
  await new SqliteInventoryQuantityReportReader(database).readProductSummaries({
    companyId: "company-1",
    branchId: "branch-1",
    limit: 50,
  });
  assert.equal(sawBranchScope, true);
});
