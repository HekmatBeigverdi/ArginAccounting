import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchaseCommercialTerms,
  normalizePurchaseQuantity,
} from "../src/domain/purchase-commercial-semantics.ts";
import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "../src/domain/purchase-domain-errors.ts";

function assertDomainError(
  action: () => unknown,
  code: string,
  field: string,
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

const enteredUnit = {
  unitId: "box",
  code: "box",
  title: "Box",
  ratioToBase: "12",
  precision: 2,
  roundingMode: "half-up" as const,
  taxpayerUnitCode: "1624",
};
const baseUnit = {
  unitId: "piece",
  code: "PCS",
  title: "Piece",
  ratioToBase: "1",
  precision: 0,
  roundingMode: "half-up" as const,
  taxpayerUnitCode: "1621",
};

test("normalizes exact quantity and converts to base quantity without floating point", () => {
  assert.equal(normalizePurchaseQuantity("001.2500"), "1.25");
  const terms = createPurchaseCommercialTerms({
    enteredQuantity: "2.5",
    enteredUnit,
    baseUnit,
    unitPrice: { amount: 150_000, currency: "irr" },
    discounts: [],
    charges: [],
    tax: { treatment: "taxable", rateBasisPoints: 1000 },
  });
  assert.equal(terms.quantity.enteredQuantity, "2.5");
  assert.equal(terms.quantity.baseQuantity, "30");
  assert.equal(terms.unitPrice.currency, "IRR");
});

test("rejects zero, negative and over-precision quantities", () => {
  for (const quantity of ["0", "-1"]) {
    assertDomainError(
      () => createPurchaseCommercialTerms({
        enteredQuantity: quantity,
        enteredUnit,
        baseUnit,
        unitPrice: { amount: 1, currency: "IRR" },
        discounts: [], charges: [],
        tax: { treatment: "exempt", rateBasisPoints: null },
      }),
      PURCHASE_DOMAIN_ERROR_CODES.quantityInvalid,
      "commercialTerms.enteredQuantity",
    );
  }
  assertDomainError(
    () => createPurchaseCommercialTerms({
      enteredQuantity: "1.234",
      enteredUnit,
      baseUnit,
      unitPrice: { amount: 1, currency: "IRR" },
      discounts: [], charges: [],
      tax: { treatment: "exempt", rateBasisPoints: null },
    }),
    PURCHASE_DOMAIN_ERROR_CODES.quantityPrecisionInvalid,
    "commercialTerms.enteredQuantity",
  );
});

test("requires safe-integer money and one currency per commercial term set", () => {
  assertDomainError(
    () => createPurchaseCommercialTerms({
      enteredQuantity: "1",
      enteredUnit: baseUnit,
      baseUnit,
      unitPrice: { amount: 1.5, currency: "IRR" },
      discounts: [], charges: [],
      tax: { treatment: "exempt", rateBasisPoints: null },
    }),
    PURCHASE_DOMAIN_ERROR_CODES.moneyInvalid,
    "commercialTerms.unitPrice.amount",
  );
  assertDomainError(
    () => createPurchaseCommercialTerms({
      enteredQuantity: "1",
      enteredUnit: baseUnit,
      baseUnit,
      unitPrice: { amount: 100, currency: "IRR" },
      discounts: [{ kind: "fixed", amount: { amount: 10, currency: "USD" } }],
      charges: [],
      tax: { treatment: "exempt", rateBasisPoints: null },
    }),
    PURCHASE_DOMAIN_ERROR_CODES.currencyMismatch,
    "commercialTerms.discounts[0].amount.currency",
  );
});

test("normalizes adjustments and validates tax semantics", () => {
  const terms = createPurchaseCommercialTerms({
    enteredQuantity: "3",
    enteredUnit: baseUnit,
    baseUnit,
    unitPrice: { amount: 100_000, currency: "IRR" },
    discounts: [{ kind: "percentage", rateBasisPoints: 750 }],
    charges: [{ kind: "fixed", amount: { amount: 2_500, currency: "IRR" } }],
    tax: { treatment: "taxable", rateBasisPoints: 1000 },
  });
  assert.deepEqual(terms.discounts[0], { kind: "percentage", rateBasisPoints: 750 });
  assert.deepEqual(terms.charges[0], { kind: "fixed", amount: { amount: 2500, currency: "IRR" } });
  assert.deepEqual(terms.tax, { treatment: "taxable", rateBasisPoints: 1000 });
  assert.equal(terms.moneyRoundingMode, "half-away-from-zero");

  assertDomainError(
    () => createPurchaseCommercialTerms({
      enteredQuantity: "1",
      enteredUnit: baseUnit,
      baseUnit,
      unitPrice: { amount: 1, currency: "IRR" },
      discounts: [], charges: [],
      tax: { treatment: "exempt", rateBasisPoints: 1000 },
    }),
    PURCHASE_DOMAIN_ERROR_CODES.taxSemanticsInvalid,
    "commercialTerms.tax.rateBasisPoints",
  );
});
