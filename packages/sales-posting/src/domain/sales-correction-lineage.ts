import type { SalesDocumentSnapshot } from "@argin/sales";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type {
  SalesPostingDomainErrorCode,
} from "./sales-posting-domain-errors.ts";
import {
  createSalesPostingSourceIdentity,
} from "./sales-posting-source.ts";
import type {
  SalesPostingSourceIdentity,
} from "./sales-posting-source.ts";

export interface SalesCorrectionLineageLine {
  readonly correctionLineId: string;
  readonly originalInvoiceLineId: string;
  readonly productId: string;
  readonly lineKind: "stock-product" | "non-stock-product" | "service";
}

export interface SalesCorrectionLineage {
  readonly correctionDocumentId: string;
  readonly originalInvoiceId: string;
  readonly lines: readonly SalesCorrectionLineageLine[];
}

export interface SalesCorrectionReplacementPlan {
  readonly mode: "reverse-and-replace";
  readonly originalSource: SalesPostingSourceIdentity;
  readonly replacementSource: SalesPostingSourceIdentity;
  readonly originalInvoiceId: string;
  readonly correctionDocumentId: string;
  readonly lines: readonly SalesCorrectionLineageLine[];
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

export function createSalesCorrectionLineage(
  document: SalesDocumentSnapshot,
): SalesCorrectionLineage {
  if (
    !document
    || typeof document !== "object"
    || document.documentType !== "sales-correction"
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionInvalid,
      "document",
    );
  }

  const origin = document.relatedDocumentReference;
  if (
    origin === null
    || origin.relationType !== "sales-invoice"
    || !origin.documentId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionLineageInvalid,
      "document.relatedDocumentReference",
    );
  }

  const seenCorrectionLines = new Set<string>();
  const seenOriginalLines = new Set<string>();
  const lines = document.lines.map((line) => {
    const source = line.sourceReference;
    if (
      source === null
      || source.sourceSystem !== "sales"
      || source.sourceDocumentId !== origin.documentId
      || source.sourceLineId === null
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionLineageInvalid,
        "document.lines.sourceReference",
      );
    }

    if (
      seenCorrectionLines.has(line.lineId)
      || seenOriginalLines.has(source.sourceLineId)
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionLineageInvalid,
        "document.lines",
      );
    }

    seenCorrectionLines.add(line.lineId);
    seenOriginalLines.add(source.sourceLineId);

    return Object.freeze({
      correctionLineId: line.lineId,
      originalInvoiceLineId: source.sourceLineId,
      productId: line.item.productId,
      lineKind: line.lineKind,
    });
  });

  return Object.freeze({
    correctionDocumentId: document.documentId,
    originalInvoiceId: origin.documentId,
    lines: Object.freeze(lines),
  });
}

export function createSalesCorrectionReplacementPlan(input: {
  readonly lineage: SalesCorrectionLineage;
  readonly originalSource: SalesPostingSourceIdentity;
  readonly replacementSource: SalesPostingSourceIdentity;
}): SalesCorrectionReplacementPlan {
  if (!input || typeof input !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionInvalid,
      "input",
    );
  }

  const originalSource = createSalesPostingSourceIdentity(
    input.originalSource,
  );
  const replacementSource = createSalesPostingSourceIdentity(
    input.replacementSource,
  );

  if (
    originalSource.sourceType !== "sales-invoice"
    || originalSource.sourceDocumentId !== input.lineage.originalInvoiceId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionLineageInvalid,
      "originalSource",
    );
  }

  if (
    replacementSource.sourceType !== "sales-correction"
    || replacementSource.sourceDocumentId
      !== input.lineage.correctionDocumentId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionLineageInvalid,
      "replacementSource",
    );
  }

  if (
    originalSource.sourceSystem !== "sales"
    || replacementSource.sourceSystem !== "sales"
    || originalSource.sourceDocumentId
      === replacementSource.sourceDocumentId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesCorrectionReplacementConflict,
      "source",
    );
  }

  return Object.freeze({
    mode: "reverse-and-replace",
    originalSource,
    replacementSource,
    originalInvoiceId: input.lineage.originalInvoiceId,
    correctionDocumentId: input.lineage.correctionDocumentId,
    lines: input.lineage.lines,
  });
}
