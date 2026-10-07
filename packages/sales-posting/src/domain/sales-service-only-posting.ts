import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type { SalesCommercialPostingInput } from "./sales-commercial-posting-input.ts";
import type {
  SalesCommercialPostingCalculation,
  SalesCommercialPostingComponent,
} from "./sales-commercial-posting-calculation.ts";

export interface SalesServiceOnlyPostingResult {
  readonly sourceDocumentId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly customerPartyId: string;
  readonly currency: string;
  readonly serviceLineIds: readonly string[];
  readonly commercial: SalesCommercialPostingCalculation;
  readonly commercialComponents: readonly SalesCommercialPostingComponent[];
  readonly inventoryRequired: false;
  readonly costPostingRequired: false;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function validateCommercialCoverage(
  commercialInput: SalesCommercialPostingInput,
  commercialPosting: SalesCommercialPostingCalculation,
): void {
  const serviceLineIds = new Set(
    commercialInput.lines.map((line) => line.lineId),
  );

  for (const component of commercialPosting.components) {
    if (
      component.sourceLineId !== null
      && !serviceLineIds.has(component.sourceLineId)
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyMismatch,
        "commercial.components.sourceLineId",
      );
    }
  }

  for (const line of commercialInput.lines) {
    const revenueComponents = commercialPosting.components.filter(
      (component) =>
        component.role === "sales-revenue"
        && component.sourceLineId === line.lineId,
    );

    if (line.totals.taxBaseAmount > 0 && revenueComponents.length !== 1) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyMismatch,
        "commercial.components.revenue",
      );
    }

    if (line.totals.taxBaseAmount === 0 && revenueComponents.length > 0) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyMismatch,
        "commercial.components.revenue",
      );
    }
  }
}

export function orchestrateServiceOnlySalesInvoicePosting(input: {
  readonly commercialInput: SalesCommercialPostingInput;
  readonly commercialPosting: SalesCommercialPostingCalculation;
}): SalesServiceOnlyPostingResult {
  if (!input || typeof input !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyInvalid,
      "input",
    );
  }

  const commercialInput = input.commercialInput;
  const commercialPosting = input.commercialPosting;

  if (
    !commercialInput
    || typeof commercialInput !== "object"
    || !commercialPosting
    || typeof commercialPosting !== "object"
    || commercialPosting.balanced !== true
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyInvalid,
      "input",
    );
  }

  if (commercialInput.source.sourceType !== "sales-invoice") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyInvalid,
      "commercialInput.source.sourceType",
    );
  }

  if (
    commercialInput.lines.length === 0
    || commercialInput.lines.some((line) => line.lineKind !== "service")
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyInvalid,
      "commercialInput.lines",
    );
  }

  if (commercialPosting.currency !== commercialInput.currency) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyMismatch,
      "commercial.currency",
    );
  }

  if (
    commercialPosting.totalDebit !== commercialPosting.totalCredit
    || commercialPosting.totalDebit !== commercialInput.documentTotals.grandTotal
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.serviceOnlyMismatch,
      "commercial.totals",
    );
  }

  validateCommercialCoverage(commercialInput, commercialPosting);

  return Object.freeze({
    sourceDocumentId: commercialInput.source.sourceDocumentId,
    companyId: commercialInput.companyId,
    branchId: commercialInput.branchId,
    customerPartyId: commercialInput.customerPartyId,
    currency: commercialInput.currency,
    serviceLineIds: Object.freeze(
      commercialInput.lines.map((line) => line.lineId),
    ),
    commercial: commercialPosting,
    commercialComponents: Object.freeze([
      ...commercialPosting.components,
    ]),
    inventoryRequired: false,
    costPostingRequired: false,
  });
}
