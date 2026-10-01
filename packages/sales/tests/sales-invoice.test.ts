import assert from "node:assert/strict";
import test from "node:test";
import { SalesDomainError, createSalesInvoice } from "../src/index.ts";

const customer = { partyId: "party-1", code: "C-1", displayName: "Customer" };

function input() {
  return {
    documentId: "inv-1", companyId: "company-1", branchId: "branch-1", fiscalYearId: "fy-1",
    customer, documentNumber: "INV-0001", businessDate: "2026-10-01", capturedAt: "2026-10-01T12:00:00Z",
    relatedDocumentReference: { documentId: "so-1", relationType: "sales-order" },
    lines: [{
      lineId: "line-1", position: 1, lineKind: "stock-product" as const, productId: "product-1",
      sourceReference: { sourceSystem: "sales", sourceDocumentId: "so-1", sourceLineId: "so-line-1" },
      commercialTerms: {
        quantity: 2.5, currency: "IRR", unitPrice: 100, priceOrigin: "manual" as const,
        discounts: [{ id: "d", mode: "percent" as const, value: 1000 }],
        charges: [{ id: "c", mode: "amount" as const, value: 20 }],
        taxes: [{ taxId: "vat", rateBasisPoints: 1000 }],
      },
    }],
  };
}

test("creates a sales invoice with immutable commercial facts and totals", () => {
  const invoice = createSalesInvoice(input());
  assert.equal(invoice.document.documentType, "sales-invoice");
  assert.equal(invoice.document.relatedDocumentReference?.documentId, "so-1");
  assert.equal(invoice.document.lines[0]?.sourceReference?.sourceLineId, "so-line-1");
  assert.equal(invoice.commercialSnapshots[0]?.snapshotId, "inv-1:line-1:commercial");
  assert.equal(invoice.totals.grandTotal, 270);
});

test("supports stock non-stock and service invoice lines", () => {
  const base = input();
  const invoice = createSalesInvoice({
    ...base,
    lines: [
      base.lines[0]!,
      { ...base.lines[0]!, lineId: "line-2", position: 2, lineKind: "non-stock-product" as const, productId: "product-2", sourceReference: null },
      { ...base.lines[0]!, lineId: "line-3", position: 3, lineKind: "service" as const, productId: "service-1", itemType: "service" as const, sourceReference: null },
    ],
  });
  assert.equal(invoice.document.lines.length, 3);
  assert.equal(invoice.commercialSnapshots.length, 3);
});

test("rejects an empty sales invoice", () => {
  assert.throws(() => createSalesInvoice({ ...input(), lines: [] }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.invoice_lines_required");
});

test("rejects invoice lines without commercial terms", () => {
  const base = input();
  assert.throws(() => createSalesInvoice({
    ...base,
    lines: [{ lineId: "line-x", position: 1, lineKind: "stock-product", productId: "product-x" }],
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.commercial_terms_required");
});

test("invoice creation does not directly create inventory or accounting effects", () => {
  const invoice = createSalesInvoice(input());
  assert.equal("inventoryIssueId" in invoice, false);
  assert.equal("cogs" in invoice, false);
  assert.equal("accountsReceivable" in invoice, false);
  assert.equal("journalVoucherId" in invoice, false);
});
