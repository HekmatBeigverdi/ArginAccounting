import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseExecutor, DatabaseValue } from "@argin/database";
import { InventoryWarehouseDependencyGuard } from "../src/index.ts";

interface FakeState {
  movementRows: readonly {
    product_id: string;
    warehouse_id: string;
    zone_id: string | null;
    location_id: string | null;
    quantity_delta: string;
  }[];
  openDocumentCount: number;
}

function fakeDatabase(state: FakeState): DatabaseExecutor {
  return {
    async execute() {
      return { rowsAffected: 0 };
    },
    async query<T>(sql: string, _parameters?: readonly DatabaseValue[]): Promise<T[]> {
      if (!sql.includes("inventory_all_stock_movements")) throw new Error(`Unexpected query: ${sql}`);
      return [...state.movementRows] as unknown as T[];
    },
    async queryOne<T>(sql: string, _parameters?: readonly DatabaseValue[]): Promise<T | null> {
      if (!sql.includes("inventory_documents")) throw new Error(`Unexpected queryOne: ${sql}`);
      return { count: state.openDocumentCount } as unknown as T;
    },
    async transaction<T>(operation: Parameters<DatabaseExecutor["transaction"]>[0]): Promise<T> {
      return operation(this);
    },
    async close() {},
  };
}

const zeroNetHistory = [
  { product_id: "product-1", warehouse_id: "warehouse-1", zone_id: "zone-1", location_id: "location-1", quantity_delta: "5" },
  { product_id: "product-1", warehouse_id: "warehouse-1", zone_id: "zone-1", location_id: "location-1", quantity_delta: "-5" },
] as const;

const baseInput = {
  companyId: "company-1",
  warehouseId: "warehouse-1",
  zoneId: "zone-1",
  locationId: "location-1",
} as const;

test("historical movement alone permits deactivate but blocks destructive delete", async () => {
  const guard = new InventoryWarehouseDependencyGuard(fakeDatabase({ movementRows: zeroNetHistory, openDocumentCount: 0 }));

  const deactivate = await guard.check({ ...baseInput, operation: "location.deactivate" });
  assert.equal(deactivate.allowed, true);
  assert.deepEqual(deactivate.blockers, []);

  const remove = await guard.check({ ...baseInput, operation: "location.delete" });
  assert.equal(remove.allowed, false);
  assert.deepEqual(remove.blockers.map((item) => item.code), [
    "inventory.warehouse-dependency.historical-movement",
  ]);
});

test("historical movement blocks moving a location because immutable stock-key meaning must not change", async () => {
  const guard = new InventoryWarehouseDependencyGuard(fakeDatabase({ movementRows: zeroNetHistory, openDocumentCount: 0 }));
  const result = await guard.check({ ...baseInput, operation: "location.move" });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.some((item) => item.code === "inventory.warehouse-dependency.historical-movement"));
});

test("non-zero authoritative stock and open documents independently block maintenance", async () => {
  const guard = new InventoryWarehouseDependencyGuard(fakeDatabase({
    movementRows: [
      { product_id: "product-1", warehouse_id: "warehouse-1", zone_id: null, location_id: null, quantity_delta: "2.5" },
    ],
    openDocumentCount: 3,
  }));
  const result = await guard.check({
    companyId: "company-1",
    warehouseId: "warehouse-1",
    operation: "warehouse.deactivate",
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(new Set(result.blockers.map((item) => item.code)), new Set([
    "inventory.warehouse-dependency.nonzero-stock",
    "inventory.warehouse-dependency.open-document",
  ]));
});
