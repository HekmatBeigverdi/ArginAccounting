import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchaseChargePostingPlan,
  createPurchasePostingFact,
} from "../src/index.ts";

function amounts(net: number, charge: number) {
  return {
    currency: "IRR",
    grossAmount: net,
    discountAmount: 0,
    netAfterDiscount: net,
    chargeAmount: charge,
    taxBaseAmount: net + charge,
    taxAmount: 0,
    grandTotal: net + charge,
  };
}

function invoice() {
  return createPurchasePostingFact({
    factId: "fact-charge-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    purchaseDocumentId: "invoice-charge-001",
    purchaseDocumentVersion: 1,
    documentType: "supplier-invoice",
    sourceStatus: "confirmed",
    documentNumber: "PINV-CHARGE-001",
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
        purchaseLineId: "stock-line",
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
        amounts: amounts(9_000, 100),
        valuations: [],
      },
      {
        purchaseLineId: "service-line",
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
        amounts: amounts(2_000, 50),
        valuations: [],
      },
    ],
    totals: amounts(11_000, 150),
    capturedAt: "2026-09-23T02:00:00.000Z",
  });
}

test("routes stock purchase charge through authoritative Inventory Cost Input", () => {
  const plan = createPurchaseChargePostingPlan(invoice());
  const stock = plan.components.find(item => item.purchaseLineId === "stock-line");
  assert.equal(stock?.chargeAmount, 100);
  assert.equal(stock?.destination, "inventory-capitalizable-cost");
  assert.equal(stock?.accountRole, "inventory-asset");
  assert.equal(stock?.includedInPurchaseCostInput, true);
  assert.equal(stock?.deferredToStep, 12);
});

test("routes service/non-stock charge to purchase charge expense", () => {
  const plan = createPurchaseChargePostingPlan(invoice());
  const service = plan.components.find(item => item.purchaseLineId === "service-line");
  assert.equal(service?.chargeAmount, 50);
  assert.equal(service?.destination, "purchase-charge-expense");
  assert.equal(service?.accountRole, "purchase-charge");
  assert.equal(service?.includedInPurchaseCostInput, false);
  assert.equal(service?.deferredToStep, null);
});

test("charge components reconcile exactly to document charge total", () => {
  const plan = createPurchaseChargePostingPlan(invoice());
  assert.equal(plan.totalChargeAmount, 150);
  assert.equal(plan.components.length, 2);
});

test("zero-charge invoice creates no charge components", () => {
  const source = invoice();
  const zero = createPurchasePostingFact({
    ...source,
    factId: "fact-zero-charge",
    purchaseDocumentId: "invoice-zero-charge",
    lines: source.lines.map(line => ({
      ...line,
      amounts: amounts(line.amounts.netAfterDiscount, 0),
    })),
    totals: amounts(11_000, 0),
  });
  const plan = createPurchaseChargePostingPlan(zero);
  assert.equal(plan.totalChargeAmount, 0);
  assert.deepEqual(plan.components, []);
});
