import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  orchestrateServiceOnlySalesInvoicePosting,
} from "../src/index.ts";

function commercialInput() {
  return {
    source: {
      sourceSystem: "sales",
      sourceType: "sales-invoice",
      sourceDocumentId: "service-invoice-001",
      sourceVersion: 1,
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
      lineCount: 2,
      grossAmount: 1_500_000,
      discountAmount: 0,
      netAfterDiscount: 1_500_000,
      chargeAmount: 0,
      taxBaseAmount: 1_500_000,
      taxAmount: 0,
      grandTotal: 1_500_000,
    },
    lines: [
      {
        snapshotId: "snap-service-1",
        lineId: "service-1",
        productId: "service-product-001",
        lineKind: "service",
        capturedAt: "2026-10-07T08:00:00.000Z",
        terms: { taxes: [] },
        totals: {
          currency: "IRR",
          grossAmount: 1_000_000,
          discountAmount: 0,
          netAfterDiscount: 1_000_000,
          chargeAmount: 0,
          taxBaseAmount: 1_000_000,
          taxAmount: 0,
          grandTotal: 1_000_000,
        },
      },
      {
        snapshotId: "snap-service-2",
        lineId: "service-2",
        productId: "service-product-002",
        lineKind: "service",
        capturedAt: "2026-10-07T08:00:00.000Z",
        terms: { taxes: [] },
        totals: {
          currency: "IRR",
          grossAmount: 500_000,
          discountAmount: 0,
          netAfterDiscount: 500_000,
          chargeAmount: 0,
          taxBaseAmount: 500_000,
          taxAmount: 0,
          grandTotal: 500_000,
        },
      },
    ],
  } as const;
}

function commercialPosting() {
  return {
    currency: "IRR",
    totalDebit: 1_500_000,
    totalCredit: 1_500_000,
    balanced: true,
    components: [
      {
        componentId: "commercial:accounts-receivable",
        role: "accounts-receivable",
        side: "debit",
        accountId: "ar",
        amount: 1_500_000,
        currency: "IRR",
        sourceLineId: null,
        customerPartyId: "customer-001",
        taxIds: [],
        taxCodes: [],
      },
      {
        componentId: "commercial:revenue:service-1",
        role: "sales-revenue",
        side: "credit",
        accountId: "revenue-service",
        amount: 1_000_000,
        currency: "IRR",
        sourceLineId: "service-1",
        customerPartyId: null,
        taxIds: [],
        taxCodes: [],
      },
      {
        componentId: "commercial:revenue:service-2",
        role: "sales-revenue",
        side: "credit",
        accountId: "revenue-service",
        amount: 500_000,
        currency: "IRR",
        sourceLineId: "service-2",
        customerPartyId: null,
        taxIds: [],
        taxCodes: [],
      },
    ],
  } as const;
}

test("posts service-only invoice through commercial leg only", () => {
  const result = orchestrateServiceOnlySalesInvoicePosting({
    commercialInput: commercialInput(),
    commercialPosting: commercialPosting(),
  });

  assert.deepEqual(result.serviceLineIds, ["service-1", "service-2"]);
  assert.equal(result.inventoryRequired, false);
  assert.equal(result.costPostingRequired, false);
  assert.equal(result.commercial.totalDebit, 1_500_000);
  assert.equal(result.commercial.totalCredit, 1_500_000);
});

test("rejects any stock or non-stock-product line from service-only path", () => {
  for (const lineKind of ["stock-product", "non-stock-product"] as const) {
    assert.throws(
      () => orchestrateServiceOnlySalesInvoicePosting({
        commercialInput: {
          ...commercialInput(),
          lines: [{
            ...commercialInput().lines[0],
            lineKind,
          }],
        },
        commercialPosting: commercialPosting(),
      }),
      (error: unknown) =>
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyInvalid
        && error.field === "commercialInput.lines",
    );
  }
});

test("rejects non-invoice source in service-only path", () => {
  assert.throws(
    () => orchestrateServiceOnlySalesInvoicePosting({
      commercialInput: {
        ...commercialInput(),
        source: {
          ...commercialInput().source,
          sourceType: "sales-return",
        },
      },
      commercialPosting: commercialPosting(),
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyInvalid,
  );
});

test("rejects commercial currency mismatch", () => {
  assert.throws(
    () => orchestrateServiceOnlySalesInvoicePosting({
      commercialInput: commercialInput(),
      commercialPosting: {
        ...commercialPosting(),
        currency: "USD",
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyMismatch
      && error.field === "commercial.currency",
  );
});

test("rejects commercial total mismatch", () => {
  assert.throws(
    () => orchestrateServiceOnlySalesInvoicePosting({
      commercialInput: commercialInput(),
      commercialPosting: {
        ...commercialPosting(),
        totalDebit: 1_400_000,
        totalCredit: 1_400_000,
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyMismatch
      && error.field === "commercial.totals",
  );
});

test("rejects unknown commercial source-line references", () => {
  assert.throws(
    () => orchestrateServiceOnlySalesInvoicePosting({
      commercialInput: commercialInput(),
      commercialPosting: {
        ...commercialPosting(),
        components: [
          ...commercialPosting().components,
          {
            ...commercialPosting().components[1],
            componentId: "commercial:revenue:unknown",
            sourceLineId: "unknown-line",
          },
        ],
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyMismatch
      && error.field === "commercial.components.sourceLineId",
  );
});

test("requires commercial revenue coverage for non-zero service lines", () => {
  assert.throws(
    () => orchestrateServiceOnlySalesInvoicePosting({
      commercialInput: commercialInput(),
      commercialPosting: {
        ...commercialPosting(),
        components: commercialPosting().components.filter(
          (component) => component.sourceLineId !== "service-2",
        ),
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyMismatch
      && error.field === "commercial.components.revenue",
  );
});

test("does not expose Inventory, Valuation, COGS or Journal artifacts", () => {
  const result = orchestrateServiceOnlySalesInvoicePosting({
    commercialInput: commercialInput(),
    commercialPosting: commercialPosting(),
  });

  assert.equal("inventoryDocumentId" in result, false);
  assert.equal("movementId" in result, false);
  assert.equal("valuationEntryId" in result, false);
  assert.equal("costComponents" in result, false);
  assert.equal("journalVoucherId" in result, false);
  assert.equal("status" in result, false);
  assert.equal("retryCount" in result, false);
});
