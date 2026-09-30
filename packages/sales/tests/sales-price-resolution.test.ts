import assert from "node:assert/strict";
import test from "node:test";
import {
  SALES_PRICE_LIST_RESOLUTION_PRIORITY,
  SalesDomainError,
  createSalesPriceList,
  resolveSalesPriceList,
} from "../src/index.ts";

const list = (id: string, kind: "base" | "wholesale" | "customer" | "segment", price: number, active = true) =>
  createSalesPriceList({
    priceListId: id, companyId: "company-1", code: id.toUpperCase(), name: id, kind, isActive: active,
    items: [{ priceListItemId: `${id}-item`, productId: "product-1", revisions: [{ priceRevisionId: `${id}-r1`, revision: 1, currency: "IRR", unitPrice: price, effectiveFrom: "2026-01-01" }] }],
  });

test("freezes deterministic price-list priority", () => {
  assert.deepEqual(SALES_PRICE_LIST_RESOLUTION_PRIORITY, ["customer", "segment", "wholesale", "base"]);
});

test("resolves the highest-priority eligible list regardless of input order", () => {
  const base = list("base", "base", 100);
  const wholesale = list("wholesale", "wholesale", 90);
  const customer = list("customer", "customer", 80);
  const resolved = resolveSalesPriceList("company-1", "product-1", [
    { priceList: base, eligible: true },
    { priceList: customer, eligible: true },
    { priceList: wholesale, eligible: true },
  ]);
  assert.equal(resolved?.priceListId, "customer");
  assert.equal(resolved?.unitPrice, 80);
});

test("skips ineligible and inactive higher-priority lists", () => {
  const customer = list("customer", "customer", 80);
  const segment = list("segment", "segment", 85, false);
  const base = list("base", "base", 100);
  const resolved = resolveSalesPriceList("company-1", "product-1", [
    { priceList: customer, eligible: false },
    { priceList: segment, eligible: true },
    { priceList: base, eligible: true },
  ]);
  assert.equal(resolved?.priceListId, "base");
});

test("falls through when a higher-priority list has no requested product", () => {
  const customer = createSalesPriceList({
    priceListId: "customer", companyId: "company-1", code: "C", name: "Customer", kind: "customer",
    items: [{ priceListItemId: "other", productId: "product-2", revisions: [{ priceRevisionId: "other-r1", revision: 1, currency: "IRR", unitPrice: 50, effectiveFrom: "2026-01-01" }] }],
  });
  const base = list("base", "base", 100);
  assert.equal(resolveSalesPriceList("company-1", "product-1", [
    { priceList: customer, eligible: true }, { priceList: base, eligible: true },
  ])?.priceListId, "base");
});

test("returns null when no eligible list contains the product", () => {
  assert.equal(resolveSalesPriceList("company-1", "missing", [
    { priceList: list("base", "base", 100), eligible: true },
  ]), null);
});

test("rejects ambiguous matches at the same priority instead of depending on candidate order", () => {
  assert.throws(() => resolveSalesPriceList("company-1", "product-1", [
    { priceList: list("base-a", "base", 100), eligible: true },
    { priceList: list("base-b", "base", 110), eligible: true },
  ]), (error: unknown) => error instanceof SalesDomainError && error.code === "sales.price_resolution_ambiguous");
});

test("rejects cross-company candidates", () => {
  const foreign = createSalesPriceList({
    priceListId: "foreign", companyId: "company-2", code: "F", name: "Foreign", kind: "base",
    items: [{ priceListItemId: "i", productId: "product-1", revisions: [{ priceRevisionId: "r1", revision: 1, currency: "IRR", unitPrice: 100, effectiveFrom: "2026-01-01" }] }],
  });
  assert.throws(() => resolveSalesPriceList("company-1", "product-1", [{ priceList: foreign, eligible: true }]),
    (error: unknown) => error instanceof SalesDomainError && error.code === "sales.scope_mismatch");
});
