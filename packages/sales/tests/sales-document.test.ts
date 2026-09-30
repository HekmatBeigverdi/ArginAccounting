import assert from "node:assert/strict";
import test from "node:test";
import { SALES_DOCUMENT_TYPES, SalesDomainError, createSalesCustomerSnapshot, createSalesDocument, createSalesDocumentLine } from "../src/index.ts";

test("exposes the four Phase 24 commercial document types", () => {
  assert.deepEqual(SALES_DOCUMENT_TYPES, ["sales-order", "sales-invoice", "sales-return", "sales-correction"]);
});

test("creates a Sales aggregate with durable customer/product references and sorted lines", () => {
  const document = createSalesDocument({
    documentId: "sale-1", documentType: "sales-invoice", companyId: "company-1", branchId: "branch-1",
    fiscalYearId: "fy-1", customer: { partyId: "party-1", code: "C-1", displayName: "Customer One" }, businessDate: "2026-09-30",
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
  const base = { documentId: "sale-1", documentType: "sales-order" as const, companyId: "c", branchId: "b", fiscalYearId: "f", customer: { partyId: "p", code: "C", displayName: "Customer" }, businessDate: "2026-09-30" };
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
  assert.throws(() => createSalesDocument({ documentId: "d", documentType: "sales-invoice", companyId: "c", branchId: "b", fiscalYearId: "f", customer: { partyId: "p", code: "C", displayName: "Customer" }, businessDate: "2026-02-30" }),
    (error: unknown) => error instanceof SalesDomainError && error.code === "sales.business_date_invalid");
});

test("does not introduce selling price, inventory cost or posting state in Step 2 aggregate", () => {
  const document = createSalesDocument({ documentId: "d", documentType: "sales-order", companyId: "c", branchId: "b", fiscalYearId: "f", customer: { partyId: "p", code: "C", displayName: "Customer" }, businessDate: "2026-09-30" });
  assert.equal("unitPrice" in document, false);
  assert.equal("inventoryCost" in document, false);
  assert.equal("journalVoucherId" in document, false);
});


test("preserves durable source identity independently from commercial document number", () => {
  const document = createSalesDocument({
    documentId: "01J-SALES-DURABLE", documentType: "sales-invoice", companyId: "c", branchId: "b",
    fiscalYearId: "f", customer: { partyId: "party-1", code: "C-1", displayName: "Customer One" }, documentNumber: "INV-1405-0001", businessDate: "2026-09-30",
    sourceReference: { sourceSystem: "legacy-sales", sourceDocumentId: "legacy-42" },
    lines: [{
      lineId: "01J-LINE-DURABLE", position: 1, lineKind: "stock-product", productId: "product-1",
      sourceReference: { sourceSystem: "legacy-sales", sourceDocumentId: "legacy-42", sourceLineId: "7" },
    }],
  });
  assert.equal(document.documentId, "01J-SALES-DURABLE");
  assert.equal(document.documentNumber, "INV-1405-0001");
  assert.equal(document.sourceReference?.sourceDocumentId, "legacy-42");
  assert.equal(document.lines[0]?.sourceReference?.sourceLineId, "7");
});

test("captures explicit related-document lineage by durable IDs", () => {
  const document = createSalesDocument({
    documentId: "return-1", documentType: "sales-return", companyId: "c", branchId: "b", fiscalYearId: "f",
    customer: { partyId: "p", code: "C", displayName: "Customer" }, businessDate: "2026-09-30",
    relatedDocumentReference: { documentId: "invoice-1", lineId: "invoice-line-1", relationType: "returns" },
  });
  assert.deepEqual(document.relatedDocumentReference, {
    documentId: "invoice-1", lineId: "invoice-line-1", relationType: "returns",
  });
});

test("rejects Sales self references while allowing external source identity", () => {
  const base = { documentId: "sale-1", documentType: "sales-correction" as const, companyId: "c", branchId: "b", fiscalYearId: "f", customer: { partyId: "p", code: "C", displayName: "Customer" }, businessDate: "2026-09-30" };
  assert.throws(() => createSalesDocument({ ...base, sourceReference: { sourceSystem: "sales", sourceDocumentId: "sale-1" } }),
    (error: unknown) => error instanceof SalesDomainError && error.code === "sales.self_reference");
  assert.throws(() => createSalesDocument({ ...base, relatedDocumentReference: { documentId: "sale-1", relationType: "corrects" } }),
    (error: unknown) => error instanceof SalesDomainError && error.code === "sales.self_reference");
  const external = createSalesDocument({ ...base, sourceReference: { sourceSystem: "bridge-import", sourceDocumentId: "sale-1" } });
  assert.equal(external.sourceReference?.sourceSystem, "bridge-import");
});


test("creates a customer snapshot from the canonical Party selection contract", () => {
  const selectedParty = {
    partyId: "party-customer-1",
    code: "CUS-1001",
    displayName: "شرکت مشتری نمونه",
    classification: "legal-entity" as const,
    roles: ["customer"] as const,
  };
  const snapshot = createSalesCustomerSnapshot(selectedParty);
  assert.deepEqual(snapshot, {
    partyId: "party-customer-1",
    code: "CUS-1001",
    displayName: "شرکت مشتری نمونه",
  });
});

test("requires the Party customer role and never creates a parallel customer identity", () => {
  assert.throws(() => createSalesCustomerSnapshot({
    partyId: "party-supplier-1",
    code: "SUP-1",
    displayName: "Supplier only",
    classification: "legal-entity",
    roles: ["supplier"],
  }), (error: unknown) => error instanceof SalesDomainError && error.code === "sales.customer_role_required");
});

test("persists Party display metadata as a historical snapshot while partyId remains identity", () => {
  const selectedParty = {
    partyId: "party-1", code: "CUS-OLD", displayName: "Old Name",
    classification: "legal-entity" as const, roles: ["customer"] as const,
  };
  const customer = createSalesCustomerSnapshot(selectedParty);
  const document = createSalesDocument({
    documentId: "sale-customer-snapshot", documentType: "sales-order", companyId: "c", branchId: "b",
    fiscalYearId: "f", customer, businessDate: "2026-09-30",
  });
  const changedParty = { ...selectedParty, code: "CUS-NEW", displayName: "New Name" };
  assert.equal(document.customer.partyId, changedParty.partyId);
  assert.equal(document.customer.code, "CUS-OLD");
  assert.equal(document.customer.displayName, "Old Name");
});
