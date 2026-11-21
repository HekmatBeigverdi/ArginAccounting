import type { SalesDocumentSnapshot } from "@argin/sales";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type { SalesCommercialPostingInput } from "./sales-commercial-posting-input.ts";
import type {
  SalesCommercialPostingCalculation,
  SalesCommercialPostingComponent,
  SalesCommercialPostingSide,
} from "./sales-commercial-posting-calculation.ts";

export interface SalesReturnCommercialLineage {
  readonly returnDocumentId: string;
  readonly originalInvoiceId: string;
  readonly lines: readonly {
    readonly returnLineId: string;
    readonly originalInvoiceLineId: string;
    readonly productId: string;
  }[];
}

export interface SalesReturnCommercialReversalComponent
  extends Omit<SalesCommercialPostingComponent, "side"> {
  readonly side: SalesCommercialPostingSide;
  readonly returnLineId: string | null;
  readonly originalInvoiceLineId: string | null;
  readonly originalInvoiceId: string;
}

export interface SalesReturnCommercialReversal {
  readonly sourceDocumentId: string;
  readonly originalInvoiceId: string;
  readonly companyId: string;
  readonly currency: string;
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly balanced: true;
  readonly components: readonly SalesReturnCommercialReversalComponent[];
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function reverseSide(side: SalesCommercialPostingSide): SalesCommercialPostingSide {
  return side === "debit" ? "credit" : "debit";
}

export function createSalesReturnCommercialLineage(
  document: SalesDocumentSnapshot,
): SalesReturnCommercialLineage {
  if (!document || typeof document !== "object" || document.documentType !== "sales-return") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInvalid,
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
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnLineageInvalid,
      "document.relatedDocumentReference",
    );
  }

  const seen = new Set<string>();
  const lines = document.lines.map((line) => {
    const source = line.sourceReference;
    if (
      source === null
      || source.sourceSystem !== "sales"
      || source.sourceDocumentId !== origin.documentId
      || source.sourceLineId === null
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnLineageInvalid,
        "document.lines.sourceReference",
      );
    }
    if (seen.has(line.lineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnLineageInvalid,
        "document.lines.lineId",
      );
    }
    seen.add(line.lineId);

    return Object.freeze({
      returnLineId: line.lineId,
      originalInvoiceLineId: source.sourceLineId,
      productId: line.item.productId,
    });
  });

  return Object.freeze({
    returnDocumentId: document.documentId,
    originalInvoiceId: origin.documentId,
    lines: Object.freeze(lines),
  });
}

export function reverseSalesReturnCommercialPosting(input: {
  readonly commercialInput: SalesCommercialPostingInput;
  readonly commercialPosting: SalesCommercialPostingCalculation;
  readonly lineage: SalesReturnCommercialLineage;
}): SalesReturnCommercialReversal {
  const { commercialInput, commercialPosting, lineage } = input;

  if (
    !commercialInput
    || !commercialPosting
    || !lineage
    || commercialInput.source.sourceType !== "sales-return"
    || commercialPosting.balanced !== true
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInvalid,
      "input",
    );
  }

  if (
    lineage.returnDocumentId !== commercialInput.source.sourceDocumentId
    || lineage.lines.length !== commercialInput.lines.length
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnLineageInvalid,
      "lineage",
    );
  }

  const lineageByReturnLine = new Map(
    lineage.lines.map((line) => [line.returnLineId, line] as const),
  );

  for (const line of commercialInput.lines) {
    const linked = lineageByReturnLine.get(line.lineId);
    if (!linked || linked.productId !== line.productId) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnLineageInvalid,
        "lineage.lines",
      );
    }
  }

  const components = commercialPosting.components.map(
    (component): SalesReturnCommercialReversalComponent => {
      const linked = component.sourceLineId === null
        ? null
        : lineageByReturnLine.get(component.sourceLineId) ?? null;

      if (component.sourceLineId !== null && linked === null) {
        return fail(
          SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnLineageInvalid,
          "commercial.components.sourceLineId",
        );
      }

      return Object.freeze({
        ...component,
        componentId: `return-reversal:${component.componentId}`,
        side: reverseSide(component.side),
        returnLineId: component.sourceLineId,
        originalInvoiceLineId: linked?.originalInvoiceLineId ?? null,
        originalInvoiceId: lineage.originalInvoiceId,
      });
    },
  );

  const totalDebit = components
    .filter((component) => component.side === "debit")
    .reduce((sum, component) => sum + component.amount, 0);
  const totalCredit = components
    .filter((component) => component.side === "credit")
    .reduce((sum, component) => sum + component.amount, 0);

  if (
    totalDebit !== totalCredit
    || totalDebit !== commercialPosting.totalCredit
    || totalCredit !== commercialPosting.totalDebit
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnCommercialUnbalanced,
      "components",
    );
  }

  return Object.freeze({
    sourceDocumentId: commercialInput.source.sourceDocumentId,
    originalInvoiceId: lineage.originalInvoiceId,
    companyId: commercialInput.companyId,
    currency: commercialInput.currency,
    totalDebit,
    totalCredit,
    balanced: true,
    components: Object.freeze(components),
  });
}
