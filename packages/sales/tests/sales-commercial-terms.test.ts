import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesDomainError,
  createSalesCommercialTerms,
  createSalesCommercialTermsFromResolvedPrice,
  createSalesDocumentLine,
} from "../src/index.ts";

test("creates manual sales commercial terms without fake price-list lineage", () => {
  const terms = createSalesCommercialTerms({ quantity: 2.5, currency: "irr", unitPrice: 1000, priceOrigin: "manual" });
  assert.equal(terms.quantity, 2.5);
  assert.equal(terms.currency, "IRR");
  assert.equal(terms.unitPrice, 1000);
  assert.equal(terms.priceListId, null);
  assert.equal(terms.priceRevisionId, null);
});

test("captures full price-list lineage from a resolved selling price", () => {
  const terms = createSalesCommercialTermsFromResolvedPrice(3, {
    priceListId: "pl", priceListItemId: "pli", priceRevisionId: "rev", revision: 2,
    kind: "customer", productId: "p", currency: "IRR", unitPrice: 1200,
    effectiveFrom: "2026-07-01", effectiveTo: null,
  });
  assert.deepEqual(terms, {
    quantity: 3, currency: "IRR", unitPrice: 1200, priceOrigin: "price-list",
    priceListId: "pl", priceListItemId: "pli", priceRevisionId: "rev", priceRevision: 2,
  });
});

test("rejects invalid quantity and inconsistent price origin metadata", () => {
  assert.throws(() => createSalesCommercialTerms({ quantity: 0, currency: "IRR", unitPrice: 1, priceOrigin: "manual" }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.quantity_invalid");
  assert.throws(() => createSalesCommercialTerms({ quantity: 1, currency: "IRR", unitPrice: 1, priceOrigin: "price-list" }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.price_origin_invalid");
  assert.throws(() => createSalesCommercialTerms({ quantity: 1, currency: "IRR", unitPrice: 1, priceOrigin: "manual", priceListId: "fake" }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.price_origin_invalid");
});

test("attaches immutable commercial facts to a sales document line without inventory cost", () => {
  const line = createSalesDocumentLine({
    lineId: "line-1", position: 1, lineKind: "stock-product", productId: "p",
    commercialTerms: { quantity: 2, currency: "IRR", unitPrice: 5000, priceOrigin: "manual" },
  });
  assert.equal(line.commercialTerms?.quantity, 2);
  assert.equal(line.commercialTerms?.unitPrice, 5000);
  assert.equal("inventoryCost" in line.commercialTerms!, false);
  assert.equal("cogs" in line.commercialTerms!, false);
  assert.equal("discount" in line.commercialTerms!, false);
  assert.equal("tax" in line.commercialTerms!, false);
});
