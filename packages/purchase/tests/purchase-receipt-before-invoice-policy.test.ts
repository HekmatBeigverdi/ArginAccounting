import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchaseCommercialTerms,
  evaluatePurchaseReceiptBeforeInvoiceCost,
} from "../src/index.ts";

const unit = {
  unitId: "piece",
  code: "PCS",
  title: "Piece",
  ratioToBase: "1",
  precision: 2,
  roundingMode: "half-up" as const,
  taxpayerUnitCode: "1621",
};

const terms = createPurchaseCommercialTerms({
  enteredQuantity: "10",
  enteredUnit: unit,
  baseUnit: unit,
  unitPrice: { amount: 1000, currency: "IRR" },
  discounts: [],
  charges: [],
  tax: { treatment: "taxable", rateBasisPoints: 1000 },
});

const movement = {
  movementId: "movement-001",
  companyId: "company-001",
  documentId: "receipt-001",
  lineId: "receipt-line-001",
  stockKey: {
    companyId: "company-001",
    productId: "product-001",
    warehouseId: "warehouse-001",
    zoneId: null,
    locationId: null,
  },
  quantityDelta: "6",
};

const fact = {
  companyId: "company-001",
  purchaseDocumentId: "invoice-001",
  purchaseLineId: "invoice-line-001",
  documentType: "supplier-invoice" as const,
  status: "confirmed" as const,
  lineKind: "stock-product" as const,
  productId: "product-001",
  commercialTerms: terms,
};

function match(quantity: string) {
  return {
    matchId: `match-${quantity}`,
    companyId: "company-001",
    invoiceDocumentId: "invoice-001",
    invoiceLineId: "invoice-line-001",
    receiptDocumentId: "receipt-001",
    receiptLineId: "receipt-line-001",
    productId: "product-001",
    matchedBaseQuantity: quantity,
  };
}

test("receipt confirmed before supplier invoice stays explicitly unresolved, never zero-cost", () => {
  const decision = evaluatePurchaseReceiptBeforeInvoiceCost({
    costInputId: "cost-001",
    movement,
    matches: [],
    commercialFacts: [],
  });
  assert.equal(decision.status, "unresolved");
  assert.equal(decision.reason, "awaiting-supplier-invoice");
  assert.equal(decision.costInput, null);
  assert.equal(decision.blocksInventoryConfirmation, false);
  assert.equal(decision.requiresRecalculation, true);
  assert.equal(decision.recalculationReason, "cost_basis_changed");
});

test("partial matching keeps the movement unresolved until its full physical quantity has cost coverage", () => {
  const decision = evaluatePurchaseReceiptBeforeInvoiceCost({
    costInputId: "cost-001",
    movement,
    matches: [match("4")],
    commercialFacts: [fact],
  });
  assert.equal(decision.status, "unresolved");
  assert.equal(decision.reason, "partial-invoice-match");
  assert.equal(decision.matchedBaseQuantity, "4");
  assert.equal(decision.remainingBaseQuantity, "2");
  assert.equal(decision.costInput, null);
});

test("full later invoice matching resolves the same movement and requires valuation recalculation", () => {
  const decision = evaluatePurchaseReceiptBeforeInvoiceCost({
    costInputId: "cost-001",
    movement,
    matches: [match("6")],
    commercialFacts: [fact],
  });
  assert.equal(decision.status, "resolved");
  assert.equal(decision.reason, null);
  assert.equal(decision.matchedBaseQuantity, "6");
  assert.equal(decision.remainingBaseQuantity, "0");
  assert.equal(decision.costInput?.basis.quantity, "6");
  assert.equal(decision.costInput?.basis.baseCost, 6000);
  assert.equal(decision.costInput?.basis.unitCost, "1000");
  assert.equal(decision.requiresRecalculation, true);
  assert.equal(decision.recalculationReason, "cost_basis_changed");
});

test("missing confirmed commercial fact remains unresolved instead of synthesizing a price", () => {
  const decision = evaluatePurchaseReceiptBeforeInvoiceCost({
    costInputId: "cost-001",
    movement,
    matches: [match("6")],
    commercialFacts: [],
  });
  assert.equal(decision.status, "unresolved");
  assert.equal(decision.reason, "supplier-invoice-cost-unavailable");
  assert.equal(decision.costInput, null);
});
