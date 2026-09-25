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
    "کنترل تطبیق",
    "نمایش مسیر ردیابی",
    "ردیف‌های سند حسابداری",
    "هنوز ثبت حسابداری ایجاد نشده است",
  ]) {
    assert.match(panel, new RegExp(text, "u"));
  }

  assert.doesNotMatch(panel, /unitPrice|discountAmount|chargeAmount|taxAmount\s*:/u);
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
