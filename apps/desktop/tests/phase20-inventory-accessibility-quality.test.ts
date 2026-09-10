import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const reportsPage = await readFile(new URL("../src/pages/inventory/inventory-quantity-reports-page.tsx", import.meta.url), "utf8");
const documentsPage = await readFile(new URL("../src/pages/inventory/inventory-documents-page.tsx", import.meta.url), "utf8");
const reportReader = await readFile(new URL("../../../packages/inventory-tauri/src/sqlite-inventory-quantity-report-reader.ts", import.meta.url), "utf8");
const workspaceReader = await readFile(new URL("../../../packages/inventory-tauri/src/sqlite-inventory-workspace-reader.ts", import.meta.url), "utf8");

test("Inventory primary workspaces retain Persian RTL structure and labelled interactive groups", () => {
  assert.match(reportsPage, /<Page className="inventory-report-page" dir="rtl">/u);
  assert.match(documentsPage, /dir="rtl"/u);
  assert.match(reportsPage, /role="tablist"/u);
  assert.match(reportsPage, /aria-label="نوع گزارش"/u);
  assert.match(reportsPage, /role="group"/u);
  assert.match(reportsPage, /aria-label="نمای موجودی"/u);
  assert.match(reportsPage, /<label[\s>]/u);
  assert.match(documentsPage, /<label[\s>]/u);
});

test("Inventory user-visible feedback is exposed through semantic Feedback or alert/status roles", () => {
  assert.match(reportsPage, /<Feedback tone="error">/u);
  assert.match(documentsPage, /<Feedback/u);
  assert.match(reportsPage, /aria-label="توضیح گزارش"/u);
});

test("Inventory quantities and durable codes preserve explicit LTR islands inside RTL UI", () => {
  assert.match(reportsPage, /dir="ltr"/u);
  assert.match(documentsPage, /dir="ltr"/u);
});

test("Inventory report and workspace readers enforce bounded reads instead of unbounded lists", () => {
  assert.match(reportReader, /const MAX_LIMIT = 500/u);
  assert.match(reportReader, /const READ_CHUNK_SIZE = 500/u);
  assert.match(reportReader, /LIMIT \?/u);
  assert.doesNotMatch(reportReader, /SELECT\s+\*\s+FROM\s+inventory_all_stock_movements\s*(?:;|`)/u);
  assert.match(workspaceReader, /LIMIT/u);
});

test("Inventory reporting does not convert canonical quantity strings through floating point", () => {
  assert.doesNotMatch(reportReader, /parseFloat\s*\(/u);
  assert.doesNotMatch(reportReader, /Number\s*\([^)]*quantity/u);
  assert.match(reportReader, /addInventoryStockQuantities/u);
  assert.match(reportReader, /normalizeInventoryQuantity/u);
});
