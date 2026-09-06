import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative: string) => readFile(new URL(relative, import.meta.url), "utf8");

test("Warehouse management preserves Persian RTL, explicit LTR identifiers and Persian calendar presentation", async () => {
  const page = await read("../src/pages/warehouse/warehouses-page.tsx");
  assert.match(page, /lang="fa" dir="rtl"/u);
  assert.match(page, /dir="ltr"/u);
  assert.match(page, /fa-IR-u-ca-persian/u);
});

test("Warehouse list and selector retain focus and keyboard accessibility semantics", async () => {
  const [page, pageCss, selector, selectorCss] = await Promise.all([
    read("../src/pages/warehouse/warehouses-page.tsx"),
    read("../src/pages/warehouse/warehouses-page.css"),
    read("../src/components/warehouse/warehouse-selector.tsx"),
    read("../src/components/warehouse/warehouse-selector.css"),
  ]);

  assert.match(page, /tabIndex=\{0\}/u);
  assert.match(pageCss, /tbody tr:focus-visible/u);
  assert.match(selector, /role="combobox"/u);
  assert.match(selector, /role="listbox"/u);
  assert.match(selector, /role="option"/u);
  assert.match(selector, /aria-activedescendant/u);
  assert.match(selector, /event\.key === "ArrowDown"/u);
  assert.match(selector, /event\.key === "ArrowUp"/u);
  assert.match(selector, /event\.key === "Enter"/u);
  assert.match(selector, /event\.key === "Escape"/u);
  assert.match(selector, /<bdi dir="ltr">/u);
  assert.match(selectorCss, /:focus/u);
  assert.match(selectorCss, /outline:/u);
});

test("Warehouse workspace keeps Phase 14 dense and locally scrollable layout", async () => {
  const css = await read("../src/pages/warehouse/warehouses-page.css");
  assert.match(css, /height: 32px/u);
  assert.match(css, /min-height: 30px/u);
  assert.match(css, /font-size: \.78rem/u);
  assert.match(css, /\.warehouse-table-wrap[\s\S]*overflow: auto/u);
  assert.match(css, /\.warehouse-detail-panel[\s\S]*overflow: auto/u);
  assert.match(css, /position: sticky/u);
});

test("Warehouse workspace defines responsive collapse instead of global horizontal scrolling", async () => {
  const css = await read("../src/pages/warehouse/warehouses-page.css");
  assert.match(css, /@media \(max-width: 1050px\)/u);
  assert.match(css, /\.warehouse-workspace \{ grid-template-columns: 1fr; \}/u);
  assert.match(css, /@media \(max-width: 760px\)/u);
  assert.match(css, /\.warehouse-form-grid \{ grid-template-columns: 1fr; \}/u);
  assert.match(css, /\.warehouse-meta-grid \{ grid-template-columns: 1fr; \}/u);
});

test("Warehouse management keeps explicit loading, empty, error and confirmation feedback contracts", async () => {
  const page = await read("../src/pages/warehouse/warehouses-page.tsx");
  const confirmation = await read("../src/pages/warehouse/warehouse-confirmation-dialog.tsx");

  assert.match(page, /setLoading\(true\)/u);
  assert.match(page, /setLoading\(false\)/u);
  assert.match(page, /setError\(/u);
  assert.match(page, /setMessage\(/u);
  assert.match(page, /items\.length === 0/u);
  assert.match(confirmation, /<dialog/u);
  assert.match(confirmation, /role="alertdialog"/u);
  assert.match(confirmation, /aria-modal="true"/u);
  assert.match(confirmation, /aria-labelledby/u);
  assert.match(confirmation, /aria-describedby/u);
  assert.match(confirmation, /showModal\(\)/u);
  assert.match(confirmation, /previouslyFocused\.focus\(\)/u);
  assert.match(confirmation, /onCancel=/u);
});

test("Warehouse selector remains bounded and race-safe for future ERP forms", async () => {
  const selector = await read("../src/components/warehouse/warehouse-selector.tsx");
  assert.match(selector, /limit = 20/u);
  assert.match(selector, /useDeferredValue/u);
  assert.match(selector, /const requestId = useRef\(0\)/u);
  assert.match(selector, /requestId\.current !== currentRequest/u);
  assert.match(selector, /buildWarehouseSelectorQuery/u);
});
