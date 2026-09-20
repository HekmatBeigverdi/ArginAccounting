import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  calculatePurchaseDocumentTotals,
  calculatePurchaseLineTotals,
} from "../src/index.ts";

const baseTerms = {
  quantity: {
    enteredQuantity: "2.5",
    baseQuantity: "2.5",
    enteredUnit: { unitId: "piece", code: "PCS", title: "Piece", ratioToBase: "1", precision: 2, roundingMode: "half-up" as const, taxpayerUnitCode: "1621" },
    baseUnit: { unitId: "piece", code: "PCS", title: "Piece", ratioToBase: "1", precision: 2, roundingMode: "half-up" as const, taxpayerUnitCode: "1621" },
  },
  unitPrice: { amount: 100, currency: "IRR" },
  discounts: [{ kind: "percentage", rateBasisPoints: 1000 }] as const,
  charges: [{ kind: "fixed", amount: { amount: 20, currency: "IRR" } }] as const,
  tax: { treatment: "taxable", rateBasisPoints: 1000 } as const,
  moneyRoundingMode: "half-away-from-zero" as const,
};

function assertDomainError(action: () => unknown, code: string, field: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("calculates deterministic Purchase line totals", () => {
  assert.deepEqual(calculatePurchaseLineTotals(baseTerms), {
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

test("applies ordered percentage discounts sequentially", () => {
  const totals = calculatePurchaseLineTotals({
    ...baseTerms,
    quantity: { ...baseTerms.quantity, enteredQuantity: "1", baseQuantity: "1" },
    unitPrice: { amount: 1000, currency: "IRR" },
    discounts: [
      { kind: "percentage", rateBasisPoints: 1000 },
      { kind: "percentage", rateBasisPoints: 1000 },
    ],
    charges: [],
    tax: { treatment: "exempt", rateBasisPoints: null },
  });
  assert.equal(totals.discountAmount, 190);
  assert.equal(totals.grandTotal, 810);
});

test("rejects a discount that would make the line negative", () => {
  assertDomainError(
    () => calculatePurchaseLineTotals({
      ...baseTerms,
      quantity: { ...baseTerms.quantity, enteredQuantity: "1", baseQuantity: "1" },
      unitPrice: { amount: 100, currency: "IRR" },
      discounts: [{ kind: "fixed", amount: { amount: 101, currency: "IRR" } }],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.pricingInvalid,
    "discounts[0]",
  );
});

test("aggregates same-currency line totals and rejects mixed currencies", () => {
  const first = calculatePurchaseLineTotals(baseTerms);
  const second = calculatePurchaseLineTotals({
    ...baseTerms,
    quantity: { ...baseTerms.quantity, enteredQuantity: "1", baseQuantity: "1" },
  });
  assert.equal(calculatePurchaseDocumentTotals([first, second]).grandTotal, 391);
  assertDomainError(
    () => calculatePurchaseDocumentTotals([first, { ...second, currency: "USD" }]),
    PURCHASE_DOMAIN_ERROR_CODES.currencyMismatch,
    "lines[1].currency",
  );
});
