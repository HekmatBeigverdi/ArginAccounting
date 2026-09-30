import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesDomainError,
  createSalesCharge,
  createSalesCommercialTerms,
  createSalesDiscount,
  createSalesTax,
} from "../src/index.ts";

test("creates amount and basis-point percentage discounts and charges", () => {
  assert.deepEqual(createSalesDiscount({ id: "d1", mode: "percent", value: 750, reason: "Campaign" }), {
    discountId: "d1", mode: "percent", value: 750, reason: "Campaign",
  });
  assert.deepEqual(createSalesCharge({ id: "c1", mode: "amount", value: 20000 }), {
    chargeId: "c1", mode: "amount", value: 20000, reason: null,
  });
});

test("creates sales tax input as basis points without calculating tax amount", () => {
  const tax = createSalesTax({ taxId: "vat", rateBasisPoints: 1000, taxCode: "VAT" });
  assert.deepEqual(tax, { taxId: "vat", rateBasisPoints: 1000, taxCode: "VAT" });
  assert.equal("taxAmount" in tax, false);
  assert.equal("taxBase" in tax, false);
});

test("attaches immutable discounts charges and taxes to commercial terms", () => {
  const terms = createSalesCommercialTerms({
    quantity: 2.5, currency: "IRR", unitPrice: 100000, priceOrigin: "manual",
    discounts: [{ id: "d", mode: "percent", value: 1000 }],
    charges: [{ id: "c", mode: "amount", value: 20000 }],
    taxes: [{ taxId: "vat", rateBasisPoints: 1000 }],
  });
  assert.equal(terms.discounts[0]?.value, 1000);
  assert.equal(terms.charges[0]?.value, 20000);
  assert.equal(terms.taxes[0]?.rateBasisPoints, 1000);
  assert.equal("grandTotal" in terms, false);
  assert.equal("taxAmount" in terms, false);
});

test("rejects invalid percentages tax rates and duplicate adjustment identities", () => {
  assert.throws(() => createSalesDiscount({ id: "d", mode: "percent", value: 10001 }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.adjustment_value_invalid");
  assert.throws(() => createSalesTax({ taxId: "vat", rateBasisPoints: -1 }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.tax_rate_invalid");
  assert.throws(() => createSalesCommercialTerms({
    quantity: 1, currency: "IRR", unitPrice: 100, priceOrigin: "manual",
    discounts: [{ id: "same", mode: "amount", value: 1 }],
    charges: [{ id: "same", mode: "amount", value: 1 }],
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.duplicate_commercial_adjustment_id");
});
