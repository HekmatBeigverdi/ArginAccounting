import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchaseCorrectionPostingPlan,
  createPurchasePostingFact,
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

function makeFact(input: {
  type: "supplier-invoice" | "purchase-correction";
  id: string;
  stock: ReturnType<typeof amounts>;
  service: ReturnType<typeof amounts>;
}) {
  const totals = {
    currency: "IRR",
    grossAmount: input.stock.grossAmount + input.service.grossAmount,
    discountAmount: 0,
    netAfterDiscount: input.stock.netAfterDiscount + input.service.netAfterDiscount,
    chargeAmount: input.stock.chargeAmount + input.service.chargeAmount,
    taxBaseAmount: input.stock.taxBaseAmount + input.service.taxBaseAmount,
    taxAmount: input.stock.taxAmount + input.service.taxAmount,
    grandTotal: input.stock.grandTotal + input.service.grandTotal,
  };
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
    lines: [
      {
        purchaseLineId: input.type === "supplier-invoice" ? "orig-stock" : "corr-stock",
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
        amounts: input.stock,
        valuations: [],
      },
      {
        purchaseLineId: input.type === "supplier-invoice" ? "orig-service" : "corr-service",
        position: 2,
        lineKind: "service",
        item: {
          itemId: "service-001",
          itemType: "service",
          code: "S-001",
          displayName: "Service",
          taxpayerGoodsServiceId: null,
          stockTracking: false,
        },
        baseQuantity: "1",
        amounts: input.service,
        valuations: [],
      },
    ],
    totals,
    capturedAt: "2026-09-23T04:00:00.000Z",
  });
}

const original = makeFact({
  type: "supplier-invoice",
  id: "invoice-001",
  stock: amounts(9_000, 100, 910),
  service: amounts(2_000, 50, 205),
});

const links = {
  originalSupplierInvoiceId: "invoice-001",
  lineLinks: [
    {
      originalPurchaseLineId: "orig-stock",
      correctionPurchaseLineId: "corr-stock",
      effect: "commercial-replacement" as const,
    },
    {
      originalPurchaseLineId: "orig-service",
      correctionPurchaseLineId: "corr-service",
      effect: "commercial-replacement" as const,
    },
  ],
};

test("derives correction deltas from original and corrected authoritative facts", () => {
  const corrected = makeFact({
    type: "purchase-correction",
    id: "correction-001",
    stock: amounts(9_500, 100, 960),
    service: amounts(1_800, 40, 184),
  });
  const plan = createPurchaseCorrectionPostingPlan(original, corrected, links, {
    policyId: "vat-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });

  assert.equal(plan.payableDelta, corrected.totals.grandTotal - original.totals.grandTotal);
});

test("stock commercial correction defers Inventory amount delta to Step 12", () => {
  const corrected = makeFact({
    type: "purchase-correction",
    id: "correction-001",
    stock: amounts(9_500, 100, 960),
    service: amounts(2_000, 50, 205),
  });
  const plan = createPurchaseCorrectionPostingPlan(original, corrected, links, {
    policyId: "vat-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });
  const inventory = plan.components.find(component => component.componentId === "inventory:corr-stock");
  assert.equal(inventory?.accountRole, "inventory-asset");
  assert.equal(inventory?.amountBasis, "inventory-valuation-delta");
  assert.equal(inventory?.amount, null);
  assert.equal(inventory?.deferredToStep, 12);
});

test("recoverable VAT correction uses Input VAT delta", () => {
  const corrected = makeFact({
    type: "purchase-correction",
    id: "correction-001",
    stock: amounts(9_000, 100, 1_000),
    service: amounts(2_000, 50, 205),
  });
  const plan = createPurchaseCorrectionPostingPlan(original, corrected, links, {
    policyId: "vat-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });
  const tax = plan.components.find(component => component.componentId === "tax:corr-stock");
  assert.equal(tax?.side, "debit");
  assert.equal(tax?.accountRole, "input-vat-recoverable");
  assert.equal(tax?.amount, 90);
});

test("service correction increases or reverses expense by commercial delta", () => {
  const corrected = makeFact({
    type: "purchase-correction",
    id: "correction-001",
    stock: amounts(9_000, 100, 910),
    service: amounts(1_500, 25, 153),
  });
  const plan = createPurchaseCorrectionPostingPlan(original, corrected, links, {
    policyId: "vat-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });
  const principal = plan.components.find(component => component.componentId === "principal:corr-service");
  assert.equal(principal?.side, "credit");
  assert.equal(principal?.accountRole, "purchase-expense");
  assert.equal(principal?.amount, 500);
});

test("quantity increase/decrease stock effects remain valuation-owned", () => {
  const corrected = makeFact({
    type: "purchase-correction",
    id: "correction-001",
    stock: amounts(9_000, 100, 910),
    service: amounts(2_000, 50, 205),
  });
  const quantityLinks = {
    ...links,
    lineLinks: [
      { ...links.lineLinks[0], effect: "quantity-increase" as const },
      links.lineLinks[1],
    ],
  };
  const plan = createPurchaseCorrectionPostingPlan(original, corrected, quantityLinks, {
    policyId: "vat-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });
  const inventory = plan.components.find(component => component.componentId === "inventory:corr-stock");
  assert.equal(inventory?.deferredToStep, 12);
  assert.equal(inventory?.effect, "quantity-increase");
});

test("supplier payable direction follows document grand-total delta", () => {
  const corrected = makeFact({
    type: "purchase-correction",
    id: "correction-001",
    stock: amounts(8_000, 100, 810),
    service: amounts(2_000, 50, 205),
  });
  const plan = createPurchaseCorrectionPostingPlan(original, corrected, links, {
    policyId: "vat-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });
  const payable = plan.components.find(component => component.componentId === "supplier-payable");
  assert.equal(payable?.side, "debit");
  assert.equal(payable?.accountRole, "accounts-payable");
  assert.equal(payable?.amount, Math.abs(plan.payableDelta));
});
