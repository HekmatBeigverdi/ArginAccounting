import assert from "node:assert/strict";
import test from "node:test";

import {
  PurchaseDomainError,
  calculatePurchaseLineTotals,
  createPurchaseCommercialTerms,
  createPurchaseCorrectionWorkflowPlan,
  createPurchaseReturnWorkflowPlan,
} from "../src/index.ts";

const original = {
  documentId: "invoice-001",
  documentType: "supplier-invoice",
  status: "confirmed",
  companyId: "company-001",
  supplierId: "supplier-001",
};

const correction = {
  documentId: "correction-001",
  documentType: "purchase-correction",
  status: "confirmed",
  companyId: "company-001",
  supplierId: "supplier-001",
  correctionReference: {
    documentId: "invoice-001",
    reason: "Correction",
  },
};

const returned = {
  documentId: "return-001",
  documentType: "purchase-return",
  status: "confirmed",
  companyId: "company-001",
  supplierId: "supplier-001",
  correctionReference: {
    documentId: "invoice-001",
    reason: "Return",
  },
};

test("half-away-from-zero pricing is deterministic for fractional quantity and percentage tax", () => {
  const unit = {
    unitId: "kg",
    code: "KG",
    title: "Kilogram",
    ratioToBase: "1",
    precision: 3,
    roundingMode: "half-up" as const,
    taxpayerUnitCode: null,
  };
  const halfQuantity = createPurchaseCommercialTerms({
    enteredQuantity: "0.5",
    enteredUnit: unit,
    baseUnit: unit,
    unitPrice: { amount: 1, currency: "IRR" },
    discounts: [],
    charges: [],
    tax: { treatment: "not-subject", rateBasisPoints: null },
  });
  assert.equal(calculatePurchaseLineTotals(halfQuantity).grossAmount, 1);

  const halfTax = createPurchaseCommercialTerms({
    enteredQuantity: "1",
    enteredUnit: unit,
    baseUnit: unit,
    unitPrice: { amount: 10, currency: "IRR" },
    discounts: [],
    charges: [],
    tax: { treatment: "taxable", rateBasisPoints: 500 },
  });
  const totals = calculatePurchaseLineTotals(halfTax);
  assert.equal(totals.taxBaseAmount, 10);
  assert.equal(totals.taxAmount, 1);
  assert.equal(totals.grandTotal, 11);
});

test("quantity increase correction emits inbound follow-up and deterministic affected movement order", () => {
  const plan = createPurchaseCorrectionWorkflowPlan({
    originalDocument: original,
    correctionDocument: correction,
    lines: [{
      originalLineId: "line-001",
      correctionLineId: "correction-line-001",
      productId: "product-001",
      effect: "quantity-increase",
      originalBaseQuantity: "2.5",
      correctedBaseQuantity: "4",
      warehouseId: "warehouse-001",
      affectedMovementIds: ["movement-b", "movement-a", "movement-b"],
    }],
  });

  assert.deepEqual(plan.inventoryEffects, [{
    kind: "inbound-follow-up",
    originalLineId: "line-001",
    sourceLineId: "correction-line-001",
    productId: "product-001",
    quantity: "1.5",
    warehouseId: "warehouse-001",
  }]);
  assert.deepEqual(plan.affectedMovementIds, ["movement-a", "movement-b"]);
  assert.equal(plan.requiresCostBasisRecalculation, true);
  assert.equal(plan.recalculationReason, "cost_basis_changed");
  assert.equal(plan.replacesAuthoritativeCostInput, true);
});

test("commercial-only correction without affected movements has no Inventory effect or valuation replay", () => {
  const plan = createPurchaseCorrectionWorkflowPlan({
    originalDocument: original,
    correctionDocument: correction,
    lines: [{
      originalLineId: "line-001",
      correctionLineId: "correction-line-001",
      productId: "product-001",
      effect: "commercial-replacement",
      affectedMovementIds: [],
    }],
  });

  assert.deepEqual(plan.inventoryEffects, []);
  assert.deepEqual(plan.affectedMovementIds, []);
  assert.equal(plan.requiresCostBasisRecalculation, false);
  assert.equal(plan.recalculationReason, null);
  assert.equal(plan.replacesAuthoritativeCostInput, false);
  assert.equal(plan.rewritesOriginalDocument, false);
});

test("correction rejects a declared quantity direction that contradicts the corrected quantity", () => {
  assert.throws(
    () => createPurchaseCorrectionWorkflowPlan({
      originalDocument: original,
      correctionDocument: correction,
      lines: [{
        originalLineId: "line-001",
        correctionLineId: "correction-line-001",
        productId: "product-001",
        effect: "quantity-increase",
        originalBaseQuantity: "5",
        correctedBaseQuantity: "4",
        warehouseId: "warehouse-001",
      }],
    }),
    (error: unknown) =>
      error instanceof PurchaseDomainError &&
      error.field === "lines[0].correctedBaseQuantity",
  );

  assert.throws(
    () => createPurchaseCorrectionWorkflowPlan({
      originalDocument: original,
      correctionDocument: correction,
      lines: [{
        originalLineId: "line-001",
        correctionLineId: "correction-line-001",
        productId: "product-001",
        effect: "quantity-decrease",
        originalBaseQuantity: "5",
        correctedBaseQuantity: "5",
        warehouseId: "warehouse-001",
      }],
    }),
    (error: unknown) =>
      error instanceof PurchaseDomainError &&
      error.field === "lines[0].correctedBaseQuantity",
  );
});

test("return normalization preserves an exact positive decimal compensation quantity", () => {
  const plan = createPurchaseReturnWorkflowPlan({
    originalDocument: original,
    returnDocument: returned,
    lines: [{
      originalLineId: "line-001",
      returnLineId: "return-line-001",
      productId: "product-001",
      returnedBaseQuantity: "002.500",
      originalBaseQuantity: "10",
      warehouseId: "warehouse-001",
    }],
  });

  assert.equal(plan.inventoryEffect.lines[0]?.quantity, "2.500");
  assert.equal(plan.rewritesOriginalDocument, false);
  assert.equal(plan.rewritesOriginalCostInput, false);
  assert.equal(plan.requiresCostBasisRecalculation, false);
});

test("duplicate original or compensating line identities are rejected", () => {
  assert.throws(
    () => createPurchaseReturnWorkflowPlan({
      originalDocument: original,
      returnDocument: returned,
      lines: [
        {
          originalLineId: "line-001",
          returnLineId: "return-line-001",
          productId: "product-001",
          returnedBaseQuantity: "1",
          originalBaseQuantity: "5",
          warehouseId: "warehouse-001",
        },
        {
          originalLineId: "line-001",
          returnLineId: "return-line-002",
          productId: "product-001",
          returnedBaseQuantity: "1",
          originalBaseQuantity: "5",
          warehouseId: "warehouse-001",
        },
      ],
    }),
    (error: unknown) =>
      error instanceof PurchaseDomainError &&
      error.field === "lines[1]",
  );
});
