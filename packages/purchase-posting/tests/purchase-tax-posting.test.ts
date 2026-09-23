import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  createPurchasePostingFact,
  createPurchaseTaxPostingPlan,
} from "../src/index.ts";

function amounts(net: number, tax: number) {
  return {
    currency: "IRR",
    grossAmount: net,
    discountAmount: 0,
    netAfterDiscount: net,
    chargeAmount: 0,
    taxBaseAmount: net,
    taxAmount: tax,
    grandTotal: net + tax,
  };
}

function invoice() {
  return createPurchasePostingFact({
    factId: "fact-tax-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    purchaseDocumentId: "invoice-tax-001",
    purchaseDocumentVersion: 1,
    documentType: "supplier-invoice",
    sourceStatus: "confirmed",
    documentNumber: "PINV-TAX-001",
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
        amounts: amounts(9_100, 910),
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
        amounts: amounts(2_000, 200),
        valuations: [],
      },
    ],
    totals: amounts(11_100, 1_110),
    capturedAt: "2026-09-23T01:00:00.000Z",
  });
}

test("posts recoverable VAT to input VAT and excludes it from inventory/expense cost", () => {
  const plan = createPurchaseTaxPostingPlan(invoice(), {
    policyId: "tax-policy-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });

  assert.equal(plan.totalTaxAmount, 1_110);
  assert.equal(plan.components.length, 2);
  for (const component of plan.components) {
    assert.equal(component.destination, "input-vat-recoverable");
    assert.equal(component.accountRole, "input-vat-recoverable");
    assert.equal(component.side, "debit");
    assert.equal(component.deferredToStep, null);
  }
});

test("routes non-recoverable stock VAT to capitalizable inventory cost for Step 12", () => {
  const plan = createPurchaseTaxPostingPlan(invoice(), {
    policyId: "tax-policy-nonrecoverable",
    companyId: "company-001",
    recoverability: "non-recoverable",
  });

  const stock = plan.components.find(component => component.purchaseLineId === "stock-line");
  assert.equal(stock?.taxAmount, 910);
  assert.equal(stock?.destination, "inventory-capitalizable-cost");
  assert.equal(stock?.accountRole, "inventory-asset");
  assert.equal(stock?.deferredToStep, 12);
});

test("routes non-recoverable service VAT to purchase expense", () => {
  const plan = createPurchaseTaxPostingPlan(invoice(), {
    policyId: "tax-policy-nonrecoverable",
    companyId: "company-001",
    recoverability: "non-recoverable",
  });

  const service = plan.components.find(component => component.purchaseLineId === "service-line");
  assert.equal(service?.taxAmount, 200);
  assert.equal(service?.destination, "purchase-expense");
  assert.equal(service?.accountRole, "purchase-expense");
  assert.equal(service?.deferredToStep, null);
});

test("rejects tax policy from another Company", () => {
  assert.throws(
    () => createPurchaseTaxPostingPlan(invoice(), {
      policyId: "tax-policy-other",
      companyId: "company-002",
      recoverability: "recoverable",
    }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.scopeMismatch);
      assert.equal(error.field, "policy.companyId");
      return true;
    },
  );
});

test("zero tax creates no tax posting components", () => {
  const source = invoice();
  const zero = createPurchasePostingFact({
    ...source,
    factId: "fact-zero-tax",
    purchaseDocumentId: "invoice-zero-tax",
    lines: source.lines.map(line => ({
      ...line,
      amounts: amounts(line.amounts.netAfterDiscount, 0),
    })),
    totals: amounts(11_100, 0),
  });

  const plan = createPurchaseTaxPostingPlan(zero, {
    policyId: "tax-policy-recoverable",
    companyId: "company-001",
    recoverability: "recoverable",
  });

  assert.equal(plan.totalTaxAmount, 0);
  assert.deepEqual(plan.components, []);
});
