import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Purchase workspace is routed and permission-scoped in navigation", async () => {
  const [router, navigation] = await Promise.all([
    read("src/app/router/app-router.tsx"),
    read("src/app/navigation/navigation-items.ts"),
  ]);
  assert.match(router, /path="\/purchases\/documents"/u);
  assert.match(navigation, /purchases\.documents\.view/u);
  assert.match(navigation, /اسناد خرید/u);
});

test("Purchase workspace keeps Persian RTL presentation with Jalali boundary and LTR commercial inputs", async () => {
  const page = await read("src/pages/purchase/purchase-documents-page.tsx");
  assert.match(page, /dir="rtl"/u);
  assert.match(page, /fa-IR-u-ca-persian/u);
  assert.match(page, /jalaliToGregorian/u);
  assert.match(page, /dir="ltr"\s+inputMode="decimal"/u);
  assert.match(page, /قیمت واحد/u);
  assert.match(page, /تخفیف/u);
  assert.match(page, /هزینه اضافی/u);
  assert.match(page, /مالیات/u);
  assert.match(page, /مبلغ نهایی/u);
});

test("Purchase workspace uses secured composition and recovers from stale versions", async () => {
  const [page, composition] = await Promise.all([
    read("src/pages/purchase/purchase-documents-page.tsx"),
    read("src/composition/purchase/create-purchase-workspace-services.ts"),
  ]);
  assert.match(composition, /new SecuredPurchaseService/u);
  assert.match(composition, /new SqlitePurchaseUnitOfWork/u);
  assert.match(composition, /generateDocumentNumber/u);
  assert.match(composition, /validateOperationDate/u);
  assert.match(page, /PURCHASE_APP_VERSION_CONFLICT/u);
  assert.match(page, /await openDocument\(selected\.documentId\)/u);
});

test("Purchase lifecycle exposes approval history and independent secured actions", async () => {
  const page = await read("src/pages/purchase/purchase-documents-page.tsx");
  assert.match(page, /purchasePermissions\.submit/u);
  assert.match(page, /purchasePermissions\.approve/u);
  assert.match(page, /purchasePermissions\.confirm/u);
  assert.match(page, /purchasePermissions\.cancel/u);
  assert.match(page, /purchasePermissions\.reopen/u);
  assert.match(page, /تاریخچه گردش/u);
  assert.match(page, /ارسال برای تأیید/u);
  assert.match(page, /تأیید/u);
  assert.match(page, /قطعی/u);
});

test("Purchase workspace resolves supplier, product/service and commercial snapshots from master data", async () => {
  const composition = await read("src/composition/purchase/create-purchase-workspace-services.ts");
  assert.match(composition, /new SqlitePartyReader/u);
  assert.match(composition, /roles: \["supplier"\]/u);
  assert.match(composition, /new SqliteProductSelectorReader/u);
  assert.match(composition, /purchasable/u);
  assert.match(composition, /createPurchaseSupplierSnapshot/u);
  assert.match(composition, /createPurchaseItemSnapshot/u);
  assert.match(composition, /createPurchaseCommercialTerms/u);
});

test("Purchase workspace can stage Inventory receipt intent without writing Inventory directly", async () => {
  const [page, composition] = await Promise.all([
    read("src/pages/purchase/purchase-documents-page.tsx"),
    read("src/composition/purchase/create-purchase-workspace-services.ts"),
  ]);
  assert.match(page, /purchases\.receipts\.stage/u);
  assert.match(page, /ایجاد پیش‌نویس رسید انبار/u);
  assert.match(composition, /stageInventoryReceipt/u);
  assert.doesNotMatch(composition, /INSERT INTO inventory_|UPDATE inventory_/u);
});

test("Step 20 workspace does not implement Step 21 operational reports", async () => {
  const page = await read("src/pages/purchase/purchase-documents-page.tsx");
  assert.doesNotMatch(page, /PurchaseOperationalReport|supplier-aging|purchase-analysis/u);
});

test("Purchase workspace follows display density tokens", async () => {
  const css = await read("src/pages/purchase/purchase-documents-page.css");
  for (const token of [
    "--ui-density-control-height",
    "--ui-density-row-height",
    "--ui-density-cell-x",
    "--ui-density-cell-y",
    "--ui-density-gap",
    "--ui-density-font-size",
  ]) assert.ok(css.includes(token), token);
});


test("Purchase workspace exposes linked return and correction document workflows", async () => {
  const [page, composition] = await Promise.all([
    read("src/pages/purchase/purchase-documents-page.tsx"),
    read("src/composition/purchase/create-purchase-workspace-services.ts"),
  ]);
  assert.match(page, /purchase-return/u);
  assert.match(page, /purchase-correction/u);
  assert.match(page, /سند اصلی/u);
  assert.match(page, /علت برگشت یا اصلاح/u);
  assert.match(composition, /correctionReference/u);
  assert.match(composition, /returnPurchase/u);
  assert.match(composition, /correct/u);
});


test("Phase 23 Step 27 supports invoice-to-receipt no-reentry and partial fulfillment UX", async () => {
  const [page, composition, migration] = await Promise.all([
    read("src/pages/purchase/purchase-documents-page.tsx"),
    read("src/composition/purchase/create-purchase-workspace-services.ts"),
    read("src-tauri/migrations/0034_purchase_partial_receipts.sql"),
  ]);

  assert.match(page, /ایجاد رسید انبار از فاکتور/u);
  assert.match(page, /ایجاد رسید برای باقیمانده/u);
  assert.match(page, /قبلاً تخصیص‌یافته/u);
  assert.match(page, /باقیمانده/u);
  assert.match(page, /receiptQuantities/u);
  assert.match(composition, /inventoryDocuments\.listBySource/u);
  assert.match(composition, /remainingBaseQuantity/u);
  assert.match(composition, /quantitiesByLine/u);
  assert.match(migration, /DROP INDEX IF EXISTS uq_inventory_documents_source/u);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS ix_inventory_documents_source/u);
  assert.doesNotMatch(page, /حساب بدهکار|حساب بستانکار/u);
});
