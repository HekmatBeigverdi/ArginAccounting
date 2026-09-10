import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseExecuteResult, DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import { InventoryWarehouseDependencyGuard, SqliteInventoryMovementFeedReader } from "../src/index.ts";

class ScriptedDatabase implements DatabaseExecutor {
  constructor(private readonly rows: unknown[][]) {}
  async execute(): Promise<DatabaseExecuteResult> { return { rowsAffected: 0 }; }
  async query<T>(_sql: string, _parameters: readonly DatabaseValue[] = []): Promise<T[]> {
    return (this.rows.shift() ?? []) as T[];
  }
  async queryOne<T>(_sql: string, _parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    return ((this.rows.shift() ?? [])[0] ?? null) as T | null;
  }
  async transaction<T>(work: (session: DatabaseSession) => Promise<T>): Promise<T> { return work(this); }
  async close(): Promise<void> {}
}

const movement = (quantityDelta: string) => ({
  product_id: "product-1",
  warehouse_id: "warehouse-1",
  zone_id: null,
  location_id: null,
  quantity_delta: quantityDelta,
});

test("warehouse delete is blocked by nonzero stock, open documents, and movement history", async () => {
  const db = new ScriptedDatabase([
    [movement("5"), movement("-2.5")],
    [{ count: 1 }],
  ]);
  const result = await new InventoryWarehouseDependencyGuard(db).check({
    companyId: "company-1",
    operation: "warehouse.delete",
    warehouseId: "warehouse-1",
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.blockers.map((item) => item.code), [
    "inventory.warehouse-dependency.nonzero-stock",
    "inventory.warehouse-dependency.open-document",
    "inventory.warehouse-dependency.historical-movement",
  ]);
});

test("warehouse deactivate preserves history when authoritative net stock is zero and no document is open", async () => {
  const db = new ScriptedDatabase([
    [movement("5.000"), movement("-5")],
    [{ count: 0 }],
  ]);
  const result = await new InventoryWarehouseDependencyGuard(db).check({
    companyId: "company-1",
    operation: "warehouse.deactivate",
    warehouseId: "warehouse-1",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.blockers.length, 0);
});

test("location move treats immutable movement history as a blocker even when net stock is zero", async () => {
  const db = new ScriptedDatabase([
    [movement("3"), movement("-3")],
    [{ count: 0 }],
  ]);
  const result = await new InventoryWarehouseDependencyGuard(db).check({
    companyId: "company-1",
    operation: "location.move",
    warehouseId: "warehouse-1",
    zoneId: "zone-1",
    locationId: "location-1",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.blockers.at(-1)?.code, "inventory.warehouse-dependency.historical-movement");
});

test("movement feed returns authoritative facts in bounded deterministic chronology", async () => {
  const db = new ScriptedDatabase([[
    {
      movement_id: "m-1", company_id: "company-1", document_id: "doc-1", line_id: "line-1",
      transfer_id: null, reversal_of_movement_id: null, product_id: "product-1",
      warehouse_id: "warehouse-1", zone_id: null, location_id: null,
      business_date: "2026-09-08", business_order: 1, recorded_at: "2026-09-08T10:00:00.000Z", quantity_delta: "5",
    },
  ]]);
  const page = await new SqliteInventoryMovementFeedReader(db).read({ companyId: "company-1", limit: 50 });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0]?.movementId, "m-1");
  assert.equal(page.items[0]?.quantityDelta, "5");
  assert.equal(page.nextMovementId, "m-1");
});

test("movement feed rejects unbounded requests", async () => {
  const db = new ScriptedDatabase([]);
  await assert.rejects(
    () => new SqliteInventoryMovementFeedReader(db).read({ companyId: "company-1", limit: 501 }),
    /inventory\.movement-feed\.limit-invalid/u,
  );
});
