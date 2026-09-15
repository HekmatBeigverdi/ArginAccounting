import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  createPurchaseReceiptInvoiceMatch,
  summarizePurchaseInvoiceLineMatching,
} from "../src/index.ts";

const invoiceLine = {
  companyId: "company-001",
  documentId: "invoice-001",
  lineId: "invoice-line-001",
  documentType: "supplier-invoice" as const,
  status: "confirmed" as const,
  productId: "product-001",
  baseQuantity: "10",
};

const receiptLine = {
  companyId: "company-001",
  documentId: "receipt-001",
  lineId: "receipt-line-001",
  documentType: "receipt" as const,
  status: "confirmed" as const,
  productId: "product-001",
  baseQuantity: "6",
};

function assertDomainError(action: () => unknown, code: string, field: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("creates a durable partial receipt/invoice line match using base quantity", () => {
  const match = createPurchaseReceiptInvoiceMatch({
    matchId: "match-001",
    invoiceLine,
    receiptLine,
    matchedBaseQuantity: "4.000",
    existingMatches: [],
  });

  assert.equal(match.matchedBaseQuantity, "4");
  assert.equal(match.invoiceDocumentId, "invoice-001");
  assert.equal(match.receiptDocumentId, "receipt-001");
  assert.ok(Object.isFrozen(match));

  assert.deepEqual(
    summarizePurchaseInvoiceLineMatching(invoiceLine, [match]),
    {
      status: "partially-matched",
      invoiceBaseQuantity: "10",
      matchedBaseQuantity: "4",
      remainingBaseQuantity: "6",
      matchCount: 1,
    },
  );
});

test("requires confirmed supplier invoice and confirmed inventory receipt facts", () => {
  assertDomainError(
    () => createPurchaseReceiptInvoiceMatch({
      matchId: "match-002",
      invoiceLine: { ...invoiceLine, status: "approved" },
      receiptLine,
      matchedBaseQuantity: "1",
      existingMatches: [],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.matchingIneligible,
    "invoiceLine.status",
  );

  assertDomainError(
    () => createPurchaseReceiptInvoiceMatch({
      matchId: "match-003",
      invoiceLine,
      receiptLine: { ...receiptLine, documentType: "issue" as "receipt", status: "confirmed" },
      matchedBaseQuantity: "1",
      existingMatches: [],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.matchingIneligible,
    "receiptLine.documentType",
  );
});

test("rejects cross-company/product matches and duplicate invoice/receipt line pairs", () => {
  assertDomainError(
    () => createPurchaseReceiptInvoiceMatch({
      matchId: "match-004",
      invoiceLine,
      receiptLine: { ...receiptLine, productId: "product-002" },
      matchedBaseQuantity: "1",
      existingMatches: [],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.matchingMismatch,
    "productId",
  );

  const existing = createPurchaseReceiptInvoiceMatch({
    matchId: "match-existing",
    invoiceLine,
    receiptLine,
    matchedBaseQuantity: "2",
    existingMatches: [],
  });

  assertDomainError(
    () => createPurchaseReceiptInvoiceMatch({
      matchId: "match-duplicate",
      invoiceLine,
      receiptLine,
      matchedBaseQuantity: "1",
      existingMatches: [existing],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.duplicateMatch,
    "receiptLine.lineId",
  );
});

test("prevents over-matching either the invoice line or receipt line and derives full status", () => {
  const firstReceipt = createPurchaseReceiptInvoiceMatch({
    matchId: "match-005",
    invoiceLine,
    receiptLine,
    matchedBaseQuantity: "6",
    existingMatches: [],
  });

  const secondReceiptLine = {
    ...receiptLine,
    documentId: "receipt-002",
    lineId: "receipt-line-002",
    baseQuantity: "4",
  };
  const second = createPurchaseReceiptInvoiceMatch({
    matchId: "match-006",
    invoiceLine,
    receiptLine: secondReceiptLine,
    matchedBaseQuantity: "4",
    existingMatches: [firstReceipt],
  });

  assert.equal(
    summarizePurchaseInvoiceLineMatching(invoiceLine, [firstReceipt, second]).status,
    "fully-matched",
  );

  assertDomainError(
    () => createPurchaseReceiptInvoiceMatch({
      matchId: "match-007",
      invoiceLine,
      receiptLine: { ...receiptLine, documentId: "receipt-003", lineId: "receipt-line-003", baseQuantity: "5" },
      matchedBaseQuantity: "1",
      existingMatches: [firstReceipt, second],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.overMatch,
    "invoiceLine.baseQuantity",
  );

  assertDomainError(
    () => createPurchaseReceiptInvoiceMatch({
      matchId: "match-008",
      invoiceLine: { ...invoiceLine, documentId: "invoice-002", lineId: "invoice-line-002", baseQuantity: "10" },
      receiptLine,
      matchedBaseQuantity: "1",
      existingMatches: [firstReceipt],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.overMatch,
    "receiptLine.baseQuantity",
  );
});

test("reports unmatched invoice lines without inventing receipt facts", () => {
  assert.deepEqual(summarizePurchaseInvoiceLineMatching(invoiceLine, []), {
    status: "unmatched",
    invoiceBaseQuantity: "10",
    matchedBaseQuantity: "0",
    remainingBaseQuantity: "10",
    matchCount: 0,
  });
});
