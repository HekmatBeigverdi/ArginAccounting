import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Warehouse Desktop page composes public services/adapters and never embeds direct SQL", async () => {
  const page = await read("../src/pages/warehouse/warehouses-page.tsx");
  assert.match(page, /WarehouseService/u);
  assert.match(page, /SecuredWarehouseService/u);
  assert.match(page, /SqliteWarehouseUnitOfWork/u);
  assert.match(page, /SqliteWarehouseReader/u);
  assert.match(page, /SqliteWarehouseIdempotencyExecutor/u);
  assert.doesNotMatch(page, /\bSELECT\b|\bINSERT\s+INTO\b|\bUPDATE\s+warehouses\b|\bDELETE\s+FROM\b/iu);
});

test("Warehouse Desktop surface retains explicit error, loading and empty-state handling", async () => {
  const page = await read("../src/pages/warehouse/warehouses-page.tsx");
  assert.match(page, /loading/u);
  assert.match(page, /error/u);
  assert.match(page, /هیچ انباری/u);
  assert.match(page, /setError/u);
});

test("shared Warehouse selector stays reusable and accessibility-oriented", async () => {
  const selector = await read("../src/components/warehouse/warehouse-selector.tsx");
  assert.match(selector, /buildWarehouseSelectorQuery/u);
  assert.match(selector, /toWarehouseSelectionReference/u);
  assert.match(selector, /role="combobox"/u);
  assert.match(selector, /role="listbox"/u);
  assert.match(selector, /aria-activedescendant/u);
  assert.match(selector, /dir="ltr"/u);
  assert.match(selector, /useDeferredValue/u);
  assert.match(selector, /requestId/u);
});

test("Warehouse route and permissions remain connected after maintenance extensions", async () => {
  const [router, navigation, security] = await Promise.all([
    read("../src/app/router/app-router.tsx"),
    read("../src/app/navigation/navigation-items.ts"),
    read("../../../packages/security/src/permissions/inventory.ts").catch(() => ""),
  ]);
  assert.match(router, /\/inventory\/warehouses/u);
  assert.match(navigation, /inventory\.warehouses\.view/u);
  if (security) {
    assert.match(security, /inventory\.warehouses\.view/u);
    assert.match(security, /inventory\.warehouses\.manage-locations/u);
    assert.match(security, /inventory\.warehouses\.delete/u);
  }
});

test("Desktop package declares Warehouse domain and SQLite adapters as workspace dependencies", async () => {
  const packageJson = JSON.parse(await read("../package.json")) as { dependencies?: Record<string, string> };
  assert.equal(packageJson.dependencies?.["@argin/warehouse"], "workspace:*");
  assert.equal(packageJson.dependencies?.["@argin/warehouse-tauri"], "workspace:*");
});
