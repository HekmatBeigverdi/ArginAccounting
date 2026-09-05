import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("warehouse maintenance migration keeps physical deletes as tombstones", async () => {
  const migration = await read("../src-tauri/migrations/0025_warehouse_maintenance_tombstones.sql");
  const runner = await read("../src-tauri/src/lib.rs");

  assert.match(migration, /ALTER TABLE warehouse_zones\s+ADD COLUMN deleted_at TEXT;/u);
  assert.match(migration, /ALTER TABLE warehouse_locations\s+ADD COLUMN deleted_at TEXT;/u);
  assert.match(migration, /ix_warehouse_zones_tombstones/u);
  assert.match(migration, /ix_warehouse_locations_tombstones/u);
  assert.match(runner, /version: 25/u);
  assert.match(runner, /0025_warehouse_maintenance_tombstones\.sql/u);
});

test("warehouse management UI exposes the agreed maintenance operations", async () => {
  const page = await read("../src/pages/warehouse/warehouses-page.tsx");

  assert.match(page, /ویرایش ناحیه/u);
  assert.match(page, /ویرایش موقعیت/u);
  assert.match(page, /فعال/u);
  assert.match(page, /غیرفعال/u);
  assert.match(page, /حذف/u);
  assert.match(page, /انتقال/u);
  assert.match(page, /Tombstone/u);
  assert.match(page, /moveLocation/u);
  assert.match(page, /deleteWarehouse/u);
});
