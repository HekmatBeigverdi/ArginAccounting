import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("inventory transfer center is routed and permission scoped", async () => {
  const [router, navigation, page] = await Promise.all([
    read("src/app/router/app-router.tsx"),
    read("src/app/navigation/navigation-items.ts"),
    read("src/pages/inventory/inventory-transfer-center-page.tsx"),
  ]);
  assert.match(router, /\/inventory\/transfer-center/u);
  assert.match(navigation, /inventory\.documents\.import/u);
  assert.match(navigation, /inventory\.documents\.export/u);
  assert.match(page, /canImport/u);
  assert.match(page, /canExport/u);
});

test("import requires preview validation and creates drafts without lifecycle bypass", async () => {
  const controller = await read("src/features/inventory/inventory-import-controller.ts");
  const page = await read("src/pages/inventory/inventory-transfer-center-page.tsx");
  assert.match(controller, /invalidRows > 0/u);
  assert.match(controller, /InventoryDraftImportService/u);
  assert.match(controller, /inventoryPermissions\.import/u);
  assert.doesNotMatch(controller, /secured\.confirm|\.approve\(/u);
  assert.match(page, /ایجاد پیش‌نویس‌ها/u);
  assert.match(page, /اعتبارسنجی روی کل فایل/u);
});

test("print preview is full-screen with bottom spacing and shared orientation", async () => {
  const source = await read("src/features/inventory/inventory-export-print.ts");
  assert.match(source, /height: "100dvh"/u);
  assert.match(source, /paddingBottom = "24mm"/u);
  assert.match(source, /@page\{size:A4 \$\{model\.orientation\}/u);
  assert.match(source, /چاپ \/ ذخیره PDF/u);
  assert.match(source, /globalThis\.print\(\)/u);
});

test("documents and quantity reports expose true xlsx and print models", async () => {
  const [page, print] = await Promise.all([
    read("src/pages/inventory/inventory-transfer-center-page.tsx"),
    read("src/features/inventory/inventory-export-print.ts"),
  ]);
  assert.match(page, /خلاصه موجودی کالا/u);
  assert.match(page, /موجودی تفکیکی/u);
  assert.match(page, /کاردکس تعدادی/u);
  assert.match(page, /سقف ۱۰٬۰۰۰ ردیف/u);
  assert.match(print, /createInventoryXlsx/u);
  assert.match(print, /orientation: "portrait"/u);
  assert.match(print, /orientation: "landscape"/u);
});
