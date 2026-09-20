import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  createPurchaseCommercialTerms,
  createPurchaseReceiptInvoiceMatch,
  createPurchaseInventoryValuationCostInput,
  createPurchaseInventoryValuationCostInputProvider,
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

function terms(quantity = "10", unitPrice = 1000) {
  return createPurchaseCommercialTerms({
    enteredQuantity: quantity,
    enteredUnit: unit,
    baseUnit: unit,
    unitPrice: { amount: unitPrice, currency: "IRR" },
    discounts: [{ kind: "percentage", rateBasisPoints: 1000 }],
    charges: [{ kind: "fixed", amount: { amount: 100, currency: "IRR" } }],
    tax: { treatment: "taxable", rateBasisPoints: 1000 },
  });
}

const invoiceLine = {
  companyId: "company-001",
  documentId: "invoice-001",
  lineId: "invoice-line-001",
  documentType: "supplier-invoice" as const,
  status: "confirmed",
  productId: "product-001",
  baseQuantity: "10",
};

const receiptLine = {
  companyId: "company-001",
  documentId: "receipt-001",
  lineId: "receipt-line-001",
  documentType: "receipt",
  status: "confirmed",
  productId: "product-001",
  baseQuantity: "6",
};

const match = createPurchaseReceiptInvoiceMatch({
  matchId: "match-001",
  invoiceLine,
  receiptLine,
  matchedBaseQuantity: "6",
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
  commercialTerms: terms(),
};

function assertDomainError(action: () => unknown, code: string, field: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("creates a resolved Purchase Cost Input for a fully matched inbound movement and excludes VAT", () => {
  const input = createPurchaseInventoryValuationCostInput({
    costInputId: "purchase-cost-movement-001",
    movement,
    matches: [match],
    commercialFacts: [fact],
  });
  assert.ok(input);
  assert.equal(input.basis.quantity, "6");
  assert.equal(input.basis.baseCost, 5460);
  assert.equal(input.basis.totalCost, 5460);
  assert.equal(input.basis.unitCost, "910");
  assert.equal(input.basis.currency, "IRR");
  assert.equal(input.sources.length, 1);
  assert.equal(input.sources[0]?.purchaseDocumentId, "invoice-001");
});

test("keeps a partially matched movement unresolved instead of silently using zero cost", () => {
  const partial = createPurchaseReceiptInvoiceMatch({
    matchId: "match-partial",
    invoiceLine,
    receiptLine,
    matchedBaseQuantity: "4",
  });
  const input = createPurchaseInventoryValuationCostInput({
    costInputId: "purchase-cost-movement-001",
    movement,
    matches: [partial],
    commercialFacts: [fact],
  });
  assert.equal(input, null);
});

test("allocates invoice tax base deterministically across multiple receipt matches", () => {
  const compactTerms = createPurchaseCommercialTerms({
    enteredQuantity: "3",
    enteredUnit: unit,
    baseUnit: unit,
    unitPrice: { amount: 33, currency: "IRR" },
    discounts: [],
    charges: [{ kind: "fixed", amount: { amount: 1, currency: "IRR" } }],
    tax: { treatment: "taxable", rateBasisPoints: 1000 },
  });
  const compactFact = { ...fact, commercialTerms: compactTerms };
  const invoice = { ...invoiceLine, baseQuantity: "3" };
  const receiptA = { ...receiptLine, documentId: "receipt-a", lineId: "line-a", baseQuantity: "1" };
  const receiptB = { ...receiptLine, documentId: "receipt-b", lineId: "line-b", baseQuantity: "2" };
  const matchA = createPurchaseReceiptInvoiceMatch({ matchId: "a", invoiceLine: invoice, receiptLine: receiptA, matchedBaseQuantity: "1" });
  const matchB = createPurchaseReceiptInvoiceMatch({ matchId: "b", invoiceLine: invoice, receiptLine: receiptB, matchedBaseQuantity: "2", existingMatches: [matchA] });
  const a = createPurchaseInventoryValuationCostInput({
    costInputId: "cost-a",
    movement: { ...movement, movementId: "movement-a", documentId: "receipt-a", lineId: "line-a", quantityDelta: "1" },
    matches: [matchA, matchB],
    commercialFacts: [compactFact],
  });
  const b = createPurchaseInventoryValuationCostInput({
    costInputId: "cost-b",
    movement: { ...movement, movementId: "movement-b", documentId: "receipt-b", lineId: "line-b", quantityDelta: "2" },
    matches: [matchA, matchB],
    commercialFacts: [compactFact],
  });
  assert.equal(a?.basis.baseCost, 33);
  assert.equal(b?.basis.baseCost, 67);
  assert.equal((a?.basis.baseCost ?? 0) + (b?.basis.baseCost ?? 0), 100);
});

test("rejects mismatched or non-stock authoritative Purchase cost facts", () => {
  assertDomainError(
    () => createPurchaseInventoryValuationCostInput({
      costInputId: "bad-cost",
      movement,
      matches: [match],
      commercialFacts: [{ ...fact, lineKind: "service" as const }],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostIneligible,
    "commercialFacts[0].lineKind",
  );
  assertDomainError(
    () => createPurchaseInventoryValuationCostInput({
      costInputId: "bad-cost",
      movement,
      matches: [match],
      commercialFacts: [{ ...fact, productId: "other-product" }],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch,
    "commercialFacts[0].productId",
  );
});

test("adapts linked Purchase cost inputs to the InventoryValuationCostInputProvider contract", async () => {
  const linked = createPurchaseInventoryValuationCostInput({
    costInputId: "purchase-cost-movement-001",
    movement,
    matches: [match],
    commercialFacts: [fact],
  });
  const provider = createPurchaseInventoryValuationCostInputProvider({
    resolve: async (_companyId, requestedMovement) => requestedMovement.movementId === "movement-001" ? linked : null,
  });
  const basis = await provider.getResolvedInboundCostBasis("company-001", movement);
  assert.equal(basis?.movementId, "movement-001");
  assert.equal(basis?.baseCost, 5460);
});
