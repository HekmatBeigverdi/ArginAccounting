import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const componentPath = path.join(root, "src/components/warehouse/warehouse-selector.tsx");
const cssPath = path.join(root, "src/components/warehouse/warehouse-selector.css");

const component = fs.readFileSync(componentPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

test("warehouse selector consumes the shared future-consumer contract", () => {
  assert.match(component, /buildWarehouseSelectorQuery/u);
  assert.match(component, /toWarehouseSelectionReference/u);
  assert.match(component, /consumer: WarehouseSelectorConsumer/u);
  assert.match(component, /branchId\?: string \| null/u);
});

test("warehouse selector is accessible RTL and keeps codes LTR", () => {
  assert.match(component, /role="combobox"/u);
  assert.match(component, /role="listbox"/u);
  assert.match(component, /dir="rtl"/u);
  assert.match(component, /<bdi dir="ltr">\{option\.code\}<\/bdi>/u);
});

test("warehouse selector preserves dense desktop sizing", () => {
  assert.match(css, /min-height: 32px/u);
  assert.match(css, /max-height: 260px/u);
});
