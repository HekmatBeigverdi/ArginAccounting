import assert from "node:assert/strict";
import test from "node:test";
import { SalesDomainError, createSalesCorrection } from "../src/index.ts";

const customer = { partyId: "party-1", code: "C-1", displayName: "Customer" };

function input() {
  return {
    documentId: "cor-1", companyId: "company-1", branchId: "branch-1", fiscalYearId: "fy-1",
    customer, documentNumber: "COR-0001", businessDate: "2026-10-01", capturedAt: "2026-10-01T12:00:00Z",
    relatedDocumentReference: { documentId: "inv-1", relationType: "sales-invoice" },
    lines: [{
      lineId: "line-1", position: 1, lineKind: "stock-product" as const, productId: "product-1",
      sourceReference: { sourceSystem: "sales", sourceDocumentId: "inv-1", sourceLineId: "inv-line-1" },
      commercialTerms: {
        quantity: 2, currency: "IRR", unitPrice: 120, priceOrigin: "manual" as const,
        discounts: [{ id: "d", mode: "percent" as const, value: 500 }],
        charges: [], taxes: [{ taxId: "vat", rateBasisPoints: 1000 }],
      },
    }],
  };
}

test("creates an independent correction linked to the originating invoice and line", () => {
  const correction = createSalesCorrection(input());
  assert.equal(correction.document.documentType, "sales-correction");
  assert.equal(correction.document.documentId, "cor-1");
  assert.equal(correction.document.relatedDocumentReference?.documentId, "inv-1");
  assert.equal(correction.document.lines[0]?.sourceReference?.sourceLineId, "inv-line-1");
  assert.equal(correction.commercialSnapshots[0]?.snapshotId, "cor-1:line-1:commercial");
  assert.equal(correction.commercialSnapshots[0]?.terms.unitPrice, 120);
});

test("rejects an empty sales correction", () => {
  assert.throws(() => createSalesCorrection({ ...input(), lines: [] }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.correction_lines_required");
});

test("requires an originating sales invoice", () => {
  assert.throws(() => createSalesCorrection({ ...input(), relatedDocumentReference: null }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.correction_invoice_required");
  assert.throws(() => createSalesCorrection({
    ...input(), relatedDocumentReference: { documentId: "so-1", relationType: "sales-order" },
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.correction_invoice_required");
});

test("requires every correction line to reference the same originating invoice", () => {
  const base = input();
  assert.throws(() => createSalesCorrection({
    ...base, lines: [{ ...base.lines[0]!, sourceReference: null }],
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.correction_invoice_line_required");
  assert.throws(() => createSalesCorrection({
    ...base,
    lines: [{ ...base.lines[0]!, sourceReference: { sourceSystem: "sales", sourceDocumentId: "inv-2", sourceLineId: "line-x" } }],
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.correction_invoice_line_required");
});

test("rejects correction lines without corrected commercial terms", () => {
  const base = input();
  assert.throws(() => createSalesCorrection({
    ...base,
    lines: [{
      lineId: "line-x", position: 1, lineKind: "stock-product", productId: "product-x",
      sourceReference: { sourceSystem: "sales", sourceDocumentId: "inv-1", sourceLineId: "inv-line-x" },
    }],
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.commercial_terms_required");
});

test("correction creation does not mutate history or directly post accounting/inventory", () => {
  const correction = createSalesCorrection(input());
  assert.equal("replacesInvoice" in correction, false);
  assert.equal("inventoryMovementId" in correction, false);
  assert.equal("accountsReceivableAdjustment" in correction, false);
  assert.equal("journalVoucherId" in correction, false);
});
