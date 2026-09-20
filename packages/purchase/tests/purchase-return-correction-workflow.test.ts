import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  createPurchaseCorrectionWorkflowPlan,
  createPurchaseReturnWorkflowPlan,
} from "../src/index.ts";

const original = {
  documentId: "invoice-001",
  documentType: "supplier-invoice" as const,
  status: "confirmed" as const,
  companyId: "company-001",
  supplierId: "supplier-001",
};

const purchaseReturn = {
  documentId: "return-001",
  documentType: "purchase-return" as const,
  status: "confirmed" as const,
  companyId: "company-001",
  supplierId: "supplier-001",
  correctionReference: { documentId: "invoice-001", reason: "Damaged goods" },
};

const purchaseCorrection = {
  documentId: "correction-001",
  documentType: "purchase-correction" as const,
  status: "confirmed" as const,
  companyId: "company-001",
  supplierId: "supplier-001",
  correctionReference: { documentId: "invoice-001", reason: "Supplier corrected price" },
};

function assertDomainError(action: () => unknown, code: string, field: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("purchase return creates compensating outbound inventory intent without rewriting original cost", () => {
  const plan = createPurchaseReturnWorkflowPlan({
    originalDocument: original,
    returnDocument: purchaseReturn,
    lines: [{
      originalLineId: "invoice-line-1",
      returnLineId: "return-line-1",
      productId: "product-001",
      returnedBaseQuantity: "2",
      originalBaseQuantity: "10",
      warehouseId: "warehouse-001",
    }],
  });

  assert.equal(plan.kind, "purchase-return");
  assert.equal(plan.inventoryEffect.kind, "outbound-compensation");
  assert.equal(plan.inventoryEffect.lines[0]?.quantity, "2");
  assert.equal(plan.rewritesOriginalCostInput, false);
  assert.equal(plan.requiresCostBasisRecalculation, false);
});

test("return cannot exceed original quantity", () => {
  assertDomainError(
    () => createPurchaseReturnWorkflowPlan({
      originalDocument: original,
      returnDocument: purchaseReturn,
      lines: [{
        originalLineId: "invoice-line-1",
        returnLineId: "return-line-1",
        productId: "product-001",
        returnedBaseQuantity: "10.01",
        originalBaseQuantity: "10",
        warehouseId: "warehouse-001",
      }],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationQuantityInvalid,
    "lines[0].returnedBaseQuantity",
  );
});

test("price correction preserves original invoice and requests valuation recalculation for affected receipt movements", () => {
  const plan = createPurchaseCorrectionWorkflowPlan({
    originalDocument: original,
    correctionDocument: purchaseCorrection,
    lines: [{
      originalLineId: "invoice-line-1",
      correctionLineId: "correction-line-1",
      productId: "product-001",
      effect: "commercial-replacement",
      affectedMovementIds: ["movement-001", "movement-002"],
    }],
  });

  assert.equal(plan.kind, "purchase-correction");
  assert.equal(plan.rewritesOriginalDocument, false);
  assert.equal(plan.replacesAuthoritativeCostInput, true);
  assert.equal(plan.requiresCostBasisRecalculation, true);
  assert.equal(plan.recalculationReason, "cost_basis_changed");
  assert.deepEqual(plan.affectedMovementIds, ["movement-001", "movement-002"]);
});

test("quantity decrease correction produces compensating outbound intent and cost-basis recalculation for linked movements", () => {
  const plan = createPurchaseCorrectionWorkflowPlan({
    originalDocument: original,
    correctionDocument: purchaseCorrection,
    lines: [{
      originalLineId: "invoice-line-1",
      correctionLineId: "correction-line-1",
      productId: "product-001",
      effect: "quantity-decrease",
      originalBaseQuantity: "10",
      correctedBaseQuantity: "8",
      warehouseId: "warehouse-001",
      affectedMovementIds: ["movement-001"],
    }],
  });

  assert.equal(plan.inventoryEffects[0]?.kind, "outbound-compensation");
  assert.equal(plan.inventoryEffects[0]?.quantity, "2");
  assert.equal(plan.requiresCostBasisRecalculation, true);
});

test("compensating documents must be confirmed, linked to the original and share company/supplier", () => {
  assertDomainError(
    () => createPurchaseCorrectionWorkflowPlan({
      originalDocument: original,
      correctionDocument: { ...purchaseCorrection, correctionReference: { documentId: "other", reason: "wrong link" } },
      lines: [],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationReferenceInvalid,
    "correctionDocument.correctionReference.documentId",
  );
});
