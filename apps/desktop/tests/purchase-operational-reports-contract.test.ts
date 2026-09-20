import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Purchase operational reports are routed and permission-scoped", async () => {
  const [router, navigation] = await Promise.all([
    read("src/app/router/app-router.tsx"),
    read("src/app/navigation/navigation-items.ts"),
  ]);
  assert.match(router, /path="\/purchases\/reports"/u);
  assert.match(navigation, /گزارش‌های خرید/u);
  assert.match(navigation, /purchases\.documents\.view/u);
});

test("Purchase report page exposes the four Step 21 operational views", async () => {
  const page = await read("src/pages/purchase/purchase-operational-reports-page.tsx");
  assert.match(page, /دفتر اسناد خرید/u);
  assert.match(page, /خلاصه تأمین‌کنندگان/u);
  assert.match(page, /تطبیق فاکتور و رسید/u);
  assert.match(page, /هزینه‌های حل‌نشده/u);
  assert.match(page, /fa-IR-u-ca-persian/u);
  assert.match(page, /jalaliToGregorian/u);
  assert.match(page, /dir="rtl"/u);
});

test("Purchase report composition enforces view and persisted branch scope", async () => {
  const composition = await read("src/composition/purchase/create-purchase-report-services.ts");
  assert.match(composition, /new SqlitePurchaseOperationalReportReader/u);
  assert.match(composition, /purchasePermissions\.view/u);
  assert.match(composition, /actor\.branchIds\.includes/u);
  assert.match(composition, /readDocumentRegister/u);
  assert.match(composition, /readSupplierActivity/u);
  assert.match(composition, /readInvoiceMatching/u);
  assert.match(composition, /readUnresolvedCosts/u);
});

test("Purchase report UI stays read-only and does not implement accounting posting", async () => {
  const page = await read("src/pages/purchase/purchase-operational-reports-page.tsx");
  assert.doesNotMatch(page, /createJournal|postJournal|JournalVoucher|postingRule/u);
  assert.doesNotMatch(page, /INSERT INTO|UPDATE |DELETE FROM/u);
});

test("Purchase report page follows display-density tokens", async () => {
  const css = await read("src/pages/purchase/purchase-operational-reports-page.css");
  for (const token of [
    "--ui-density-control-height",
    "--ui-density-row-height",
    "--ui-density-cell-x",
    "--ui-density-cell-y",
    "--ui-density-gap",
    "--ui-density-font-size",
  ]) assert.ok(css.includes(token), token);
});


test("Jalali filter conversion happens on report load, not during partial-input render", async () => {
  const page = await read("src/pages/purchase/purchase-operational-reports-page.tsx");
  assert.doesNotMatch(page, /const filters = useMemo/u);
  assert.match(page, /fromBusinessDate:\s*dateFrom \? jalaliToGregorian\(dateFrom\) : null/u);
  assert.match(page, /toBusinessDate:\s*dateTo \? jalaliToGregorian\(dateTo\) : null/u);
});
