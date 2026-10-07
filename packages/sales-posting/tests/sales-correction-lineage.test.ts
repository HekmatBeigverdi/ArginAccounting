import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesCorrectionLineage,
  createSalesCorrectionReplacementPlan,
} from "../src/index.ts";

function correctionDocument() {
  return {
    documentId: "correction-001",
    documentType: "sales-correction",
    scope: { companyId: "company-001", branchId: "branch-001", fiscalYearId: "fy-1405" },
    customer: { partyId: "customer-001", code: "C1", displayName: "Customer" },
    documentNumber: "SC-001",
    businessDate: "2026-10-07",
    description: "Corrected invoice",
    sourceReference: null,
    relatedDocumentReference: {
      documentId: "invoice-001",
      lineId: null,
      relationType: "sales-invoice",
    },
    lines: [
      {
        lineId: "correction-line-1",
        position: 1,
        lineKind: "stock-product",
        item: { productId: "product-001", itemType: "product" },
        description: "Corrected stock line",
        sourceReference: {
          sourceSystem: "sales",
          sourceDocumentId: "invoice-001",
          sourceLineId: "invoice-line-1",
        },
        commercialTerms: null,
      },
      {
        lineId: "correction-line-2",
        position: 2,
        lineKind: "service",
        item: { productId: "service-001", itemType: "service" },
        description: "Corrected service line",
        sourceReference: {
          sourceSystem: "sales",
          sourceDocumentId: "invoice-001",
          sourceLineId: "invoice-line-2",
        },
        commercialTerms: null,
      },
    ],
  } as any;
}

test("builds correction lineage without mutating original invoice identity", () => {
  const lineage = createSalesCorrectionLineage(correctionDocument());

  assert.equal(lineage.correctionDocumentId, "correction-001");
  assert.equal(lineage.originalInvoiceId, "invoice-001");
  assert.deepEqual(lineage.lines, [
    {
      correctionLineId: "correction-line-1",
      originalInvoiceLineId: "invoice-line-1",
      productId: "product-001",
      lineKind: "stock-product",
    },
    {
      correctionLineId: "correction-line-2",
      originalInvoiceLineId: "invoice-line-2",
      productId: "service-001",
      lineKind: "service",
    },
  ]);
});

test("creates explicit reverse-and-replace posting plan", () => {
  const lineage = createSalesCorrectionLineage(correctionDocument());
  const plan = createSalesCorrectionReplacementPlan({
    lineage,
    originalSource: {
      sourceSystem: "sales",
      sourceType: "sales-invoice",
      sourceDocumentId: "invoice-001",
      sourceVersion: 5,
      externalReference: null,
    },
    replacementSource: {
      sourceSystem: "sales",
      sourceType: "sales-correction",
      sourceDocumentId: "correction-001",
      sourceVersion: 2,
      externalReference: null,
    },
  });

  assert.equal(plan.mode, "reverse-and-replace");
  assert.equal(plan.originalSource.sourceType, "sales-invoice");
  assert.equal(plan.originalSource.sourceVersion, 5);
  assert.equal(plan.replacementSource.sourceType, "sales-correction");
  assert.equal(plan.replacementSource.sourceVersion, 2);
});

test("rejects correction without originating invoice reference", () => {
  assert.throws(
    () => createSalesCorrectionLineage({
      ...correctionDocument(),
      relatedDocumentReference: null,
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionLineageInvalid,
  );
});

test("rejects correction line that points to another invoice", () => {
  assert.throws(
    () => createSalesCorrectionLineage({
      ...correctionDocument(),
      lines: [{
        ...correctionDocument().lines[0],
        sourceReference: {
          sourceSystem: "sales",
          sourceDocumentId: "invoice-other",
          sourceLineId: "invoice-line-1",
        },
      }],
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionLineageInvalid,
  );
});

test("rejects duplicate replacement of one original invoice line", () => {
  const document = correctionDocument();
  assert.throws(
    () => createSalesCorrectionLineage({
      ...document,
      lines: [
        document.lines[0],
        {
          ...document.lines[1],
          sourceReference: {
            sourceSystem: "sales",
            sourceDocumentId: "invoice-001",
            sourceLineId: "invoice-line-1",
          },
        },
      ],
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionLineageInvalid,
  );
});

test("rejects replacement plan when original source is not the referenced invoice", () => {
  const lineage = createSalesCorrectionLineage(correctionDocument());

  assert.throws(
    () => createSalesCorrectionReplacementPlan({
      lineage,
      originalSource: {
        sourceSystem: "sales",
        sourceType: "sales-invoice",
        sourceDocumentId: "invoice-other",
        sourceVersion: 1,
        externalReference: null,
      },
      replacementSource: {
        sourceSystem: "sales",
        sourceType: "sales-correction",
        sourceDocumentId: "correction-001",
        sourceVersion: 1,
        externalReference: null,
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionLineageInvalid,
  );
});

test("rejects replacement plan when replacement source is not correction document", () => {
  const lineage = createSalesCorrectionLineage(correctionDocument());

  assert.throws(
    () => createSalesCorrectionReplacementPlan({
      lineage,
      originalSource: {
        sourceSystem: "sales",
        sourceType: "sales-invoice",
        sourceDocumentId: "invoice-001",
        sourceVersion: 1,
        externalReference: null,
      },
      replacementSource: {
        sourceSystem: "sales",
        sourceType: "sales-return",
        sourceDocumentId: "correction-001",
        sourceVersion: 1,
        externalReference: null,
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionLineageInvalid,
  );
});
