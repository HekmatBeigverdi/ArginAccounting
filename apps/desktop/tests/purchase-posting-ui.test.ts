import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Purchase workspace embeds the Posting and Trace Viewer panel", async () => {
  const page = await read("../src/pages/purchase/purchase-documents-page.tsx");
  assert.match(page, /PurchasePostingPanel/u);
  assert.match(page, /sourceId=\{detail\.document\.documentId\}/u);
  assert.match(page, /sourceType=\{detail\.document\.documentType\}/u);
});

test("Posting panel exposes status, reconciliation, trace and Journal Lines without commercial re-entry", async () => {
  const panel = await read("../src/pages/purchase/purchase-posting-panel.tsx");

  for (const text of [
    "ثبت حسابداری خرید",
    "سلامت زنجیره",
    "نمایش مسیر ردیابی",
    "ردیف‌های سند حسابداری",
    "هنوز ثبت حسابداری ایجاد نشده است",
  ]) {
    assert.match(panel, new RegExp(text, "u"));
  }

  assert.doesNotMatch(panel, /unitPrice|discountAmount|chargeAmount|taxAmount\s*:/u);
  assert.match(panel, /selected\.reconciled/u);
  assert.match(panel, /selected\.issues\.map/u);
  assert.match(panel, /selected\.journal\.lines\.map/u);
});

test("Desktop Posting workspace checks view and trace permissions independently", async () => {
  const service = await read("../src/composition/purchase-posting/create-purchase-posting-workspace-services.ts");

  assert.match(service, /purchasePostingPermissions\.view/u);
  assert.match(service, /purchasePostingPermissions\.viewTrace/u);
  assert.match(service, /purchasePostingPermissions\.execute/u);
  assert.match(service, /purchasePostingPermissions\.reverse/u);
  assert.match(service, /branchIds/u);
  assert.match(service, /findBySource/u);
});

test("Desktop declares Purchase Posting application and SQLite adapter dependencies", async () => {
  const pkg = JSON.parse(await read("../package.json")) as { dependencies?: Record<string, string> };
  assert.equal(pkg.dependencies?.["@argin/purchase-posting"], "workspace:*");
  assert.equal(pkg.dependencies?.["@argin/purchase-posting-tauri"], "workspace:*");
});


test("Phase 23 Step 29 exposes automatic Purchase Posting execution and recovery action", async () => {
  const [panel, service, purchasePage] = await Promise.all([
    read("../src/pages/purchase/purchase-posting-panel.tsx"),
    read("../src/composition/purchase-posting/create-purchase-posting-workspace-services.ts"),
    read("../src/pages/purchase/purchase-documents-page.tsx"),
  ]);

  assert.match(panel, /ایجاد ثبت حسابداری/u);
  assert.match(panel, /executeSupplierInvoice/u);
  assert.match(service, /orchestrateSupplierInvoicePosting/u);
  assert.match(service, /createPurchasePostingFact/u);
  assert.match(service, /createPurchaseFulfillmentAccountingPolicy\("automatic"\)/u);
  assert.match(service, /SqlitePurchasePostingReplayUnitOfWork/u);
  assert.match(service, /SHA-256/u);
  assert.match(service, /purchase_posting_rules|listActive/u);
  assert.match(purchasePage, /سند حسابداری خرید ایجاد شد/u);
  assert.match(purchasePage, /postingServices\.executeSupplierInvoice/u);
  assert.doesNotMatch(panel, /accountId\s*[:=].*input|unitPrice|discountAmount/u);
});


test("Phase 23 Step 30 presents an integrated Purchase Accounting workspace", async () => {
  const [panel, service, page, css] = await Promise.all([
    read("../src/pages/purchase/purchase-posting-panel.tsx"),
    read("../src/composition/purchase-posting/create-purchase-posting-workspace-services.ts"),
    read("../src/pages/purchase/purchase-documents-page.tsx"),
    read("../src/pages/purchase/purchase-posting-panel.css"),
  ]);

  for (const text of [
    "مسیر خرید تا حسابداری",
    "دریافت انبار",
    "تطبیق خرید",
    "ثبت خرید",
    "سند حسابداری",
    "اقدام بعدی",
    "سلامت زنجیره",
    "جمع بدهکار / بستانکار",
  ]) {
    assert.match(panel, new RegExp(text, "u"));
  }

  assert.match(panel, /receiptFulfilled/u);
  assert.match(panel, /matchingStatus/u);
  assert.match(panel, /describeAccounts/u);
  assert.match(panel, /accountLabels\[line\.accountId\]\?\.name/u);
  assert.match(service, /SELECT id,code,name/u);
  assert.match(service, /describeAccounts/u);
  assert.match(page, /stockLineCount=/u);
  assert.match(page, /receiptFulfilled=/u);
  assert.match(page, /matchingStatus=/u);
  assert.match(css, /purchase-accounting-flow/u);
  assert.match(css, /purchase-accounting-next-action/u);
  assert.doesNotMatch(panel, /ورود حساب بدهکار|ورود حساب بستانکار/u);
});


test("Purchase posting bootstraps core built-in account mappings and keeps matching success visible", async () => {
  const [service, page] = await Promise.all([
    read("../src/composition/purchase-posting/create-purchase-posting-workspace-services.ts"),
    read("../src/pages/purchase/purchase-documents-page.tsx"),
  ]);

  assert.match(service, /createPurchasePostingRule/u);
  assert.match(service, /assets\.current\.inventory/u);
  assert.match(service, /assets\.current\.raw-materials/u);
  assert.match(service, /liabilities\.current\.payables/u);
  assert.match(service, /inventory-asset/u);
  assert.match(service, /accounts-payable/u);
  assert.match(page, /purchase_posting\.account_mapping_missing/u);
  assert.match(page, /تطبیق خرید انجام شده است/u);
  assert.match(page, /postingWarning/u);
});


test("Purchase posting auto-materializes supplier PARTY dimension member for payable accounts", async () => {
  const [service, page] = await Promise.all([
    read("../src/composition/purchase-posting/create-purchase-posting-workspace-services.ts"),
    read("../src/pages/purchase/purchase-documents-page.tsx"),
  ]);

  assert.match(service, /createAccountingDimensionMember/u);
  assert.match(service, /module-party:/u);
  assert.match(service, /sourceReferenceId: supplierId/u);
  assert.match(service, /dimension_type_id=.*source_reference_id/u);
  assert.match(page, /purchase_posting\.dimension_required_missing/u);
  assert.match(page, /بُعد «طرف حساب»/u);
});
