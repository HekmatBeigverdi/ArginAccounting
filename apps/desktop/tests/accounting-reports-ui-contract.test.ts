import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/pages/accounting/accounting-reports-page.tsx", import.meta.url);
const cssPath = new URL("../src/pages/accounting/accounting-reports-page.css", import.meta.url);
const compositionPath = new URL("../src/composition/accounting/create-accounting-report-services.ts", import.meta.url);
const routerPath = new URL("../src/app/router/app-router.tsx", import.meta.url);
const navigationPath = new URL("../src/app/navigation/navigation-items.ts", import.meta.url);

test("accounting reports center is routed and permission-aware", async () => {
  const [page, router, navigation] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(routerPath, "utf8"),
    readFile(navigationPath, "utf8"),
  ]);

  assert.match(router, /path="\/accounting\/reports"/);
  assert.match(navigation, /گزارش‌های حسابداری/);
  assert.match(navigation, /requiredAnyPermissions/);
  assert.match(page, /accountingReportPermissions\.viewTrialBalance/);
  assert.match(page, /accountingReportPermissions\.viewJournal/);
  assert.match(page, /dir="rtl"/);
});

test("reports center preserves density and Solar Hijri presentation contracts", async () => {
  const [page, css] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(page, /fa-IR-u-ca-persian/);
  assert.match(page, /accounting-workspace__data-surface/);
  assert.match(page, /در حال محاسبه و بارگذاری گزارش/);
  assert.match(page, /داده‌ای برای نمایش وجود ندارد/);
  assert.match(css, /--ui-density-row-height/);
  assert.match(css, /--ui-density-control-height/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
});

test("desktop reporting composition keeps secured service in front of SQLite", async () => {
  const composition = await readFile(compositionPath, "utf8");

  assert.match(composition, /SqliteAccountingReportDataReader/);
  assert.match(composition, /DefaultAccountingReportQueryService/);
  assert.match(composition, /SecuredAccountingReportQueryService/);
  assert.match(composition, /branchIds/);
  assert.match(composition, /canAccessAllBranches/);
});
