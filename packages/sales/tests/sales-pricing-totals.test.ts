import assert from "node:assert/strict";
import test from "node:test";
import {
  SALES_MONEY_ROUNDING_MODE,
  SalesDomainError,
  calculateSalesDocumentTotals,
  calculateSalesLineTotals,
  createSalesCommercialTerms,
} from "../src/index.ts";

const terms = (overrides: Partial<Parameters<typeof createSalesCommercialTerms>[0]> = {}) => createSalesCommercialTerms({
  quantity: 2.5, currency: "IRR", unitPrice: 100, priceOrigin: "manual",
  discounts: [{ id: "d", mode: "percent", value: 1000 }],
  charges: [{ id: "c", mode: "amount", value: 20 }],
  taxes: [{ taxId: "vat", rateBasisPoints: 1000 }],
  ...overrides,
});

test("uses the fixed half-away-from-zero money rounding policy", () => {
  assert.equal(SALES_MONEY_ROUNDING_MODE, "half-away-from-zero");
});

test("calculates gross discount net charge tax base tax and grand total deterministically", () => {
  assert.deepEqual(calculateSalesLineTotals(terms()), {
    currency: "IRR",
    grossAmount: 250,
    discountAmount: 25,
    netAfterDiscount: 225,
    chargeAmount: 20,
    taxBaseAmount: 245,
    taxAmount: 25,
    grandTotal: 270,
  });
});

test("rounds quantity multiplication and basis-point results half away from zero", () => {
  const result = calculateSalesLineTotals(terms({
    quantity: 2.5, unitPrice: 1,
    discounts: [], charges: [], taxes: [],
  }));
  assert.equal(result.grossAmount, 3);
  const tax = calculateSalesLineTotals(terms({
    quantity: 1, unitPrice: 5, discounts: [], charges: [],
    taxes: [{ taxId: "half", rateBasisPoints: 1000 }],
  }));
  assert.equal(tax.taxAmount, 1);
});

test("applies ordered discounts and charges against the current amount", () => {
  const result = calculateSalesLineTotals(terms({
    quantity: 1, unitPrice: 1000,
    discounts: [{ id: "d1", mode: "percent", value: 1000 }, { id: "d2", mode: "percent", value: 1000 }],
    charges: [{ id: "c1", mode: "percent", value: 1000 }],
    taxes: [],
  }));
  assert.equal(result.discountAmount, 190);
  assert.equal(result.netAfterDiscount, 810);
  assert.equal(result.chargeAmount, 81);
  assert.equal(result.grandTotal, 891);
});

test("rejects a discount that exceeds the current amount", () => {
  assert.throws(() => calculateSalesLineTotals(terms({
    quantity: 1, unitPrice: 100, discounts: [{ id: "d", mode: "amount", value: 101 }], charges: [], taxes: [],
  })), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.pricing_calculation_invalid");
});

test("aggregates line totals and rejects mixed document currencies", () => {
  const first = calculateSalesLineTotals(terms());
  const second = calculateSalesLineTotals(terms({ quantity: 1 }));
  const total = calculateSalesDocumentTotals([first, second]);
  assert.equal(total.lineCount, 2);
  assert.equal(total.grandTotal, first.grandTotal + second.grandTotal);
  const usd = calculateSalesLineTotals(terms({ currency: "USD" }));
  assert.throws(() => calculateSalesDocumentTotals([first, usd]),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.currency_mismatch");
});
