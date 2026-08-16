import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/pages/accounting/journal-vouchers-page.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/pages/accounting/journal-vouchers-page.css", import.meta.url),
  "utf8",
);

test("journal workspace keeps document information and a real journal entry table", () => {
  assert.match(page, /اطلاعات سند/u);
  assert.match(page, /className="journal-entry-table"/u);
  assert.match(page, /حساب معین/u);
  assert.match(page, /شرح/u);
  assert.match(page, /بدهکار \(ریال\)/u);
  assert.match(page, /بستانکار \(ریال\)/u);
});

test("journal entry table renders accounting dimensions as dynamic columns", () => {
  assert.match(page, /dimensionColumns\.map/u);
  assert.match(page, /column\.dimensionTypeId/u);
  assert.match(page, /column\.label/u);
  assert.match(page, /AccountingDimensionSelectorField/u);
});

test("journal workspace shows live totals and balance state", () => {
  assert.match(page, /جمع بدهکار/u);
  assert.match(page, /جمع بستانکار/u);
  assert.match(page, /مانده/u);
  assert.match(page, /سند تراز است|سند تراز نیست/u);
});

test("journal table owns horizontal overflow instead of expanding the desktop shell", () => {
  assert.match(styles, /\.journal-entry-table-wrap\s*\{[^}]*overflow-x:\s*auto/su);
  assert.match(styles, /\.journal-workspace\s*\{[^}]*min-width:\s*0/su);
  assert.match(styles, /\.journal-entry-table\s*\{[^}]*min-width:/su);
});

test("journal form controls are width-contained to prevent intrinsic overflow", () => {
  assert.match(styles, /\.journal-searchbar input,[\s\S]*?\.journal-entry-table select\s*\{[^}]*width:\s*100%/u);
  assert.match(styles, /\.journal-searchbar input,[\s\S]*?\.journal-entry-table select\s*\{[^}]*min-width:\s*0/u);
  assert.match(styles, /\.journal-layout > \*,[\s\S]*?\.journal-lines-card\s*\{[^}]*min-width:\s*0/u);
});
