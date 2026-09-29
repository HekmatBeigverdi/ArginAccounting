import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  createPurchasePostingFact,
  createPurchaseReturnPostingPlan,
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

function returnFact() {
  return createPurchasePostingFact({
    factId: "fact-return-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    purchaseDocumentId: "return-001",
    purchaseDocumentVersion: 1,
    documentType: "purchase-return",
    sourceStatus: "confirmed",
    documentNumber: "PRET-001",
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
        purchaseLineId: "return-stock",
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
        amounts: amounts(9_000, 100, 910),
        valuations: [],
      },
      {
        purchaseLineId: "return-service",
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
        amounts: amounts(2_000, 50, 205),
        valuations: [],
      },
    ],
    totals: amounts(11_000, 150, 1_115),
    capturedAt: "2026-09-23T03:00:00.000Z",
  });
}

const reference = { originalSupplierInvoiceId: "invoice-001" };

test("debits supplier payable for full Purchase Return grand total", () => {
  const plan = createPurchaseReturnPostingPlan(returnFact(), reference, {
    policyId: "vat-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });
  const payable = plan.components.find(component => component.componentId === "supplier-payable");
  assert.equal(payable?.side, "debit");
  assert.equal(payable?.accountRole, "accounts-payable");
  assert.equal(payable?.amount, 12_265);
});

test("credits stock Inventory using outbound valuation rather than supplier price", () => {
  const plan = createPurchaseReturnPostingPlan(returnFact(), reference, {
    policyId: "vat-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });
  const stock = plan.components.find(component => component.componentId === "principal:return-stock");
  assert.equal(stock?.side, "credit");
  assert.equal(stock?.accountRole, "inventory-asset");
  assert.equal(stock?.amountBasis, "inventory-outbound-valuation");
  assert.equal(stock?.amount, null);
  assert.equal(stock?.deferredToStep, 12);
  assert.equal(stock?.absorbedByInventoryValuation, true);
});

test("credits recoverable Input VAT on return", () => {
  const plan = createPurchaseReturnPostingPlan(returnFact(), reference, {
    policyId: "vat-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });
  const tax = plan.components.find(component => component.componentId === "tax:return-stock");
  assert.equal(tax?.side, "credit");
  assert.equal(tax?.accountRole, "input-vat-recoverable");
  assert.equal(tax?.amount, 910);
});

test("credits service expense and charge on return", () => {
  const plan = createPurchaseReturnPostingPlan(returnFact(), reference, {
    policyId: "vat-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });
  const principal = plan.components.find(component => component.componentId === "principal:return-service");
  const charge = plan.components.find(component => component.componentId === "charge:return-service");
  assert.equal(principal?.side, "credit");
  assert.equal(principal?.accountRole, "purchase-expense");
  assert.equal(principal?.amount, 2_000);
  assert.equal(charge?.side, "credit");
  assert.equal(charge?.accountRole, "purchase-charge");
  assert.equal(charge?.amount, 50);
});

test("non-recoverable stock tax is absorbed by outbound inventory valuation", () => {
  const plan = createPurchaseReturnPostingPlan(returnFact(), reference, {
    policyId: "vat-nonrecoverable",
    companyId: "company-001",
    recoverability: "non-recoverable",
  });
  assert.equal(
    plan.components.some(component => component.componentId === "tax:return-stock"),
    false,
  );
  const stock = plan.components.find(component => component.componentId === "principal:return-stock");
  assert.equal(stock?.absorbedByInventoryValuation, true);
});

test("non-recoverable service tax reverses purchase expense", () => {
  const plan = createPurchaseReturnPostingPlan(returnFact(), reference, {
    policyId: "vat-nonrecoverable",
    companyId: "company-001",
    recoverability: "non-recoverable",
  });
  const tax = plan.components.find(component => component.componentId === "tax:return-service");
  assert.equal(tax?.side, "credit");
  assert.equal(tax?.accountRole, "purchase-expense");
  assert.equal(tax?.amount, 205);
});

test("requires a distinct original Supplier Invoice reference", () => {
  assert.throws(
    () => createPurchaseReturnPostingPlan(returnFact(), {
      originalSupplierInvoiceId: "return-001",
    }, {
      policyId: "vat-recoverable",
      companyId: "company-001",
      recoverability: "recoverable",
    }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseReturnReferenceInvalid);
      return true;
    },
  );
});
