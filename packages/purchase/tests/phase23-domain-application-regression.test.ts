import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchaseMatchingPolicy,
  evaluatePurchaseMatching,
} from "../src/index.ts";

const invoiceLine = {
  invoiceLineId: "invoice-line-1",
  productId: "product-1",
  baseQuantity: "20",
  unitPriceAmount: 1_000,
  orderLineId: null as string | null,
};

test("Step 32 matching is deterministic regardless of receipt input order", () => {
  const policy = createPurchaseMatchingPolicy();
  const receipts = [
    { receiptDocumentId: "r2", receiptLineId: "l2", sourceInvoiceLineId: "invoice-line-1", productId: "product-1", baseQuantity: "7" },
    { receiptDocumentId: "r1", receiptLineId: "l1", sourceInvoiceLineId: "invoice-line-1", productId: "product-1", baseQuantity: "8" },
    { receiptDocumentId: "r3", receiptLineId: "l3", sourceInvoiceLineId: "invoice-line-1", productId: "product-1", baseQuantity: "5" },
  ];
  const a = evaluatePurchaseMatching({ invoiceLines: [invoiceLine], receiptLines: receipts, existingMatches: [], policy });
  const b = evaluatePurchaseMatching({ invoiceLines: [invoiceLine], receiptLines: [...receipts].reverse(), existingMatches: [], policy });
  assert.deepEqual(a.proposals, b.proposals);
  assert.equal(a.status, "matched");
});

test("Step 32 matching rejects duplicate invoice line identities", () => {
  assert.throws(() => evaluatePurchaseMatching({
    invoiceLines: [invoiceLine, { ...invoiceLine }],
    receiptLines: [],
    existingMatches: [],
    policy: createPurchaseMatchingPolicy(),
  }), /invalid_invoice_line/u);
});

test("Step 32 matching rejects product mismatch across invoice and receipt", () => {
  assert.throws(() => evaluatePurchaseMatching({
    invoiceLines: [invoiceLine],
    receiptLines: [{
      receiptDocumentId: "r1", receiptLineId: "l1",
      sourceInvoiceLineId: invoiceLine.invoiceLineId,
      productId: "other-product", baseQuantity: "20",
    }],
    existingMatches: [],
    policy: createPurchaseMatchingPolicy(),
  }), /product_mismatch/u);
});

test("Step 32 matching rejects already-overmatched invoice facts", () => {
  assert.throws(() => evaluatePurchaseMatching({
    invoiceLines: [invoiceLine],
    receiptLines: [],
    existingMatches: [{
      matchId: "m1", companyId: "c1",
      invoiceDocumentId: "inv1", invoiceLineId: invoiceLine.invoiceLineId,
      receiptDocumentId: "r1", receiptLineId: "l1",
      productId: invoiceLine.productId, matchedBaseQuantity: "21",
    }],
    policy: createPurchaseMatchingPolicy(),
  }), /overmatched/u);
});

test("Step 32 three-way matching blocks exact-quantity variance even with equal price", () => {
  const result = evaluatePurchaseMatching({
    invoiceLines: [{ ...invoiceLine, orderLineId: "order-line-1" }],
    receiptLines: [{
      receiptDocumentId: "r1", receiptLineId: "l1",
      sourceInvoiceLineId: invoiceLine.invoiceLineId,
      productId: invoiceLine.productId, baseQuantity: "20",
    }],
    existingMatches: [],
    orderLines: [{
      orderLineId: "order-line-1", productId: invoiceLine.productId,
      baseQuantity: "19", unitPriceAmount: 1_000,
    }],
    policy: createPurchaseMatchingPolicy(0),
  });
  assert.equal(result.status, "variance");
  assert.equal(result.eligible, false);
  assert.equal(result.lines[0]?.orderQuantityVariance, true);
  assert.equal(result.lines[0]?.orderPriceVarianceBasisPoints, 0);
});

test("Step 32 price tolerance accepts the boundary and rejects one basis point above it", () => {
  const evaluate = (price: number) => evaluatePurchaseMatching({
    invoiceLines: [{ ...invoiceLine, orderLineId: "order-line-1", unitPriceAmount: price }],
    receiptLines: [{
      receiptDocumentId: "r1", receiptLineId: "l1",
      sourceInvoiceLineId: invoiceLine.invoiceLineId,
      productId: invoiceLine.productId, baseQuantity: "20",
    }],
    existingMatches: [],
    orderLines: [{
      orderLineId: "order-line-1", productId: invoiceLine.productId,
      baseQuantity: "20", unitPriceAmount: 1_000,
    }],
    policy: createPurchaseMatchingPolicy(200),
  });
  assert.equal(evaluate(1_020).status, "matched");
  assert.equal(evaluate(1_021).status, "variance");
});

test("Step 32 matching policy rejects invalid tolerance values", () => {
  for (const value of [-1, 10_001, 1.5]) {
    assert.throws(() => createPurchaseMatchingPolicy(value), /invalid_tolerance/u);
  }
});

test("Step 32 fractional quantities preserve exact decimal matching", () => {
  const result = evaluatePurchaseMatching({
    invoiceLines: [{ ...invoiceLine, baseQuantity: "2.5" }],
    receiptLines: [
      { receiptDocumentId: "r1", receiptLineId: "l1", sourceInvoiceLineId: invoiceLine.invoiceLineId, productId: invoiceLine.productId, baseQuantity: "1.25" },
      { receiptDocumentId: "r2", receiptLineId: "l2", sourceInvoiceLineId: invoiceLine.invoiceLineId, productId: invoiceLine.productId, baseQuantity: "1.25" },
    ],
    existingMatches: [],
    policy: createPurchaseMatchingPolicy(),
  });
  assert.equal(result.status, "matched");
  assert.equal(result.lines[0]?.matchedBaseQuantity, "2.5");
  assert.equal(result.lines[0]?.remainingBaseQuantity, "0");
});
