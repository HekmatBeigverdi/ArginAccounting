import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/pages/accounting/accounting-reports-page.tsx", import.meta.url);
const compositionPath = new URL("../src/composition/accounting/create-accounting-report-services.ts", import.meta.url);
const filtersPath = new URL("../src/features/accounting/accounting-report-filters.tsx", import.meta.url);
const exportPath = new URL("../src/features/accounting/accounting-report-export.ts", import.meta.url);
const tracePagePath = new URL("../src/pages/accounting/journal-voucher-trace-page.tsx", import.meta.url);
const routeAdapterPath = new URL("../src/pages/accounting/journal-vouchers-route.tsx", import.meta.url);

test("Phase 16 report reads and exports remain behind Application authorization", async () => {
  const [page, composition] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(compositionPath, "utf8"),
  ]);

  assert.match(composition, /SqliteAccountingReportDataReader/);
  assert.match(composition, /DefaultAccountingReportQueryService/);
  assert.match(composition, /SecuredAccountingReportQueryService/);
  assert.match(composition, /assertAccountingReportExportAuthorized/);
  assert.match(composition, /canAccessAllBranches/);
  assert.match(page, /accountingReportPermissions\.export/);
  assert.match(page, /await desktopServices\.authorizeExport\(executed\.query\)/);
});

test("Phase 16 report UI keeps draft filters separate from the exact executed query", async () => {
  const [page, filters] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(filtersPath, "utf8"),
  ]);

  assert.match(filters, /export interface AccountingReportFilterState/);
  assert.match(page, /ExecutedReport/);
  assert.match(page, /buildQuery/);
  assert.match(page, /executeReport/);
  assert.match(page, /onRun=\{\(\) => void runReport\(\)\}/);
  assert.match(page, /\.\.\.executed\.query/);
});

test("Phase 16 aggregate and detail drill-down preserve durable journal traceability", async () => {
  const [page, tracePage, routeAdapter] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(tracePagePath, "utf8"),
    readFile(routeAdapterPath, "utf8"),
  ]);

  assert.match(page, /executeReport\("general", query\)/);
  assert.match(page, /executeReport\("journal", query\)/);
  assert.match(page, /voucherId/);
  assert.match(page, /journalLineId/);
  assert.match(page, /from: "accounting-reports"/);
  assert.match(routeAdapter, /JournalVoucherTracePage/);
  assert.match(tracePage, /journalVoucherPermissions\.view/);
  assert.match(tracePage, /Journal Line ID/);
});

test("Phase 16 preview, Excel and PDF paths reuse export projections and native print contract", async () => {
  const [page, exportSource] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(exportPath, "utf8"),
  ]);

  assert.match(page, /downloadAccountingReportExcel/);
  assert.match(page, /openAccountingReportPrintPreview/);
  assert.match(exportSource, /createAccountingReportExportDocument/);
  assert.match(exportSource, /createAccountingReportSpreadsheetXml/);
  assert.match(exportSource, /printAccountingReportFromMainWebview/);
  assert.match(exportSource, /@page\{size:A4 landscape/);
  assert.match(exportSource, /DisplayRightToLeft/);
  assert.doesNotMatch(exportSource, /calculateAccountBalanceTurnover|createTrialBalance|createGeneralLedger|createJournalReport/);
});
