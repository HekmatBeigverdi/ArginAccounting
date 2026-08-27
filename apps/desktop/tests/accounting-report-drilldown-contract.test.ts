import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reportsPagePath = new URL("../src/pages/accounting/accounting-reports-page.tsx", import.meta.url);
const filtersPath = new URL("../src/features/accounting/accounting-report-filters.tsx", import.meta.url);
const tracePagePath = new URL("../src/pages/accounting/journal-voucher-trace-page.tsx", import.meta.url);
const routeAdapterPath = new URL("../src/pages/accounting/journal-vouchers-route.tsx", import.meta.url);
const routerPath = new URL("../src/app/router/app-router.tsx", import.meta.url);

test("report filters remain reusable and execute deliberately", async () => {
  const [page, filters] = await Promise.all([
    readFile(reportsPagePath, "utf8"),
    readFile(filtersPath, "utf8"),
  ]);

  assert.match(filters, /export interface AccountingReportFilterState/);
  assert.match(filters, /PersianDatePicker/);
  assert.match(filters, /includeDescendants/);
  assert.match(filters, /dimensionMemberId/);
  assert.match(filters, /includeZeroBalances/);
  assert.match(page, /ExecutedReport/);
  assert.match(page, /buildQuery/);
  assert.match(page, /executeReport/);
  assert.match(page, /onRun=\{\(\) => void runReport\(\)\}/);
});

test("aggregate drill-down preserves the executed query context", async () => {
  const page = await readFile(reportsPagePath, "utf8");

  assert.match(page, /\.\.\.executed\.query/);
  assert.match(page, /accounts: Object\.freeze\(\{ accountId, includeDescendants: false \}\)/);
  assert.match(page, /dimensions: Object\.freeze/);
  assert.match(page, /parentReport/);
  assert.match(page, /executeReport\("general", query\)/);
  assert.match(page, /executeReport\("journal", query\)/);
});

test("detail rows trace to durable voucher and journal-line identities", async () => {
  const [page, tracePage, routeAdapter, router] = await Promise.all([
    readFile(reportsPagePath, "utf8"),
    readFile(tracePagePath, "utf8"),
    readFile(routeAdapterPath, "utf8"),
    readFile(routerPath, "utf8"),
  ]);

  assert.match(page, /voucherId/);
  assert.match(page, /journalLineId/);
  assert.match(page, /from: "accounting-reports"/);
  assert.match(routeAdapter, /fromReports/);
  assert.match(routeAdapter, /JournalVoucherTracePage/);
  assert.match(router, /JournalVouchersRoute/);
  assert.match(tracePage, /journalVoucherPermissions\.view/);
  assert.match(tracePage, /journal-trace-table__row--active/);
  assert.match(tracePage, /Voucher ID/);
  assert.match(tracePage, /Journal Line ID/);
});
