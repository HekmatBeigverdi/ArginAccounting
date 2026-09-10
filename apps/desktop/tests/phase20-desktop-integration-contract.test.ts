import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const router = await readFile(new URL("../src/app/router/app-router.tsx", import.meta.url), "utf8");
const navigation = await readFile(new URL("../src/app/navigation/navigation-items.ts", import.meta.url), "utf8");
const transferCenter = await readFile(new URL("../src/pages/inventory/inventory-transfer-center-page.tsx", import.meta.url), "utf8");
const warehousePage = await readFile(new URL("../src/pages/warehouse/warehouses-page.tsx", import.meta.url), "utf8");
const workspaceComposition = await readFile(new URL("../src/composition/inventory/create-inventory-workspace-services.ts", import.meta.url), "utf8");

test("Inventory desktop routes expose documents reports and transfer center", () => {
  assert.match(router, /path="\/inventory\/documents"/u);
  assert.match(router, /path="\/inventory\/reports"/u);
  assert.match(router, /path="\/inventory\/transfer-center"/u);
  assert.match(navigation, /inventory\/transfer-center/u);
});

test("transfer center composes import export print through authenticated company and fiscal context", () => {
  assert.match(transferCenter, /createInventoryImportController/u);
  assert.match(transferCenter, /inventoryImportBatchId/u);
  assert.match(transferCenter, /createInventoryImportTemplateXlsx/u);
  assert.match(transferCenter, /downloadInventoryPrintModelXlsx/u);
  assert.match(transferCenter, /openInventoryPrintPreview/u);
  assert.match(transferCenter, /active\.companyId/u);
  assert.match(transferCenter, /active\.fiscalYearId/u);
  assert.match(transferCenter, /inventoryPermissions\.import/u);
  assert.match(transferCenter, /inventoryPermissions\.export/u);
});

test("Inventory workspace uses secured lifecycle composition rather than direct stock SQL", () => {
  assert.match(workspaceComposition, /SecuredInventoryService/u);
  assert.match(workspaceComposition, /SharedInventoryApprovalGateway/u);
  assert.match(workspaceComposition, /SharedInventoryAuditSink/u);
  assert.doesNotMatch(workspaceComposition, /INSERT INTO inventory_stock_movements/u);
});

test("Warehouse maintenance is expected to compose the concrete Inventory dependency guard", () => {
  // Step 20 release gate: this source-level assertion intentionally fails until the production
  // WarehouseService composition supplies InventoryWarehouseDependencyGuard(database).
  assert.match(warehousePage, /InventoryWarehouseDependencyGuard/u);
  assert.match(warehousePage, /dependencyGuard:\s*new InventoryWarehouseDependencyGuard\(database\)/u);
});
