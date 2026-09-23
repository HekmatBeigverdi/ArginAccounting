import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchasePostingFact,
  createSupplierInvoicePostingPlan,
  createPurchaseReturnPostingPlan,
  createPurchaseCorrectionPostingPlan,
  resolveSupplierInvoiceInventoryValuation,
  resolvePurchaseReturnInventoryValuation,
  resolvePurchaseCorrectionInventoryValuation,
} from "../src/index.ts";

function amounts(net: number, charge = 0, tax = 0) {
  return {
    currency: "IRR",
    grossAmount: net,
    discountAmount: 0,
    netAfterDiscount: net,
    chargeAmount: charge,
    taxBaseAmount: net + charge,
    taxAmount: tax,
    grandTotal: net + charge + tax,
  };
}

function valuation(input: {
  id: string;
  movement: string;
  document: string;
  line: string;
  product?: string;
  total: number;
  quantity?: string;
}) {
  return {
    companyId: "company-001",
    valuationEntryId: input.id,
    movementId: input.movement,
    inventoryDocumentId: input.document,
    inventoryLineId: input.line,
    productId: input.product ?? "product-001",
    warehouseId: "warehouse-001",
    policyId: "valuation-policy-001",
    method: "fifo" as const,
    strategyVersion: 1,
    currency: "IRR",
    quantity: input.quantity ?? "1",
    unitCost: String(Math.abs(input.total)),
    totalCost: input.total,
  };
}

function makeFact(input: {
  type: "supplier-invoice" | "purchase-return" | "purchase-correction";
  id: string;
  lineId: string;
  amount: ReturnType<typeof amounts>;
  valuations: ReturnType<typeof valuation>[];
}) {
  return createPurchasePostingFact({
    factId: `fact-${input.id}`,
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    purchaseDocumentId: input.id,
    purchaseDocumentVersion: 1,
    documentType: input.type,
    sourceStatus: "confirmed",
    documentNumber: input.id,
    businessDate: "2026-09-23",
    supplier: {
      companyId: "company-001",
      supplierId: "supplier-001",
      code: "SUP-001",
      displayName: "Supplier",
      nationalCode: null,
      nationalId: null,
      economicNumber: null,
      taxFileNumber: null,
    },
    lines: [{
      purchaseLineId: input.lineId,
      position: 1,
      lineKind: "stock-product",
      item: {
        itemId: "product-001",
        itemType: "product",
        code: "P-001",
        displayName: "Product",
        taxpayerGoodsServiceId: null,
        stockTracking: true,
      },
      baseQuantity: "1",
      amounts: input.amount,
      valuations: input.valuations,
    }],
    totals: input.amount,
    capturedAt: "2026-09-23T05:00:00.000Z",
  });
}

test("supplier invoice stock debit resolves from authoritative inbound valuation", () => {
  const fact = makeFact({
    type: "supplier-invoice",
    id: "invoice-001",
    lineId: "invoice-line",
    amount: amounts(9_000, 100, 910),
    valuations: [
      valuation({ id: "val-1", movement: "mov-1", document: "receipt-1", line: "receipt-line-1", total: 9_100 }),
    ],
  });
  const plan = resolveSupplierInvoiceInventoryValuation(
    fact,
    createSupplierInvoicePostingPlan(fact),
  );
  const inventory = plan.components.find(c => c.componentId === "principal:invoice-line");
  assert.equal(inventory?.side, "debit");
  assert.equal(inventory?.amount, 9_100);
  assert.equal(inventory?.deferredToStep, null);
  assert.equal(plan.resolvedValuations[0]?.signedTotalCost, 9_100);
});

test("purchase return stock credit uses absolute authoritative outbound valuation", () => {
  const fact = makeFact({
    type: "purchase-return",
    id: "return-001",
    lineId: "return-line",
    amount: amounts(9_000, 100, 910),
    valuations: [
      valuation({ id: "val-out-1", movement: "mov-out-1", document: "issue-1", line: "issue-line-1", total: -8_750 }),
    ],
  });
  const plan = resolvePurchaseReturnInventoryValuation(
    fact,
    createPurchaseReturnPostingPlan(
      fact,
      { originalSupplierInvoiceId: "invoice-001" },
      { policyId: "tax-1", companyId: "company-001", recoverability: "recoverable" },
    ),
  );
  const inventory = plan.components.find(c => c.componentId === "principal:return-line");
  assert.equal(inventory?.side, "credit");
  assert.equal(inventory?.amount, 8_750);
  assert.equal(inventory?.deferredToStep, null);
});

test("commercial stock correction uses corrected minus original valuation", () => {
  const original = makeFact({
    type: "supplier-invoice",
    id: "invoice-001",
    lineId: "orig-line",
    amount: amounts(9_000, 100, 910),
    valuations: [
      valuation({ id: "val-original", movement: "mov-original", document: "receipt-1", line: "receipt-line", total: 9_100 }),
    ],
  });
  const corrected = makeFact({
    type: "purchase-correction",
    id: "correction-001",
    lineId: "corr-line",
    amount: amounts(9_500, 100, 960),
    valuations: [
      valuation({ id: "val-corrected", movement: "mov-original", document: "receipt-1", line: "receipt-line", total: 9_600 }),
    ],
  });

  const posting = createPurchaseCorrectionPostingPlan(
    original,
    corrected,
    {
      originalSupplierInvoiceId: "invoice-001",
      lineLinks: [{
        originalPurchaseLineId: "orig-line",
        correctionPurchaseLineId: "corr-line",
        effect: "commercial-replacement",
      }],
    },
    { policyId: "tax-1", companyId: "company-001", recoverability: "recoverable" },
  );
  const resolved = resolvePurchaseCorrectionInventoryValuation(original, corrected, posting);
  const inventory = resolved.components.find(c => c.componentId === "inventory:corr-line");
  assert.equal(inventory?.side, "debit");
  assert.equal(inventory?.amount, 500);
});

test("quantity decrease uses signed outbound correction valuation and becomes credit", () => {
  const original = makeFact({
    type: "supplier-invoice",
    id: "invoice-001",
    lineId: "orig-line",
    amount: amounts(9_000, 100, 910),
    valuations: [
      valuation({ id: "val-original", movement: "mov-original", document: "receipt-1", line: "receipt-line", total: 9_100 }),
    ],
  });
  const corrected = makeFact({
    type: "purchase-correction",
    id: "correction-001",
    lineId: "corr-line",
    amount: amounts(9_000, 100, 910),
    valuations: [
      valuation({ id: "val-decrease", movement: "mov-decrease", document: "adjustment-1", line: "adjustment-line", total: -2_300 }),
    ],
  });
  const posting = createPurchaseCorrectionPostingPlan(
    original,
    corrected,
    {
      originalSupplierInvoiceId: "invoice-001",
      lineLinks: [{
        originalPurchaseLineId: "orig-line",
        correctionPurchaseLineId: "corr-line",
        effect: "quantity-decrease",
      }],
    },
    { policyId: "tax-1", companyId: "company-001", recoverability: "recoverable" },
  );
  const resolved = resolvePurchaseCorrectionInventoryValuation(original, corrected, posting);
  const inventory = resolved.components.find(c => c.componentId === "inventory:corr-line");
  assert.equal(inventory?.side, "credit");
  assert.equal(inventory?.amount, 2_300);
});

test("multiple valuation movements aggregate deterministically", () => {
  const fact = makeFact({
    type: "supplier-invoice",
    id: "invoice-002",
    lineId: "invoice-line-2",
    amount: amounts(10_000, 0, 0),
    valuations: [
      valuation({ id: "val-a", movement: "mov-a", document: "receipt-a", line: "line-a", total: 4_000 }),
      valuation({ id: "val-b", movement: "mov-b", document: "receipt-b", line: "line-b", total: 6_000 }),
    ],
  });
  const resolved = resolveSupplierInvoiceInventoryValuation(
    fact,
    createSupplierInvoicePostingPlan(fact),
  );
  assert.equal(resolved.resolvedValuations[0]?.signedTotalCost, 10_000);
  assert.deepEqual(resolved.resolvedValuations[0]?.movementIds, ["mov-a", "mov-b"]);
});
