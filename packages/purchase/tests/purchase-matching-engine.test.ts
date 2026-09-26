import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchaseMatchingPolicy,
  evaluatePurchaseMatching,
} from "../src/index.ts";

const invoice = [{
  invoiceLineId: "i1",
  productId: "p1",
  baseQuantity: "20",
  unitPriceAmount: 1000,
  orderLineId: null,
}];

test("two-way matching proposes deterministic matches across multiple partial receipts", () => {
  const result = evaluatePurchaseMatching({
    invoiceLines: invoice,
    receiptLines: [
      { receiptDocumentId: "r1", receiptLineId: "r1l1", sourceInvoiceLineId: "i1", productId: "p1", baseQuantity: "8" },
      { receiptDocumentId: "r2", receiptLineId: "r2l1", sourceInvoiceLineId: "i1", productId: "p1", baseQuantity: "7" },
      { receiptDocumentId: "r3", receiptLineId: "r3l1", sourceInvoiceLineId: "i1", productId: "p1", baseQuantity: "5" },
    ],
    existingMatches: [],
    policy: createPurchaseMatchingPolicy(),
  });

  assert.equal(result.mode, "two-way");
  assert.equal(result.status, "matched");
  assert.equal(result.eligible, true);
  assert.equal(result.proposals.length, 3);
  assert.equal(result.lines[0]?.matchedBaseQuantity, "20");
  assert.equal(result.lines[0]?.remainingBaseQuantity, "0");
});

test("existing matches are respected and only the remaining receipt quantity is proposed", () => {
  const result = evaluatePurchaseMatching({
    invoiceLines: invoice,
    receiptLines: [
      { receiptDocumentId: "r1", receiptLineId: "r1l1", sourceInvoiceLineId: "i1", productId: "p1", baseQuantity: "8" },
      { receiptDocumentId: "r2", receiptLineId: "r2l1", sourceInvoiceLineId: "i1", productId: "p1", baseQuantity: "12" },
    ],
    existingMatches: [{
      matchId: "m1", companyId: "c1", invoiceDocumentId: "inv", invoiceLineId: "i1",
      receiptDocumentId: "r1", receiptLineId: "r1l1", productId: "p1", matchedBaseQuantity: "8",
    }],
    policy: createPurchaseMatchingPolicy(),
  });

  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0]?.receiptDocumentId, "r2");
  assert.equal(result.proposals[0]?.matchedBaseQuantity, "12");
  assert.equal(result.status, "matched");
});

test("three-way matching reports PO price variance outside tolerance", () => {
  const result = evaluatePurchaseMatching({
    invoiceLines: [{ ...invoice[0]!, orderLineId: "o1", unitPriceAmount: 1030 }],
    receiptLines: [
      { receiptDocumentId: "r1", receiptLineId: "r1l1", sourceInvoiceLineId: "i1", productId: "p1", baseQuantity: "20" },
    ],
    existingMatches: [],
    orderLines: [{ orderLineId: "o1", productId: "p1", baseQuantity: "20", unitPriceAmount: 1000 }],
    policy: createPurchaseMatchingPolicy(200),
  });

  assert.equal(result.mode, "three-way");
  assert.equal(result.status, "variance");
  assert.equal(result.eligible, false);
  assert.equal(result.lines[0]?.orderPriceVarianceBasisPoints, 300);
  assert.equal(result.lines[0]?.priceWithinTolerance, false);
});

test("three-way matching accepts price variance inside tolerance", () => {
  const result = evaluatePurchaseMatching({
    invoiceLines: [{ ...invoice[0]!, orderLineId: "o1", unitPriceAmount: 1010 }],
    receiptLines: [
      { receiptDocumentId: "r1", receiptLineId: "r1l1", sourceInvoiceLineId: "i1", productId: "p1", baseQuantity: "20" },
    ],
    existingMatches: [],
    orderLines: [{ orderLineId: "o1", productId: "p1", baseQuantity: "20", unitPriceAmount: 1000 }],
    policy: createPurchaseMatchingPolicy(150),
  });

  assert.equal(result.status, "matched");
  assert.equal(result.eligible, true);
  assert.equal(result.lines[0]?.orderPriceVarianceBasisPoints, 100);
});

test("matching remains partial until confirmed receipt coverage reaches invoice quantity", () => {
  const result = evaluatePurchaseMatching({
    invoiceLines: invoice,
    receiptLines: [
      { receiptDocumentId: "r1", receiptLineId: "r1l1", sourceInvoiceLineId: "i1", productId: "p1", baseQuantity: "8" },
    ],
    existingMatches: [],
    policy: createPurchaseMatchingPolicy(),
  });

  assert.equal(result.status, "partially-matched");
  assert.equal(result.eligible, false);
  assert.equal(result.lines[0]?.remainingBaseQuantity, "12");
});
