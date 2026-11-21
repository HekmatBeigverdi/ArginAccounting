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
import type {
  SalesCostPostingCalculation,
  SalesCostPostingComponent,
} from "./sales-cost-posting-calculation.ts";

export interface SalesMixedInvoicePostingResult {
  readonly sourceDocumentId: string;
  readonly companyId: string;
  readonly currency: string;
  readonly stockLineIds: readonly string[];
  readonly nonStockLineIds: readonly string[];
  readonly commercial: SalesCommercialPostingCalculation;
  readonly cost: SalesCostPostingCalculation;
  readonly commercialComponents: readonly SalesCommercialPostingComponent[];
  readonly costComponents: readonly SalesCostPostingComponent[];
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function sameCurrency(
  commercial: SalesCommercialPostingCalculation,
  cost: SalesCostPostingCalculation,
): void {
  if (cost.currency !== null && commercial.currency !== cost.currency) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceMismatch,
      "currency",
    );
  }
}

function commercialLineCoverage(
  commercial: SalesCommercialPostingInput,
  calculation: SalesCommercialPostingCalculation,
): void {
  const lineIds = new Set(commercial.lines.map((line) => line.lineId));
  for (const component of calculation.components) {
    if (
      component.sourceLineId !== null
      && !lineIds.has(component.sourceLineId)
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceMismatch,
        "commercial.components.sourceLineId",
      );
    }
  }
}

function costLineCoverage(
  commercial: SalesCommercialPostingInput,
  calculation: SalesCostPostingCalculation,
): void {
  const stockLineIds = new Set(
    commercial.lines
      .filter((line) => line.lineKind === "stock-product")
      .map((line) => line.lineId),
  );
  for (const component of calculation.components) {
    if (!stockLineIds.has(component.salesLineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceMismatch,
        "cost.components.salesLineId",
      );
    }
  }

  const costLines = new Set(calculation.components.map((item) => item.salesLineId));
  for (const stockLineId of stockLineIds) {
    const lineComponents = calculation.components.filter(
      (item) => item.salesLineId === stockLineId,
    );
    if (lineComponents.length === 0) continue;

    const roles = new Set(lineComponents.map((item) => item.role));
    const sides = new Set(lineComponents.map((item) => item.side));
    if (
      lineComponents.length !== 2
      || !roles.has("cogs")
      || !roles.has("inventory-asset")
      || !sides.has("debit")
      || !sides.has("credit")
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceMismatch,
        "cost.components",
      );
    }
  }

  for (const costLine of costLines) {
    if (!stockLineIds.has(costLine)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceMismatch,
        "cost.components.salesLineId",
      );
    }
  }
}

export function orchestrateMixedSalesInvoicePosting(input: {
  readonly commercialInput: SalesCommercialPostingInput;
  readonly commercialPosting: SalesCommercialPostingCalculation;
  readonly costPosting: SalesCostPostingCalculation;
}): SalesMixedInvoicePostingResult {
  if (!input || typeof input !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceInvalid,
      "input",
    );
  }

  const commercialInput = input.commercialInput;
  const commercialPosting = input.commercialPosting;
  const costPosting = input.costPosting;

  if (
    !commercialInput
    || !commercialPosting
    || !costPosting
    || commercialPosting.balanced !== true
    || costPosting.balanced !== true
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceInvalid,
      "input",
    );
  }

  const stockLineIds = commercialInput.lines
    .filter((line) => line.lineKind === "stock-product")
    .map((line) => line.lineId);
  const nonStockLineIds = commercialInput.lines
    .filter((line) => line.lineKind !== "stock-product")
    .map((line) => line.lineId);

  if (stockLineIds.length === 0 || nonStockLineIds.length === 0) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceInvalid,
      "commercialInput.lines",
    );
  }

  if (commercialPosting.currency !== commercialInput.currency) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.mixedInvoiceMismatch,
      "commercial.currency",
    );
  }

  sameCurrency(commercialPosting, costPosting);
  commercialLineCoverage(commercialInput, commercialPosting);
  costLineCoverage(commercialInput, costPosting);

  return Object.freeze({
    sourceDocumentId: commercialInput.source.sourceDocumentId,
    companyId: commercialInput.companyId,
    currency: commercialInput.currency,
    stockLineIds: Object.freeze([...stockLineIds]),
    nonStockLineIds: Object.freeze([...nonStockLineIds]),
    commercial: commercialPosting,
    cost: costPosting,
    commercialComponents: Object.freeze([...commercialPosting.components]),
    costComponents: Object.freeze([...costPosting.components]),
  });
}
