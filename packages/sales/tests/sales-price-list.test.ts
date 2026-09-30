import assert from "node:assert/strict";
import test from "node:test";
import {
  SALES_PRICE_LIST_KINDS,
  SalesDomainError,
  createSalesPriceList,
} from "../src/index.ts";

test("exposes extensible Phase 24 price-list kinds", () => {
  assert.deepEqual(SALES_PRICE_LIST_KINDS, ["base", "wholesale", "customer", "segment"]);
});

test("creates a company-scoped price list with durable product references", () => {
  const list = createSalesPriceList({
    priceListId: "pl-base-1",
    companyId: "company-1",
    code: "BASE-1405",
    name: "Base Sales Price",
    kind: "base",
    items: [
      { priceListItemId: "pli-1", productId: "product-1", unitPrice: 145000000 },
      { priceListItemId: "pli-2", productId: "service-1", unitPrice: 25000000 },
    ],
  });
  assert.equal(list.priceListId, "pl-base-1");
  assert.equal(list.companyId, "company-1");
  assert.equal(list.items[0]?.productId, "product-1");
  assert.equal(list.items[0]?.unitPrice, 145000000);
  assert.equal(list.isActive, true);
});

test("rejects duplicate durable item identities and duplicate products in one list", () => {
  const base = { priceListId: "pl", companyId: "c", code: "BASE", name: "Base", kind: "base" as const };
  assert.throws(() => createSalesPriceList({ ...base, items: [
    { priceListItemId: "i", productId: "p1", unitPrice: 100 },
    { priceListItemId: "i", productId: "p2", unitPrice: 200 },
  ]}), (error: unknown) => error instanceof SalesDomainError && error.code === "sales.duplicate_price_list_item_id");
  assert.throws(() => createSalesPriceList({ ...base, items: [
    { priceListItemId: "i1", productId: "p", unitPrice: 100 },
    { priceListItemId: "i2", productId: "p", unitPrice: 200 },
  ]}), (error: unknown) => error instanceof SalesDomainError && error.code === "sales.duplicate_price_list_product");
});

test("rejects invalid selling prices", () => {
  assert.throws(() => createSalesPriceList({
    priceListId: "pl", companyId: "c", code: "BASE", name: "Base", kind: "base",
    items: [{ priceListItemId: "i", productId: "p", unitPrice: -1 }],
  }), (error: unknown) => error instanceof SalesDomainError && error.code === "sales.price_invalid");
});

test("keeps selling price separate from inventory valuation and accounting state", () => {
  const list = createSalesPriceList({
    priceListId: "pl", companyId: "c", code: "BASE", name: "Base", kind: "base",
    items: [{ priceListItemId: "i", productId: "p", unitPrice: 1000 }],
  });
  assert.equal("inventoryCost" in list.items[0]!, false);
  assert.equal("cogs" in list.items[0]!, false);
  assert.equal("journalVoucherId" in list, false);
  assert.equal("effectiveFrom" in list, false);
  assert.equal("currency" in list, false);
});
