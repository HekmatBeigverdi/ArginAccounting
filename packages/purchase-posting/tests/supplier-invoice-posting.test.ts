import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  createPurchasePostingFact,
  createSupplierInvoicePostingPlan,
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

function fact() {
  return createPurchasePostingFact({
    factId: "fact-invoice-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    purchaseDocumentId: "invoice-001",
    purchaseDocumentVersion: 2,
    documentType: "supplier-invoice",
    sourceStatus: "confirmed",
    documentNumber: "PINV-001",
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
        purchaseLineId: "line-stock",
        position: 1,
        lineKind: "stock-product",
        item: {
          itemId: "product-001",
          itemType: "product",
          code: "P-001",
          displayName: "Stock Product",
          taxpayerGoodsServiceId: null,
          stockTracking: true,
        },
        baseQuantity: "2",
        amounts: amounts(8_000, 100, 810),
        valuations: [],
      },
      {
        purchaseLineId: "line-service",
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
        amounts: amounts(2_000, 0, 200),
        valuations: [],
      },
    ],
    totals: amounts(10_000, 100, 1_010),
    capturedAt: "2026-09-23T00:00:00.000Z",
  });
}

test("creates supplier invoice posting semantics from immutable commercial facts", () => {
  const plan = createSupplierInvoicePostingPlan(fact());
  assert.equal(plan.eventKind, "supplier-invoice-recognition");
  assert.deepEqual(plan.commercialControl, {
    principalAmount: 10_000,
    chargeAmount: 100,
    taxAmount: 1_010,
    grandTotal: 11_110,
  });
});

test("defers stock-product amount to authoritative Inventory Valuation", () => {
  const plan = createSupplierInvoicePostingPlan(fact());
  const stock = plan.components.find(component => component.componentId === "principal:line-stock");
  assert.equal(stock?.side, "debit");
  assert.equal(stock?.accountRole, "inventory-asset");
  assert.equal(stock?.amountBasis, "inventory-valuation");
  assert.equal(stock?.amount, null);
  assert.equal(stock?.deferredToStep, 12);
});

test("uses Purchase commercial net-after-discount for service expense principal", () => {
  const plan = createSupplierInvoicePostingPlan(fact());
  const service = plan.components.find(component => component.componentId === "principal:line-service");
  assert.equal(service?.side, "debit");
  assert.equal(service?.accountRole, "purchase-expense");
  assert.equal(service?.amountBasis, "commercial-net-after-discount");
  assert.equal(service?.amount, 2_000);
  assert.equal(service?.deferredToStep, null);
});

test("credits supplier payable for the full commercial grand total", () => {
  const plan = createSupplierInvoicePostingPlan(fact());
  const payable = plan.components.find(component => component.componentId === "supplier-payable");
  assert.equal(payable?.side, "credit");
  assert.equal(payable?.accountRole, "accounts-payable");
  assert.equal(payable?.amount, 11_110);
  assert.equal(payable?.amountBasis, "document-grand-total");
});

test("preserves VAT and charge components but defers their final rules", () => {
  const plan = createSupplierInvoicePostingPlan(fact());
  const charge = plan.components.find(component => component.componentId === "charge:line-stock");
  const tax = plan.components.find(component => component.componentId === "tax:line-stock");
  assert.equal(charge?.accountRole, "purchase-charge");
  assert.equal(charge?.amount, 100);
  assert.equal(charge?.deferredToStep, 9);
  assert.equal(tax?.accountRole, "input-vat-recoverable");
  assert.equal(tax?.amount, 810);
  assert.equal(tax?.deferredToStep, 8);
});

test("rejects non-supplier-invoice facts", () => {
  const source = fact();
  const invalid = { ...source, documentType: "purchase-return" as const };
  assert.throws(
    () => createSupplierInvoicePostingPlan(invalid),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.supplierInvoiceInvalid);
      return true;
    },
  );
});
