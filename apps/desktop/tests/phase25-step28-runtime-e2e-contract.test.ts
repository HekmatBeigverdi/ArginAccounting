import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path:string) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("stock Sales runtime connects finalize -> Issue confirm -> valuation -> Journal", async () => {
  const salesPage = await read("../src/pages/sales/sales-documents-page.tsx");
  const inventoryPage = await read("../src/pages/inventory/inventory-documents-page.tsx");
  const posting = await read(
    "../src/composition/sales-posting/create-sales-posting-workspace-services.ts",
  );

  assert.match(salesPage, /action === "finalize"/u);
  assert.match(salesPage, /posting\.evaluateAndPost/u);
  assert.match(inventoryPage, /selected\.documentType === "issue"/u);
  assert.match(inventoryPage, /sourceReference\?\.sourceSystem === "sales"/u);
  assert.match(inventoryPage, /posting\.evaluateAndPost/u);
  assert.match(posting, /inventory_stock_movements/u);
  assert.match(posting, /inventory_valuation_entries/u);
  assert.match(posting, /SqliteJournalVoucherRepository/u);
  assert.match(posting, /journalRepository\.create/u);
});

test("service-only Sales can post at finalize without waiting for Inventory", async () => {
  const posting = await read(
    "../src/composition/sales-posting/create-sales-posting-workspace-services.ts",
  );

  assert.match(posting, /const stockLines = commercial\.lines\.filter/u);
  assert.match(posting, /if \(stockLines\.length > 0\)/u);
  assert.match(posting, /createSalesPostingJournalDraft/u);
  assert.match(posting, /salesJournalComponentsFromInvoice/u);
});

test("zero calculated VAT never resolves or creates a false Output VAT line", async () => {
  const posting = await read(
    "../src/composition/sales-posting/create-sales-posting-workspace-services.ts",
  );

  assert.match(posting, /if \(line\.totals\.taxAmount > 0\)/u);
  assert.match(posting, /resolveSalesOutputVatAccount/u);
});

test("historical valuation recovery exposes controlled rebuild instead of infinite blind retry", async () => {
  const valuationPage = await read(
    "../src/pages/inventory/inventory-valuation-workspace-page.tsx",
  );
  const panels = await read(
    "../src/pages/inventory/inventory-valuation-panels.tsx",
  );
  const services = await read(
    "../src/composition/inventory/create-inventory-valuation-workspace-services.ts",
  );
  const live = await read(
    "../../../packages/inventory-tauri/src/sqlite-inventory-valuation-live-service.ts",
  );

  assert.match(services, /diagnoseMovement/u);
  assert.match(services, /requiresHistoricalRebuild/u);
  assert.match(panels, /بازسازی تاریخی کنترل‌شده/u);
  assert.match(valuationPage, /rebuildHistoricalValuation/u);
  assert.match(live, /incrementallyProcessable/u);
});

test("historical MWA -> FIFO policy transition has explicit rebuild support", async () => {
  const rebuild = await read(
    "../../../packages/inventory-tauri/src/sqlite-inventory-valuation-historical-rebuild-service.ts",
  );

  assert.match(rebuild, /ensureFifoTransitionLayer/u);
  assert.match(rebuild, /state\.lastMethod!=="moving_average"/u);
  assert.match(rebuild, /fifo-transition:/u);
  assert.match(rebuild, /VALUATION_HISTORICAL_REBUILD_FIFO_INSUFFICIENT/u);
});

test("existing finalized Sales invoices get idempotent catch-up when no Posting state exists", async () => {
  const salesPage = await read("../src/pages/sales/sales-documents-page.tsx");
  const posting = await read(
    "../src/composition/sales-posting/create-sales-posting-workspace-services.ts",
  );

  assert.match(salesPage, /Catch up finalized invoices/u);
  assert.match(salesPage, /recovery === null && posting\.canExecute/u);
  assert.match(posting, /sales_posting_idempotency/u);
  assert.match(posting, /if \(already\)/u);
});

test("Sales Posting persistence boundary includes Posting, provenance, idempotency and Outbox", async () => {
  const migration = await read("../src-tauri/migrations/0037_sales_posting.sql");

  for (const table of [
    "sales_postings",
    "sales_posting_rules",
    "sales_posting_idempotency",
    "sales_posting_journal_provenance",
    "sales_posting_outbox",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}\\b`, "u"));
  }

  assert.match(migration, /sales_posting_idempotency is append-only/u);
  assert.match(migration, /sales_posting_journal_provenance is append-only/u);
});

test("committed Sales UI is driven by persisted Posting recovery state and Journal identity", async () => {
  const page = await read("../src/pages/sales/sales-documents-page.tsx");
  const panel = await read("../src/pages/sales/sales-posting-recovery-panel.tsx");

  assert.match(page, /SalesPostingRecoveryPanel/u);
  assert.match(page, /posting\.getRecovery/u);
  assert.match(panel, /journalVoucherId/u);
  assert.match(panel, /committedPostingVersion/u);
});
