import assert from "node:assert/strict";
import test from "node:test";
import {
  INVENTORY_IMPORT_TEMPLATE_HEADERS,
  createInventoryImportTemplateXlsx,
  createInventoryXlsx,
  parseInventoryXlsx,
} from "../src/inventory-tabular-codec.ts";

test("inventory import template exposes stable Persian headers", () => {
  const parsed = parseInventoryXlsx(createInventoryImportTemplateXlsx());
  assert.deepEqual(parsed.headers, [...INVENTORY_IMPORT_TEMPLATE_HEADERS]);
});

test("xlsx export keeps exact decimal quantities as text", () => {
  const exact = "12345678901234567890.000000000000000001";
  const bytes = createInventoryXlsx([{ "کد کالا": "P-1", "موجودی": exact }], "Inventory");
  const parsed = parseInventoryXlsx(bytes);
  assert.equal(parsed.rows[0]?.["موجودی"], exact);
});

test("xlsx parser ignores blank rows and preserves Persian text", () => {
  const bytes = createInventoryXlsx([{ "کلید سند": "DOC-1", "شرح سند": "رسید خرید" }], "Import");
  const parsed = parseInventoryXlsx(bytes);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.["شرح سند"], "رسید خرید");
});
