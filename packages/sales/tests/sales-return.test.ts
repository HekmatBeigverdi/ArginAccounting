import assert from "node:assert/strict";
import test from "node:test";
import { SalesDomainError, createSalesReturn } from "../src/index.ts";

const customer = { partyId: "party-1", code: "C-1", displayName: "Customer" };

function input() {
  return {
    documentId: "ret-1", companyId: "company-1", branchId: "branch-1", fiscalYearId: "fy-1",
    customer, documentNumber: "RET-0001", businessDate: "2026-10-01", capturedAt: "2026-10-01T12:00:00Z",
    relatedDocumentReference: { documentId: "inv-1", relationType: "sales-invoice" },
    lines: [{
      lineId: "line-1", position: 1, lineKind: "stock-product" as const, productId: "product-1",
      sourceReference: { sourceSystem: "sales", sourceDocumentId: "inv-1", sourceLineId: "inv-line-1" },
      commercialTerms: {
        quantity: 1, currency: "IRR", unitPrice: 100, priceOrigin: "manual" as const,
        discounts: [{ id: "d", mode: "percent" as const, value: 1000 }],
        charges: [{ id: "c", mode: "amount" as const, value: 20 }],
        taxes: [{ taxId: "vat", rateBasisPoints: 1000 }],
      },
    }],
  };
}

test("creates a sales return linked to the originating invoice and invoice line", () => {
  const salesReturn = createSalesReturn(input());
  assert.equal(salesReturn.document.documentType, "sales-return");
  assert.equal(salesReturn.document.relatedDocumentReference?.documentId, "inv-1");
  assert.equal(salesReturn.document.lines[0]?.sourceReference?.sourceLineId, "inv-line-1");
  assert.equal(salesReturn.commercialSnapshots[0]?.snapshotId, "ret-1:line-1:commercial");
  assert.equal(salesReturn.totals.lineCount, 1);
});

test("rejects an empty sales return", () => {
  assert.throws(() => createSalesReturn({ ...input(), lines: [] }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.return_lines_required");
});

test("requires the originating sales invoice at document level", () => {
  assert.throws(() => createSalesReturn({ ...input(), relatedDocumentReference: null }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.return_invoice_required");
  assert.throws(() => createSalesReturn({
    ...input(),
    relatedDocumentReference: { documentId: "so-1", relationType: "sales-order" },
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.return_invoice_required");
});

test("requires every return line to reference a line of the same originating invoice", () => {
  const base = input();
  assert.throws(() => createSalesReturn({
    ...base,
    lines: [{ ...base.lines[0]!, sourceReference: null }],
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.return_invoice_line_required");

  assert.throws(() => createSalesReturn({
    ...base,
    lines: [{
      ...base.lines[0]!,
      sourceReference: { sourceSystem: "sales", sourceDocumentId: "another-invoice", sourceLineId: "line-x" },
    }],
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.return_invoice_line_required");
});

test("rejects return lines without commercial terms", () => {
  const base = input();
  assert.throws(() => createSalesReturn({
    ...base,
    lines: [{
      lineId: "line-x", position: 1, lineKind: "stock-product", productId: "product-x",
      sourceReference: { sourceSystem: "sales", sourceDocumentId: "inv-1", sourceLineId: "inv-line-x" },
    }],
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.commercial_terms_required");
});

test("sales return creation has no direct inventory receipt or accounting side effect", () => {
  const salesReturn = createSalesReturn(input());
  assert.equal("inventoryReceiptId" in salesReturn, false);
  assert.equal("cogsReversal" in salesReturn, false);
  assert.equal("accountsReceivableAdjustment" in salesReturn, false);
  assert.equal("journalVoucherId" in salesReturn, false);
});
