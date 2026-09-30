import assert from "node:assert/strict";
import test from "node:test";
import { SALES_DOCUMENT_TYPES, SalesDomainError, createSalesDocument, createSalesDocumentLine } from "../src/index.ts";

test("exposes the four Phase 24 commercial document types", () => {
  assert.deepEqual(SALES_DOCUMENT_TYPES, ["sales-order", "sales-invoice", "sales-return", "sales-correction"]);
});

test("creates a Sales aggregate with durable customer/product references and sorted lines", () => {
  const document = createSalesDocument({
    documentId: "sale-1", documentType: "sales-invoice", companyId: "company-1", branchId: "branch-1",
    fiscalYearId: "fy-1", customerPartyId: "party-1", businessDate: "2026-09-30",
    lines: [
      { lineId: "line-2", position: 2, lineKind: "service", productId: "service-1" },
      { lineId: "line-1", position: 1, lineKind: "stock-product", productId: "product-1" },
    ],
  });
  assert.equal(document.customer.partyId, "party-1");
  assert.equal(document.lines[0]?.item.productId, "product-1");
  assert.equal(document.lines[0]?.item.itemType, "product");
  assert.equal(document.lines[1]?.item.itemType, "service");
  assert.equal(document.scope.companyId, "company-1");
});

test("rejects duplicate line identities and positions", () => {
  const base = { documentId: "sale-1", documentType: "sales-order" as const, companyId: "c", branchId: "b", fiscalYearId: "f", customerPartyId: "p", businessDate: "2026-09-30" };
  assert.throws(() => createSalesDocument({ ...base, lines: [
    { lineId: "x", position: 1, lineKind: "stock-product", productId: "p1" },
    { lineId: "x", position: 2, lineKind: "stock-product", productId: "p2" },
  ]}), (error: unknown) => error instanceof SalesDomainError && error.code === "sales.duplicate_line_id");
  assert.throws(() => createSalesDocument({ ...base, lines: [
    { lineId: "x", position: 1, lineKind: "stock-product", productId: "p1" },
    { lineId: "y", position: 1, lineKind: "service", productId: "s1" },
  ]}), (error: unknown) => error instanceof SalesDomainError && error.code === "sales.duplicate_line_position");
});

test("enforces stock/product/service classification and valid business date", () => {
  assert.throws(() => createSalesDocumentLine({ lineId: "l", position: 1, lineKind: "service", productId: "s", itemType: "product" }),
    (error: unknown) => error instanceof SalesDomainError && error.code === "sales.line_classification_invalid");
  assert.throws(() => createSalesDocument({ documentId: "d", documentType: "sales-invoice", companyId: "c", branchId: "b", fiscalYearId: "f", customerPartyId: "p", businessDate: "2026-02-30" }),
    (error: unknown) => error instanceof SalesDomainError && error.code === "sales.business_date_invalid");
});

test("does not introduce selling price, inventory cost or posting state in Step 2 aggregate", () => {
  const document = createSalesDocument({ documentId: "d", documentType: "sales-order", companyId: "c", branchId: "b", fiscalYearId: "f", customerPartyId: "p", businessDate: "2026-09-30" });
  assert.equal("unitPrice" in document, false);
  assert.equal("inventoryCost" in document, false);
  assert.equal("journalVoucherId" in document, false);
});
