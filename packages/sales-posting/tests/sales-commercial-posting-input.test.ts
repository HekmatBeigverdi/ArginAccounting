import assert from "node:assert/strict";
import test from "node:test";

import {
  createSalesInvoice,
} from "@argin/sales";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesCommercialPostingInput,
  createSalesPostingSourceIdentity,
} from "../src/index.ts";

function assertDomainError(
  action: () => unknown,
  code: string,
  field: string,
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof SalesPostingDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

function invoice() {
  return createSalesInvoice({
    documentId: "sales-invoice-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    customer: {
      partyId: "party-001",
      code: "C-001",
      displayName: "Customer 001",
    },
    documentNumber: "1405-000001",
    businessDate: "2026-10-06",
    capturedAt: "2026-10-06T09:10:00.000Z",
    lines: [
      {
        lineId: "line-stock-001",
        position: 1,
        lineKind: "stock-product",
        productId: "product-stock-001",
        commercialTerms: {
          quantity: 2,
          currency: "IRR",
          unitPrice: 1_000_000,
          priceOrigin: "manual",
        },
      },
      {
        lineId: "line-service-001",
        position: 2,
        lineKind: "service",
        productId: "service-001",
        commercialTerms: {
          quantity: 1,
          currency: "IRR",
          unitPrice: 500_000,
          priceOrigin: "manual",
          taxes: [
            {
              taxId: "vat",
              taxCode: "VAT",
              rateBasisPoints: 1000,
            },
          ],
        },
      },
    ],
  });
}

test("creates commercial posting input only from authoritative Sales snapshots", () => {
  const salesInvoice = invoice();
  const source = createSalesPostingSourceIdentity({
    sourceType: "sales-invoice",
    sourceDocumentId: salesInvoice.document.documentId,
    sourceVersion: 7,
  });

  const input = createSalesCommercialPostingInput({
    source,
    document: salesInvoice.document,
    commercialSnapshots: salesInvoice.commercialSnapshots,
    documentTotals: salesInvoice.totals,
  });

  assert.equal(input.companyId, "company-001");
  assert.equal(input.branchId, "branch-001");
  assert.equal(input.fiscalYearId, "fy-1405");
  assert.equal(input.customerPartyId, "party-001");
  assert.equal(input.businessDate, "2026-10-06");
  assert.equal(input.currency, "IRR");
  assert.equal(input.lines.length, 2);
  assert.equal(input.lines[0]!.totals.grandTotal, 2_000_000);
  assert.equal(input.lines[1]!.totals.grandTotal, 550_000);
  assert.equal(input.documentTotals.grandTotal, 2_550_000);
  assert.ok(Object.isFrozen(input));
  assert.ok(Object.isFrozen(input.lines));
});

test("preserves Sales price and tax facts without recomputing policy", () => {
  const salesInvoice = invoice();
  const input = createSalesCommercialPostingInput({
    source: createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: salesInvoice.document.documentId,
      sourceVersion: 1,
    }),
    document: salesInvoice.document,
    commercialSnapshots: salesInvoice.commercialSnapshots,
    documentTotals: salesInvoice.totals,
  });

  assert.equal(input.lines[0]!.terms.unitPrice, 1_000_000);
  assert.equal(input.lines[0]!.terms.priceOrigin, "manual");
  assert.equal(input.lines[1]!.terms.taxes[0]!.rateBasisPoints, 1000);
  assert.strictEqual(input.lines[0]!.terms, salesInvoice.commercialSnapshots[0]!.terms);
  assert.strictEqual(input.lines[0]!.totals, salesInvoice.commercialSnapshots[0]!.totals);
});

test("rejects a source identity that does not belong to the Sales document", () => {
  const salesInvoice = invoice();

  assertDomainError(
    () => createSalesCommercialPostingInput({
      source: createSalesPostingSourceIdentity({
        sourceType: "sales-invoice",
        sourceDocumentId: "another-invoice",
        sourceVersion: 1,
      }),
      document: salesInvoice.document,
      commercialSnapshots: salesInvoice.commercialSnapshots,
      documentTotals: salesInvoice.totals,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.scopeMismatch,
    "source.sourceDocumentId",
  );
});

test("rejects missing, duplicate or unknown commercial snapshot lines", () => {
  const salesInvoice = invoice();
  const source = createSalesPostingSourceIdentity({
    sourceType: "sales-invoice",
    sourceDocumentId: salesInvoice.document.documentId,
    sourceVersion: 1,
  });

  assertDomainError(
    () => createSalesCommercialPostingInput({
      source,
      document: salesInvoice.document,
      commercialSnapshots: [salesInvoice.commercialSnapshots[0]!],
      documentTotals: salesInvoice.totals,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid,
    "commercialSnapshots",
  );

  assertDomainError(
    () => createSalesCommercialPostingInput({
      source,
      document: salesInvoice.document,
      commercialSnapshots: [
        salesInvoice.commercialSnapshots[0]!,
        salesInvoice.commercialSnapshots[0]!,
      ],
      documentTotals: salesInvoice.totals,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid,
    "commercialSnapshots.lineId",
  );
});

test("rejects tampered immutable commercial totals", () => {
  const salesInvoice = invoice();
  const original = salesInvoice.commercialSnapshots[0]!;
  const tampered = {
    ...original,
    totals: {
      ...original.totals,
      grandTotal: original.totals.grandTotal + 1,
    },
  };

  assertDomainError(
    () => createSalesCommercialPostingInput({
      source: createSalesPostingSourceIdentity({
        sourceType: "sales-invoice",
        sourceDocumentId: salesInvoice.document.documentId,
        sourceVersion: 1,
      }),
      document: salesInvoice.document,
      commercialSnapshots: [
        tampered,
        salesInvoice.commercialSnapshots[1]!,
      ],
      documentTotals: salesInvoice.totals,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid,
    "commercialSnapshots.totals",
  );
});

test("rejects document totals that do not equal the supplied immutable line snapshots", () => {
  const salesInvoice = invoice();

  assertDomainError(
    () => createSalesCommercialPostingInput({
      source: createSalesPostingSourceIdentity({
        sourceType: "sales-invoice",
        sourceDocumentId: salesInvoice.document.documentId,
        sourceVersion: 1,
      }),
      document: salesInvoice.document,
      commercialSnapshots: salesInvoice.commercialSnapshots,
      documentTotals: {
        ...salesInvoice.totals,
        grandTotal: salesInvoice.totals.grandTotal + 100,
      },
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid,
    "documentTotals.grandTotal",
  );
});

test("rejects Sales Order as a commercial posting source", () => {
  assertDomainError(
    () => createSalesPostingSourceIdentity({
      sourceType: "sales-order" as "sales-invoice",
      sourceDocumentId: "sales-order-001",
      sourceVersion: 1,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.sourceTypeInvalid,
    "source.sourceType",
  );
});
