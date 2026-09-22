import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  createPurchasePostingFact,
} from "../src/index.ts";

const amounts = {
  currency: "IRR",
  grossAmount: 10_000,
  discountAmount: 1_000,
  netAfterDiscount: 9_000,
  chargeAmount: 100,
  taxBaseAmount: 9_100,
  taxAmount: 910,
  grandTotal: 10_010,
} as const;

const supplier = {
  supplierId: "party-supplier-001",
  code: "SUP-001",
  displayName: "تأمین‌کننده نمونه",
  nationalCode: null,
  nationalId: "10101234567",
  economicNumber: "411111111111",
  taxFileNumber: "TX-001",
} as const;

const item = {
  itemId: "product-001",
  itemType: "product" as const,
  code: "PRD-001",
  displayName: "کالای نمونه",
  taxpayerGoodsServiceId: "2720000014385",
  stockTracking: true,
};

const valuation = {
  valuationEntryId: "valuation-entry-001",
  movementId: "movement-001",
  receiptDocumentId: "inventory-receipt-001",
  receiptLineId: "inventory-receipt-line-001",
  productId: "product-001",
  warehouseId: "warehouse-001",
  policyId: "valuation-policy-001",
  method: "fifo" as const,
  strategyVersion: 1,
  currency: "IRR",
  quantity: "2.5",
  unitCost: "3640",
  totalCost: 9_100,
};

function baseInput() {
  return {
    factId: "purchase-posting-fact-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-1405-07",
    purchaseDocumentId: "purchase-doc-001",
    purchaseDocumentVersion: 7,
    documentType: "supplier-invoice" as const,
    sourceStatus: "confirmed" as const,
    documentNumber: "PINV-000045",
    businessDate: "2026-09-22",
    supplier,
    lines: [{
      purchaseLineId: "purchase-line-001",
      position: 1,
      lineKind: "stock-product" as const,
      item,
      baseQuantity: "2.5",
      amounts,
      valuations: [valuation],
    }],
    totals: amounts,
    capturedAt: "2026-09-22T12:30:00.000Z",
  };
}

function assertDomainError(
  action: () => unknown,
  code: string,
  field: string,
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchasePostingDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("captures immutable confirmed Purchase and valuation provenance without recalculating source facts", () => {
  const fact = createPurchasePostingFact(baseInput());
  assert.equal(fact.purchaseDocumentId, "purchase-doc-001");
  assert.equal(fact.purchaseDocumentVersion, 7);
  assert.equal(fact.lines[0]?.amounts.taxBaseAmount, 9_100);
  assert.equal(fact.lines[0]?.amounts.taxAmount, 910);
  assert.equal(fact.lines[0]?.valuations[0]?.method, "fifo");
  assert.equal(fact.lines[0]?.valuations[0]?.totalCost, 9_100);
  assert.ok(Object.isFrozen(fact));
  assert.ok(Object.isFrozen(fact.lines));
  assert.ok(Object.isFrozen(fact.lines[0]!));
});

test("preserves Purchase Order facts without deciding posting eligibility in Step 3", () => {
  const fact = createPurchasePostingFact({
    ...baseInput(),
    factId: "purchase-posting-fact-order",
    purchaseDocumentId: "purchase-order-001",
    documentType: "purchase-order",
  });
  assert.equal(fact.documentType, "purchase-order");
});

test("accepts service facts without an Inventory valuation snapshot", () => {
  const serviceAmounts = {
    currency: "IRR",
    grossAmount: 5_000,
    discountAmount: 0,
    netAfterDiscount: 5_000,
    chargeAmount: 0,
    taxBaseAmount: 5_000,
    taxAmount: 500,
    grandTotal: 5_500,
  } as const;
  const fact = createPurchasePostingFact({
    ...baseInput(),
    factId: "purchase-posting-fact-service",
    purchaseDocumentId: "purchase-doc-service",
    lines: [{
      purchaseLineId: "service-line-001",
      position: 1,
      lineKind: "service",
      item: {
        itemId: "service-001",
        itemType: "service",
        code: "SRV-001",
        displayName: "خدمت نمونه",
        taxpayerGoodsServiceId: null,
        stockTracking: false,
      },
      baseQuantity: "1",
      amounts: serviceAmounts,
      valuations: [],
    }],
    totals: serviceAmounts,
  });
  assert.deepEqual(fact.lines[0]?.valuations, []);
});

test("rejects duplicate line identities and positions", () => {
  const line = baseInput().lines[0]!;
  assertDomainError(
    () => createPurchasePostingFact({
      ...baseInput(),
      lines: [line, { ...line, position: 2 }],
      totals: {
        ...amounts,
        grossAmount: 20_000,
        discountAmount: 2_000,
        netAfterDiscount: 18_000,
        chargeAmount: 200,
        taxBaseAmount: 18_200,
        taxAmount: 1_820,
        grandTotal: 20_020,
      },
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.duplicateLineId,
    "lines[1].purchaseLineId",
  );

  assertDomainError(
    () => createPurchasePostingFact({
      ...baseInput(),
      lines: [line, { ...line, purchaseLineId: "purchase-line-002" }],
      totals: amounts,
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.duplicateLinePosition,
    "lines[1].position",
  );
});

test("rejects commercial totals that do not match immutable line snapshots", () => {
  assertDomainError(
    () => createPurchasePostingFact({
      ...baseInput(),
      totals: { ...amounts, grandTotal: 10_011 },
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.amountMismatch,
    "totals.grandTotal",
  );
});

test("rejects internal commercial arithmetic corruption without repricing source terms", () => {
  assertDomainError(
    () => createPurchasePostingFact({
      ...baseInput(),
      lines: [{
        ...baseInput().lines[0]!,
        amounts: { ...amounts, taxBaseAmount: 9_101 },
      }],
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.amountMismatch,
    "line.amounts.taxBaseAmount",
  );
});

test("rejects valuation on service/non-stock facts and product identity mismatch", () => {
  assertDomainError(
    () => createPurchasePostingFact({
      ...baseInput(),
      lines: [{
        ...baseInput().lines[0]!,
        lineKind: "non-stock-product",
        item: { ...item, stockTracking: false },
      }],
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.valuationInvalid,
    "line.valuations",
  );

  assertDomainError(
    () => createPurchasePostingFact({
      ...baseInput(),
      lines: [{
        ...baseInput().lines[0]!,
        valuations: [{ ...valuation, productId: "other-product" }],
      }],
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.valuationInvalid,
    "line.valuations[0].productId",
  );
});

test("keeps commercial and valuation currencies independent for future currency/accounting policy", () => {
  const fact = createPurchasePostingFact({
    ...baseInput(),
    lines: [{
      ...baseInput().lines[0]!,
      valuations: [{ ...valuation, currency: "USD" }],
    }],
  });
  assert.equal(fact.lines[0]?.amounts.currency, "IRR");
  assert.equal(fact.lines[0]?.valuations[0]?.currency, "USD");
});


test("preserves multiple valuation movements for one Purchase line", () => {
  const fact = createPurchasePostingFact({
    ...baseInput(),
    lines: [{
      ...baseInput().lines[0]!,
      valuations: [
        { ...valuation, valuationEntryId: "valuation-entry-a", movementId: "movement-a", receiptDocumentId: "receipt-a", receiptLineId: "receipt-line-a", quantity: "1", totalCost: 3_640 },
        { ...valuation, valuationEntryId: "valuation-entry-b", movementId: "movement-b", receiptDocumentId: "receipt-b", receiptLineId: "receipt-line-b", quantity: "1.5", totalCost: 5_460 },
      ],
    }],
  });
  assert.equal(fact.lines[0]?.valuations.length, 2);
  assert.equal(fact.lines[0]?.valuations[1]?.movementId, "movement-b");
});
