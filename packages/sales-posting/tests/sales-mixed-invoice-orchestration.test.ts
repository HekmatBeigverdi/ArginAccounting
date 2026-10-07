import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  orchestrateMixedSalesInvoicePosting,
} from "../src/index.ts";

function commercialInput() {
  return {
    source: {
      sourceSystem: "sales",
      sourceType: "sales-invoice",
      sourceDocumentId: "sales-invoice-001",
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
      grossAmount: 2_500_000,
      discountAmount: 0,
      netAfterDiscount: 2_500_000,
      chargeAmount: 0,
      taxBaseAmount: 2_500_000,
      taxAmount: 0,
      grandTotal: 2_500_000,
    },
    lines: [
      {
        snapshotId: "snap-stock",
        lineId: "stock-1",
        productId: "product-001",
        lineKind: "stock-product",
        capturedAt: "2026-10-07T08:00:00.000Z",
        terms: { taxes: [] },
        totals: {
          currency: "IRR",
          grossAmount: 2_000_000,
          discountAmount: 0,
          netAfterDiscount: 2_000_000,
          chargeAmount: 0,
          taxBaseAmount: 2_000_000,
          taxAmount: 0,
          grandTotal: 2_000_000,
        },
      },
      {
        snapshotId: "snap-service",
        lineId: "service-1",
        productId: "service-001",
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
    totalDebit: 2_500_000,
    totalCredit: 2_500_000,
    balanced: true,
    components: [
      {
        componentId: "commercial:accounts-receivable",
        role: "accounts-receivable",
        side: "debit",
        accountId: "ar",
        amount: 2_500_000,
        currency: "IRR",
        sourceLineId: null,
        customerPartyId: "customer-001",
        taxIds: [],
        taxCodes: [],
      },
      {
        componentId: "commercial:revenue:stock-1",
        role: "sales-revenue",
        side: "credit",
        accountId: "revenue-stock",
        amount: 2_000_000,
        currency: "IRR",
        sourceLineId: "stock-1",
        customerPartyId: null,
        taxIds: [],
        taxCodes: [],
      },
      {
        componentId: "commercial:revenue:service-1",
        role: "sales-revenue",
        side: "credit",
        accountId: "revenue-service",
        amount: 500_000,
        currency: "IRR",
        sourceLineId: "service-1",
        customerPartyId: null,
        taxIds: [],
        taxCodes: [],
      },
    ],
  } as const;
}

function costPosting() {
  return {
    currency: "IRR",
    totalDebit: 1_200_000,
    totalCredit: 1_200_000,
    balanced: true,
    components: [
      {
        componentId: "cost:cogs:stock-1",
        role: "cogs",
        side: "debit",
        accountId: "cogs",
        amount: 1_200_000,
        currency: "IRR",
        salesLineId: "stock-1",
        productId: "product-001",
        movementId: "movement-001",
        valuationEntryId: "valuation-001",
        valuationMethod: "fifo",
        valuationRevision: 2,
      },
      {
        componentId: "cost:inventory-relief:stock-1",
        role: "inventory-asset",
        side: "credit",
        accountId: "inventory",
        amount: 1_200_000,
        currency: "IRR",
        salesLineId: "stock-1",
        productId: "product-001",
        movementId: "movement-001",
        valuationEntryId: "valuation-001",
        valuationMethod: "fifo",
        valuationRevision: 2,
      },
    ],
  } as const;
}

test("orchestrates mixed stock + service invoice without leaking cost to service line", () => {
  const result = orchestrateMixedSalesInvoicePosting({
    commercialInput: commercialInput(),
    commercialPosting: commercialPosting(),
    costPosting: costPosting(),
  });

  assert.deepEqual(result.stockLineIds, ["stock-1"]);
  assert.deepEqual(result.nonStockLineIds, ["service-1"]);
  assert.equal(result.commercialComponents.length, 3);
  assert.equal(result.costComponents.length, 2);
  assert.equal(
    result.costComponents.some((component) => component.salesLineId === "service-1"),
    false,
  );
});

test("rejects stock-only and service-only inputs because Step 15 is mixed path", () => {
  assert.throws(
    () => orchestrateMixedSalesInvoicePosting({
      commercialInput: {
        ...commercialInput(),
        lines: [commercialInput().lines[0]],
      },
      commercialPosting: commercialPosting(),
      costPosting: costPosting(),
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceInvalid,
  );

  assert.throws(
    () => orchestrateMixedSalesInvoicePosting({
      commercialInput: {
        ...commercialInput(),
        lines: [commercialInput().lines[1]],
      },
      commercialPosting: commercialPosting(),
      costPosting: {
        currency: null,
        totalDebit: 0,
        totalCredit: 0,
        balanced: true,
        components: [],
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceInvalid,
  );
});

test("rejects cost components for service/non-stock lines", () => {
  assert.throws(
    () => orchestrateMixedSalesInvoicePosting({
      commercialInput: commercialInput(),
      commercialPosting: commercialPosting(),
      costPosting: {
        ...costPosting(),
        components: [
          ...costPosting().components,
          {
            ...costPosting().components[0],
            componentId: "cost:cogs:service-1",
            salesLineId: "service-1",
          },
        ],
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceMismatch,
  );
});

test("rejects commercial component pointing to unknown Sales line", () => {
  assert.throws(
    () => orchestrateMixedSalesInvoicePosting({
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
      costPosting: costPosting(),
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceMismatch,
  );
});

test("rejects commercial/cost currency mismatch", () => {
  assert.throws(
    () => orchestrateMixedSalesInvoicePosting({
      commercialInput: commercialInput(),
      commercialPosting: commercialPosting(),
      costPosting: {
        ...costPosting(),
        currency: "USD",
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceMismatch
      && error.field === "currency",
  );
});

test("preserves commercial and cost legs as separate balanced effects", () => {
  const result = orchestrateMixedSalesInvoicePosting({
    commercialInput: commercialInput(),
    commercialPosting: commercialPosting(),
    costPosting: costPosting(),
  });

  assert.equal(result.commercial.totalDebit, 2_500_000);
  assert.equal(result.commercial.totalCredit, 2_500_000);
  assert.equal(result.cost.totalDebit, 1_200_000);
  assert.equal(result.cost.totalCredit, 1_200_000);
  assert.equal(result.commercial.balanced, true);
  assert.equal(result.cost.balanced, true);
});

test("does not create Journal or orchestration status in Step 15", () => {
  const result = orchestrateMixedSalesInvoicePosting({
    commercialInput: commercialInput(),
    commercialPosting: commercialPosting(),
    costPosting: costPosting(),
  });

  assert.equal("journalVoucherId" in result, false);
  assert.equal("journalLineId" in result, false);
  assert.equal("status" in result, false);
  assert.equal("retryCount" in result, false);
});
