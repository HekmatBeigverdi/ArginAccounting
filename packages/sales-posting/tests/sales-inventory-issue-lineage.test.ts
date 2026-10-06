import assert from "node:assert/strict";
import test from "node:test";

import {
  createInventoryDocument,
  confirmInventoryDocument,
  submitInventoryDocument,
  approveInventoryDocument,
} from "@argin/inventory";
import { createSalesInvoice } from "@argin/sales";
import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesCommercialPostingInput,
  createSalesPostingSourceIdentity,
  evaluateSalesStockFulfillmentPrerequisite,
  resolveSalesInventoryIssueLineage,
} from "../src/index.ts";

function commercial() {
  const invoice = createSalesInvoice({
    documentId: "sales-invoice-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    customer: {
      partyId: "customer-001",
      code: "C-001",
      displayName: "Customer",
    },
    businessDate: "2026-10-06",
    capturedAt: "2026-10-06T12:00:00.000Z",
    lines: [
      {
        lineId: "stock-1",
        position: 1,
        lineKind: "stock-product",
        productId: "product-001",
        commercialTerms: {
          quantity: 2,
          currency: "IRR",
          unitPrice: 1_000_000,
          priceOrigin: "manual",
        },
      },
      {
        lineId: "service-1",
        position: 2,
        lineKind: "service",
        productId: "service-001",
        commercialTerms: {
          quantity: 1,
          currency: "IRR",
          unitPrice: 100_000,
          priceOrigin: "manual",
        },
      },
    ],
  });

  return createSalesCommercialPostingInput({
    source: createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: invoice.document.documentId,
      sourceVersion: 1,
    }),
    document: invoice.document,
    commercialSnapshots: invoice.commercialSnapshots,
    documentTotals: invoice.totals,
  });
}

function confirmedIssue() {
  let issue = createInventoryDocument({
    documentId: "issue-001",
    companyId: "company-001",
    documentType: "issue",
    businessDate: "2026-10-06",
    createdAt: "2026-10-06T12:10:00.000Z",
    sourceReference: {
      companyId: "company-001",
      sourceSystem: "sales",
      documentType: "sales-invoice",
      documentId: "sales-invoice-001",
      lineId: null,
    },
    lines: [{
      lineId: "inventory-line-001",
      position: 1,
      productId: "product-001",
      sourceReference: {
        companyId: "company-001",
        sourceSystem: "sales",
        documentType: "sales-invoice",
        documentId: "sales-invoice-001",
        lineId: "stock-1",
      },
    }],
  });

  issue = submitInventoryDocument(issue, {
    occurredAt: "2026-10-06T12:11:00.000Z",
    actorUserId: "user-1",
  });
  issue = approveInventoryDocument(issue, {
    occurredAt: "2026-10-06T12:12:00.000Z",
    actorUserId: "user-1",
  });
  issue = confirmInventoryDocument(issue, {
    occurredAt: "2026-10-06T12:13:00.000Z",
    actorUserId: "user-1",
  });
  return issue;
}

function prerequisite() {
  return evaluateSalesStockFulfillmentPrerequisite(commercial(), [{
    companyId: "company-001",
    inventoryDocumentId: "issue-001",
    inventoryDocumentStatus: "confirmed",
    inventoryLineId: "inventory-line-001",
    sourceSystem: "sales",
    sourceDocumentType: "sales-invoice",
    sourceDocumentId: "sales-invoice-001",
    sourceLineId: "stock-1",
    productId: "product-001",
  }]);
}

test("resolves exact confirmed Inventory Issue and source-line lineage", async () => {
  const issue = confirmedIssue();
  const result = await resolveSalesInventoryIssueLineage(
    commercial(),
    prerequisite(),
    {
      async findById(companyId, documentId) {
        assert.equal(companyId, "company-001");
        assert.equal(documentId, "issue-001");
        return issue;
      },
    },
  );

  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0]!.salesLineId, "stock-1");
  assert.equal(result.lines[0]!.inventoryDocumentId, "issue-001");
  assert.equal(result.lines[0]!.inventoryLineId, "inventory-line-001");
  assert.equal(result.lines[0]!.confirmedAt, "2026-10-06T12:13:00.000Z");
  assert.equal(result.lines[0]!.inventoryDocumentVersion, issue.version);
});

test("service-only lineage result is empty", async () => {
  const invoice = createSalesInvoice({
    documentId: "service-invoice",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    customer: {
      partyId: "customer-001",
      code: "C-001",
      displayName: "Customer",
    },
    businessDate: "2026-10-06",
    capturedAt: "2026-10-06T12:00:00.000Z",
    lines: [{
      lineId: "service-only",
      position: 1,
      lineKind: "service",
      productId: "service-001",
      commercialTerms: {
        quantity: 1,
        currency: "IRR",
        unitPrice: 100_000,
        priceOrigin: "manual",
      },
    }],
  });
  const input = createSalesCommercialPostingInput({
    source: createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: invoice.document.documentId,
      sourceVersion: 1,
    }),
    document: invoice.document,
    commercialSnapshots: invoice.commercialSnapshots,
    documentTotals: invoice.totals,
  });
  const pre = evaluateSalesStockFulfillmentPrerequisite(input, []);

  const result = await resolveSalesInventoryIssueLineage(input, pre, {
    async findById() {
      throw new Error("reader should not be called");
    },
  });

  assert.deepEqual(result.lines, []);
});

test("rejects missing Inventory Issue document", async () => {
  await assert.rejects(
    () => resolveSalesInventoryIssueLineage(
      commercial(),
      prerequisite(),
      { async findById() { return null; } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageMissing
      && error.field === "inventoryDocument",
  );
});

test("rejects wrong document type, status, company or source document", async () => {
  const issue = confirmedIssue();

  for (const invalid of [
    { ...issue, documentType: "receipt" as const },
    { ...issue, status: "approved" as const },
    { ...issue, companyId: "company-999" },
    {
      ...issue,
      sourceReference: {
        ...issue.sourceReference!,
        documentId: "another-invoice",
      },
    },
  ]) {
    await assert.rejects(
      () => resolveSalesInventoryIssueLineage(
        commercial(),
        prerequisite(),
        { async findById() { return invalid; } },
      ),
      (error: unknown) =>
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid,
    );
  }
});

test("rejects missing or ambiguous Inventory line source lineage", async () => {
  const issue = confirmedIssue();

  const noMatch = {
    ...issue,
    lines: issue.lines.map((line) => ({
      ...line,
      sourceReference: {
        ...line.sourceReference!,
        lineId: "another-sales-line",
      },
    })),
  };

  await assert.rejects(
    () => resolveSalesInventoryIssueLineage(
      commercial(),
      prerequisite(),
      { async findById() { return noMatch; } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageMissing,
  );

  const duplicateLine = {
    ...issue.lines[0]!,
    lineId: "inventory-line-002",
  };
  const ambiguous = {
    ...issue,
    lines: [issue.lines[0]!, duplicateLine],
  };

  await assert.rejects(
    () => resolveSalesInventoryIssueLineage(
      commercial(),
      prerequisite(),
      { async findById() { return ambiguous; } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageAmbiguous,
  );
});

test("rejects product mismatch and prerequisite inventory-line mismatch", async () => {
  const issue = confirmedIssue();
  const wrongProduct = {
    ...issue,
    lines: [{
      ...issue.lines[0]!,
      productId: "another-product",
    }],
  };

  await assert.rejects(
    () => resolveSalesInventoryIssueLineage(
      commercial(),
      prerequisite(),
      { async findById() { return wrongProduct; } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid
      && error.field === "inventoryDocument.lines.productId",
  );

  const badPrerequisite = {
    ...prerequisite(),
    lines: prerequisite().lines.map((line) =>
      line.salesLineId === "stock-1"
        ? { ...line, inventoryLineId: "wrong-inventory-line" }
        : line,
    ),
  };

  await assert.rejects(
    () => resolveSalesInventoryIssueLineage(
      commercial(),
      badPrerequisite,
      { async findById() { return issue; } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid
      && error.field === "prerequisite.inventoryLineId",
  );
});

test("blocks lineage resolution when stock prerequisite is not eligible", async () => {
  const blocked = evaluateSalesStockFulfillmentPrerequisite(commercial(), []);

  await assert.rejects(
    () => resolveSalesInventoryIssueLineage(
      commercial(),
      blocked,
      { async findById() { return confirmedIssue(); } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentBlocked,
  );
});
