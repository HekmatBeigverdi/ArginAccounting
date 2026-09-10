import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Inventory workspace is routed and permission-scoped in navigation", async () => {
  const [router, navigation] = await Promise.all([
    read("src/app/router/app-router.tsx"),
    read("src/app/navigation/navigation-items.ts"),
  ]);
  assert.match(router, /path="\/inventory\/documents"/u);
  assert.match(navigation, /inventory\.documents\.view/u);
  assert.match(navigation, /اسناد انبار/u);
});

test("Inventory workspace keeps Persian RTL presentation with Jalali UI dates and LTR quantities", async () => {
  const page = await read("src/pages/inventory/inventory-documents-page.tsx");
  assert.match(page, /dir="rtl"/u);
  assert.match(page, /fa-IR-u-ca-persian/u);
  assert.match(page, /jalaliToGregorian/u);
  assert.match(page, /input\s+required\s+dir="ltr"\s+inputMode="decimal"/u);
  assert.match(page, /enteredQuantity/u);
  assert.match(page, /baseQuantity/u);
});

test("Workspace lifecycle uses secured Application composition and reloads stale versions", async () => {
  const [page, composition] = await Promise.all([
    read("src/pages/inventory/inventory-documents-page.tsx"),
    read("src/composition/inventory/create-inventory-workspace-services.ts"),
  ]);
  assert.match(composition, /new SecuredInventoryService/u);
  assert.match(composition, /new InventoryDraftService/u);
  assert.match(composition, /generateDocumentNumber/u);
  assert.match(page, /inventory\.application\.concurrency-conflict/u);
  assert.match(page, /await openDocument\(selected\.documentId\)/u);
});

test("Inventory reversal uses an in-app required-reason dialog", async () => {
  const page = await read("src/pages/inventory/inventory-documents-page.tsx");
  assert.doesNotMatch(page, /window\.prompt/u);
  assert.match(page, /aria-labelledby="inventory-reverse-title"/u);
  assert.match(page, /void lifecycle\("reverse", reverseReason\)/u);
  assert.match(page, /disabled=\{saving \|\| !reverseReason\.trim\(\)\}/u);
});

test("Inventory adjustment confirmation collects the mandatory reason before calling the service", async () => {
  const page = await read("src/pages/inventory/inventory-documents-page.tsx");
  assert.match(page, /action === "confirm" && selected\.documentType === "adjustment" && !reason\?\.trim\(\)/u);
  assert.match(page, /setAdjustmentConfirmOpen\(true\);\s+return;/u);
  assert.match(page, /aria-labelledby="inventory-adjustment-confirm-title"/u);
  assert.match(page, /if \(adjustmentReason\.trim\(\)\) void lifecycle\("confirm", adjustmentReason\)/u);
  assert.match(page, /disabled=\{saving \|\| !adjustmentReason\.trim\(\)\}/u);
  assert.match(page, /await services\.confirm\(selected, reason\?\.trim\(\) \?\? null\)/u);
});

test("Inventory documents and quantity reports follow the selected display density", async () => {
  const [documentsCss, reportsCss] = await Promise.all([
    read("src/pages/inventory/inventory-documents-page.css"),
    read("src/pages/inventory/inventory-quantity-reports-page.css"),
  ]);
  for (const css of [documentsCss, reportsCss]) {
    assert.match(css, /--ui-density-control-height/u);
    assert.match(css, /--ui-density-row-height/u);
    assert.match(css, /--ui-density-cell-x/u);
    assert.match(css, /--ui-density-cell-y/u);
    assert.match(css, /--ui-density-gap/u);
    assert.match(css, /--ui-density-font-size/u);
  }
});

test("Step 16 workspace does not implement Step 17 Kardex or Step 18 export and print", async () => {
  const page = await read("src/pages/inventory/inventory-documents-page.tsx");
  assert.doesNotMatch(page, /readKardex|readBalances|xlsx|print\(|PDF/u);
});
