import assert from "node:assert/strict";
import test from "node:test";

import { createSalesInvoice } from "@argin/sales";
import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  assertSalesStockFulfillmentEligible,
  createSalesCommercialPostingInput,
  createSalesPostingSourceIdentity,
  evaluateSalesStockFulfillmentPrerequisite,
} from "../src/index.ts";

function invoice() {
  return createSalesInvoice({
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
          unitPrice: 300_000,
          priceOrigin: "manual",
        },
      },
    ],
  });
}

function commercial() {
  const source = invoice();
  return createSalesCommercialPostingInput({
    source: createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: source.document.documentId,
      sourceVersion: 1,
    }),
    document: source.document,
    commercialSnapshots: source.commercialSnapshots,
    documentTotals: source.totals,
  });
}

function confirmedEvidence() {
  return [{
    companyId: "company-001",
    inventoryDocumentId: "issue-001",
    inventoryDocumentStatus: "confirmed",
    inventoryLineId: "issue-line-001",
    sourceSystem: "sales",
    sourceDocumentType: "sales-invoice",
    sourceDocumentId: "sales-invoice-001",
    sourceLineId: "stock-1",
    productId: "product-001",
  }] as const;
}

test("requires confirmed Inventory Issue evidence for stock lines", () => {
  const waiting = evaluateSalesStockFulfillmentPrerequisite(commercial(), []);
  assert.equal(waiting.hasStockLines, true);
  assert.equal(waiting.cogsEligible, false);
  assert.equal(waiting.lines[0]!.status, "waiting-for-issue");
  assert.equal(waiting.lines[1]!.status, "not-required");

  const confirmed = evaluateSalesStockFulfillmentPrerequisite(
    commercial(),
    confirmedEvidence(),
  );
  assert.equal(confirmed.cogsEligible, true);
  assert.equal(confirmed.lines[0]!.status, "eligible");
  assert.equal(confirmed.lines[0]!.inventoryDocumentId, "issue-001");
});

test("blocks COGS while Inventory Issue is not confirmed", () => {
  const result = evaluateSalesStockFulfillmentPrerequisite(commercial(), [{
    ...confirmedEvidence()[0],
    inventoryDocumentStatus: "approved",
  }]);

  assert.equal(result.cogsEligible, false);
  assert.equal(result.lines[0]!.status, "waiting-for-confirmation");

  assert.throws(
    () => assertSalesStockFulfillmentEligible(result),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentBlocked,
  );
});

test("service-only invoice bypasses Inventory fulfillment", () => {
  const source = createSalesInvoice({
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
      sourceDocumentId: source.document.documentId,
      sourceVersion: 1,
    }),
    document: source.document,
    commercialSnapshots: source.commercialSnapshots,
    documentTotals: source.totals,
  });

  const result = evaluateSalesStockFulfillmentPrerequisite(input, []);
  assert.equal(result.hasStockLines, false);
  assert.equal(result.cogsEligible, true);
  assert.equal(result.lines[0]!.status, "not-required");
  assert.doesNotThrow(() => assertSalesStockFulfillmentEligible(result));
});

test("rejects evidence attached to a service/non-stock line", () => {
  assert.throws(
    () => evaluateSalesStockFulfillmentPrerequisite(commercial(), [{
      ...confirmedEvidence()[0],
      sourceLineId: "service-1",
      inventoryLineId: "issue-line-service",
      productId: "service-001",
    }]),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentInvalid
      && error.field === "evidence.nonStockLine",
  );
});

test("rejects cross-company or mismatched source lineage", () => {
  for (const evidence of [
    { ...confirmedEvidence()[0], companyId: "company-999" },
    { ...confirmedEvidence()[0], sourceDocumentId: "another-invoice" },
    { ...confirmedEvidence()[0], productId: "another-product" },
  ]) {
    assert.throws(
      () => evaluateSalesStockFulfillmentPrerequisite(commercial(), [evidence]),
      (error: unknown) =>
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentInvalid
        && error.field === "evidence.lineage",
    );
  }
});

test("rejects duplicate or unknown Sales line evidence", () => {
  assert.throws(
    () => evaluateSalesStockFulfillmentPrerequisite(
      commercial(),
      [confirmedEvidence()[0], confirmedEvidence()[0]],
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentInvalid
      && error.field === "evidence.sourceLineId",
  );

  assert.throws(
    () => evaluateSalesStockFulfillmentPrerequisite(commercial(), [{
      ...confirmedEvidence()[0],
      sourceLineId: "unknown-line",
    }]),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentInvalid
      && error.field === "evidence.sourceLineId",
  );
});

test("does not treat selling price as stock-cost evidence", () => {
  const result = evaluateSalesStockFulfillmentPrerequisite(
    commercial(),
    confirmedEvidence(),
  );

  const stock = result.lines[0]!;
  assert.equal("cost" in stock, false);
  assert.equal("unitPrice" in stock, false);
  assert.equal("cogs" in stock, false);
});
