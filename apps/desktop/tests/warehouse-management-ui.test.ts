import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/pages/warehouse/warehouses-page.tsx", import.meta.url);
const cssPath = new URL("../src/pages/warehouse/warehouses-page.css", import.meta.url);
const routerPath = new URL("../src/app/router/app-router.tsx", import.meta.url);
const navigationPath = new URL("../src/app/navigation/navigation-items.ts", import.meta.url);

test("warehouse management page preserves Persian RTL and explicit LTR identifiers", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /<Page className="warehouses-page" lang="fa" dir="rtl">/u);
  assert.match(source, /dir="ltr"/u);
  assert.match(source, /انبارها و ساختار فیزیکی/u);
  assert.match(source, /ناحیه‌ها/u);
  assert.match(source, /موقعیت‌ها/u);
});

test("warehouse management UI is registered behind warehouse view permission", async () => {
  const [router, navigation] = await Promise.all([
    readFile(routerPath, "utf8"),
    readFile(navigationPath, "utf8"),
  ]);

  assert.match(router, /path="\/inventory\/warehouses" element={<WarehousesPage \/>}/u);
  assert.match(navigation, /requiredPermission: "inventory\.warehouses\.view"/u);
});

test("warehouse workspace retains dense desktop layout tokens", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /grid-template-columns: minmax\(520px, 1\.55fr\) minmax\(340px, \.9fr\)/u);
  assert.match(css, /height: 32px/u);
  assert.match(css, /overflow: auto/u);
});
