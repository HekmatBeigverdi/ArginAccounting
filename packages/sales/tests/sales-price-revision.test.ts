import assert from "node:assert/strict";
import test from "node:test";
import { SalesDomainError, createSalesPriceList, createSalesPriceRevision, resolveSalesPriceList } from "../src/index.ts";

test("normalizes ISO currency and creates immutable effective-dated revision", () => {
  const revision = createSalesPriceRevision({
    priceRevisionId: "rev-1", revision: 1, currency: "irr", unitPrice: 1000, effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30",
  });
  assert.equal(revision.currency, "IRR");
  assert.equal(revision.effectiveFrom, "2026-01-01");
  assert.equal(revision.effectiveTo, "2026-06-30");
});

test("preserves old price history and resolves the revision effective on business date", () => {
  const priceList = createSalesPriceList({
    priceListId: "base", companyId: "c", code: "BASE", name: "Base", kind: "base",
    items: [{ priceListItemId: "item", productId: "p", revisions: [
      { priceRevisionId: "old", revision: 1, currency: "IRR", unitPrice: 1000, effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30" },
      { priceRevisionId: "new", revision: 2, currency: "IRR", unitPrice: 1200, effectiveFrom: "2026-07-01" },
    ] }],
  });
  const candidates = [{ priceList, eligible: true }] as const;
  const oldPrice = resolveSalesPriceList("c", "p", candidates, "2026-05-01", "IRR");
  const newPrice = resolveSalesPriceList("c", "p", candidates, "2026-09-30", "IRR");
  assert.equal(oldPrice?.priceRevisionId, "old");
  assert.equal(oldPrice?.unitPrice, 1000);
  assert.equal(newPrice?.priceRevisionId, "new");
  assert.equal(newPrice?.revision, 2);
  assert.equal(newPrice?.unitPrice, 1200);
});

test("resolves only the requested currency", () => {
  const priceList = createSalesPriceList({
    priceListId: "base", companyId: "c", code: "BASE", name: "Base", kind: "base",
    items: [{ priceListItemId: "item", productId: "p", revisions: [
      { priceRevisionId: "irr", revision: 1, currency: "IRR", unitPrice: 1000, effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30" },
      { priceRevisionId: "usd", revision: 2, currency: "USD", unitPrice: 10, effectiveFrom: "2026-07-01" },
    ] }],
  });
  assert.equal(resolveSalesPriceList("c", "p", [{ priceList, eligible: true }], "2026-09-30", "USD")?.unitPrice, 10);
  assert.equal(resolveSalesPriceList("c", "p", [{ priceList, eligible: true }], "2026-09-30", "IRR"), null);
});

test("rejects overlapping revision windows and duplicate revision identities", () => {
  const base = { priceListId: "base", companyId: "c", code: "BASE", name: "Base", kind: "base" as const };
  assert.throws(() => createSalesPriceList({ ...base, items: [{ priceListItemId: "item", productId: "p", revisions: [
    { priceRevisionId: "r1", revision: 1, currency: "IRR", unitPrice: 100, effectiveFrom: "2026-01-01" },
    { priceRevisionId: "r2", revision: 2, currency: "IRR", unitPrice: 110, effectiveFrom: "2026-02-01" },
  ] }] }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.price_revision_overlap");
  assert.throws(() => createSalesPriceList({ ...base, items: [{ priceListItemId: "item", productId: "p", revisions: [
    { priceRevisionId: "same", revision: 1, currency: "IRR", unitPrice: 100, effectiveFrom: "2026-01-01", effectiveTo: "2026-01-31" },
    { priceRevisionId: "same", revision: 2, currency: "IRR", unitPrice: 110, effectiveFrom: "2026-02-01" },
  ] }] }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.duplicate_price_revision");
});

test("rejects invalid currency, dates and revision numbers", () => {
  assert.throws(() => createSalesPriceRevision({ priceRevisionId: "r", revision: 0, currency: "IRR", unitPrice: 1, effectiveFrom: "2026-01-01" }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.price_revision_invalid");
  assert.throws(() => createSalesPriceRevision({ priceRevisionId: "r", revision: 1, currency: "RIAL", unitPrice: 1, effectiveFrom: "2026-01-01" }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.price_currency_invalid");
  assert.throws(() => createSalesPriceRevision({ priceRevisionId: "r", revision: 1, currency: "IRR", unitPrice: 1, effectiveFrom: "bad-date" }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.price_effective_date_invalid");
});
