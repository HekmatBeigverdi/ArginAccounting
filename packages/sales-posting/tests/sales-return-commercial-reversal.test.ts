import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesReturnCommercialLineage,
  reverseSalesReturnCommercialPosting,
} from "../src/index.ts";

function returnDocument() {
  return {
    documentId: "return-001",
    documentType: "sales-return",
    scope: { companyId: "company-001", branchId: "branch-001", fiscalYearId: "fy-1405" },
    customer: { partyId: "customer-001", code: "C1", displayName: "Customer" },
    documentNumber: "SR-001",
    businessDate: "2026-10-07",
    description: "Customer return",
    sourceReference: null,
    relatedDocumentReference: {
      documentId: "invoice-001",
      lineId: null,
      relationType: "sales-invoice",
    },
    lines: [{
      lineId: "return-line-1",
      position: 1,
      lineKind: "stock-product",
      item: { productId: "product-001", itemType: "product" },
      description: "Returned item",
      sourceReference: {
        sourceSystem: "sales",
        sourceDocumentId: "invoice-001",
        sourceLineId: "invoice-line-1",
      },
      commercialTerms: null,
    }],
  } as any;
}

function commercialInput() {
  return {
    source: {
      sourceSystem: "sales",
      sourceType: "sales-return",
      sourceDocumentId: "return-001",
      sourceVersion: 2,
      externalReference: null,
    },
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    customerPartyId: "customer-001",
    businessDate: "2026-10-07",
    currency: "IRR",
    documentTotals: {
      currency: "IRR",
      lineCount: 1,
      grossAmount: 100,
      discountAmount: 0,
      netAfterDiscount: 100,
      chargeAmount: 0,
      taxBaseAmount: 100,
      taxAmount: 10,
      grandTotal: 110,
    },
    lines: [{
      snapshotId: "snap-return-1",
      lineId: "return-line-1",
      productId: "product-001",
      lineKind: "stock-product",
      capturedAt: "2026-10-07T10:00:00.000Z",
      terms: {} as any,
      totals: {
        currency: "IRR",
        grossAmount: 100,
        discountAmount: 0,
        netAfterDiscount: 100,
        chargeAmount: 0,
        taxBaseAmount: 100,
        taxAmount: 10,
        grandTotal: 110,
      },
    }],
  } as any;
}

function forwardCommercialPosting() {
  return {
    currency: "IRR",
    totalDebit: 110,
    totalCredit: 110,
    balanced: true,
    components: [
      {
        componentId: "commercial:accounts-receivable",
        role: "accounts-receivable",
        side: "debit",
        accountId: "ar",
        amount: 110,
        currency: "IRR",
        sourceLineId: null,
        customerPartyId: "customer-001",
        taxIds: [],
        taxCodes: [],
      },
      {
        componentId: "commercial:revenue:return-line-1",
        role: "sales-revenue",
        side: "credit",
        accountId: "revenue",
        amount: 100,
        currency: "IRR",
        sourceLineId: "return-line-1",
        customerPartyId: null,
        taxIds: [],
        taxCodes: [],
      },
      {
        componentId: "commercial:output-vat:return-line-1",
        role: "output-vat",
        side: "credit",
        accountId: "output-vat",
        amount: 10,
        currency: "IRR",
        sourceLineId: "return-line-1",
        customerPartyId: null,
        taxIds: ["vat-1"],
        taxCodes: ["VAT"],
      },
    ],
  } as any;
}

test("builds exact return-to-original-invoice lineage", () => {
  const lineage = createSalesReturnCommercialLineage(returnDocument());
  assert.equal(lineage.returnDocumentId, "return-001");
  assert.equal(lineage.originalInvoiceId, "invoice-001");
  assert.deepEqual(lineage.lines, [{
    returnLineId: "return-line-1",
    originalInvoiceLineId: "invoice-line-1",
    productId: "product-001",
  }]);
});

test("reverses AR, Revenue and Output VAT directions without changing amounts", () => {
  const result = reverseSalesReturnCommercialPosting({
    commercialInput: commercialInput(),
    commercialPosting: forwardCommercialPosting(),
    lineage: createSalesReturnCommercialLineage(returnDocument()),
  });

  assert.equal(result.totalDebit, 110);
  assert.equal(result.totalCredit, 110);
  assert.deepEqual(
    result.components.map((x) => [x.role, x.side, x.amount]),
    [
      ["accounts-receivable", "credit", 110],
      ["sales-revenue", "debit", 100],
      ["output-vat", "debit", 10],
    ],
  );
});

test("preserves original invoice and line provenance", () => {
  const result = reverseSalesReturnCommercialPosting({
    commercialInput: commercialInput(),
    commercialPosting: forwardCommercialPosting(),
    lineage: createSalesReturnCommercialLineage(returnDocument()),
  });

  const revenue = result.components.find((x) => x.role === "sales-revenue")!;
  assert.equal(revenue.returnLineId, "return-line-1");
  assert.equal(revenue.originalInvoiceId, "invoice-001");
  assert.equal(revenue.originalInvoiceLineId, "invoice-line-1");

  const ar = result.components.find((x) => x.role === "accounts-receivable")!;
  assert.equal(ar.originalInvoiceId, "invoice-001");
  assert.equal(ar.originalInvoiceLineId, null);
});

test("rejects return without valid original sales invoice reference", () => {
  assert.throws(
    () => createSalesReturnCommercialLineage({
      ...returnDocument(),
      relatedDocumentReference: null,
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnLineageInvalid,
  );
});

test("rejects return line whose source does not point to original invoice", () => {
  assert.throws(
    () => createSalesReturnCommercialLineage({
      ...returnDocument(),
      lines: [{
        ...returnDocument().lines[0],
        sourceReference: {
          sourceSystem: "sales",
          sourceDocumentId: "other-invoice",
          sourceLineId: "invoice-line-1",
        },
      }],
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnLineageInvalid,
  );
});

test("rejects product/lineage mismatch between return facts and document", () => {
  const lineage = createSalesReturnCommercialLineage(returnDocument());
  assert.throws(
    () => reverseSalesReturnCommercialPosting({
      commercialInput: {
        ...commercialInput(),
        lines: [{
          ...commercialInput().lines[0],
          productId: "other-product",
        }],
      },
      commercialPosting: forwardCommercialPosting(),
      lineage,
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnLineageInvalid,
  );
});

test("Step 21 does not create inventory cost restoration or Journal artifacts", () => {
  const result = reverseSalesReturnCommercialPosting({
    commercialInput: commercialInput(),
    commercialPosting: forwardCommercialPosting(),
    lineage: createSalesReturnCommercialLineage(returnDocument()),
  });

  assert.equal("costComponents" in result, false);
  assert.equal("inventoryReceiptId" in result, false);
  assert.equal("valuationEntryId" in result, false);
  assert.equal("journalVoucherId" in result, false);
});
