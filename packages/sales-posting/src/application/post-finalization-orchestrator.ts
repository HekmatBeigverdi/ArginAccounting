import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "../domain/sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "../domain/sales-posting-domain-errors.ts";
import type { SalesCommercialPostingInput } from "../domain/sales-commercial-posting-input.ts";
import type { SalesCommercialPostingCalculation } from "../domain/sales-commercial-posting-calculation.ts";
import type {
  SalesStockFulfillmentPrerequisiteResult,
} from "../domain/sales-stock-fulfillment-prerequisite.ts";
import type {
  SalesInventoryIssueLineageResult,
} from "../domain/sales-inventory-issue-lineage.ts";
import type {
  SalesOutboundInventoryMovementLineageResult,
} from "../domain/sales-inventory-movement-lineage.ts";
import type {
  SalesResolvedValuationPrerequisiteResult,
} from "../domain/sales-resolved-valuation-prerequisite.ts";
import type { SalesCostPostingCalculation } from "../domain/sales-cost-posting-calculation.ts";
import {
  orchestrateMixedSalesInvoicePosting,
} from "../domain/sales-mixed-invoice-orchestration.ts";
import {
  orchestrateServiceOnlySalesInvoicePosting,
} from "../domain/sales-service-only-posting.ts";

export const SALES_POSTING_ORCHESTRATION_STATUSES = Object.freeze([
  "pending",
  "ready",
] as const);

export type SalesPostingOrchestrationStatus =
  (typeof SALES_POSTING_ORCHESTRATION_STATUSES)[number];

export const SALES_POSTING_PENDING_REASONS = Object.freeze([
  "waiting-for-issue",
  "waiting-for-confirmation",
  "waiting-for-movement",
  "waiting-for-valuation",
] as const);

export type SalesPostingPendingReason =
  (typeof SALES_POSTING_PENDING_REASONS)[number];

export type SalesPostingInvoicePath =
  | "service-only"
  | "stock-only"
  | "mixed";

export interface SalesPostingPendingState {
  readonly status: "pending";
  readonly path: SalesPostingInvoicePath;
  readonly sourceDocumentId: string;
  readonly companyId: string;
  readonly reason: SalesPostingPendingReason;
  readonly waitingLineIds: readonly string[];
}

export interface SalesPostingReadyState {
  readonly status: "ready";
  readonly path: SalesPostingInvoicePath;
  readonly sourceDocumentId: string;
  readonly companyId: string;
  readonly commercial: SalesCommercialPostingCalculation;
  readonly cost: SalesCostPostingCalculation | null;
}

export type SalesPostingPostFinalizationState =
  | SalesPostingPendingState
  | SalesPostingReadyState;

export interface OrchestrateSalesPostFinalizationInput {
  readonly commercialInput: SalesCommercialPostingInput;
  readonly commercialPosting: SalesCommercialPostingCalculation;
  readonly stockFulfillment?: SalesStockFulfillmentPrerequisiteResult | null;
  readonly issueLineage?: SalesInventoryIssueLineageResult | null;
  readonly movementLineage?: SalesOutboundInventoryMovementLineageResult | null;
  readonly valuation?: SalesResolvedValuationPrerequisiteResult | null;
  readonly costPosting?: SalesCostPostingCalculation | null;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function classifyPath(
  commercial: SalesCommercialPostingInput,
): SalesPostingInvoicePath {
  const stock = commercial.lines.filter(
    (line) => line.lineKind === "stock-product",
  );
  const service = commercial.lines.filter(
    (line) => line.lineKind === "service",
  );
  const nonStockProduct = commercial.lines.filter(
    (line) => line.lineKind === "non-stock-product",
  );

  if (nonStockProduct.length > 0) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.orchestrationInvalid,
      "commercial.lines.nonStockProduct",
    );
  }

  if (stock.length === 0 && service.length > 0) return "service-only";
  if (stock.length > 0 && service.length === 0) return "stock-only";
  if (stock.length > 0 && service.length > 0) return "mixed";

  return fail(
    SALES_POSTING_DOMAIN_ERROR_CODES.orchestrationInvalid,
    "commercial.lines",
  );
}

function pending(
  commercial: SalesCommercialPostingInput,
  path: SalesPostingInvoicePath,
  reason: SalesPostingPendingReason,
  waitingLineIds: readonly string[],
): SalesPostingPendingState {
  return Object.freeze({
    status: "pending",
    path,
    sourceDocumentId: commercial.source.sourceDocumentId,
    companyId: commercial.companyId,
    reason,
    waitingLineIds: Object.freeze([...waitingLineIds]),
  });
}

function assertScope(
  commercial: SalesCommercialPostingInput,
  value: {
    readonly sourceDocumentId: string;
    readonly companyId: string;
  },
  field: string,
): void {
  if (
    value.sourceDocumentId !== commercial.source.sourceDocumentId
    || value.companyId !== commercial.companyId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.orchestrationMismatch,
      field,
    );
  }
}

function stockLineIds(commercial: SalesCommercialPostingInput): readonly string[] {
  return Object.freeze(
    commercial.lines
      .filter((line) => line.lineKind === "stock-product")
      .map((line) => line.lineId),
  );
}

export function orchestrateSalesPostFinalization(
  input: OrchestrateSalesPostFinalizationInput,
): SalesPostingPostFinalizationState {
  if (!input || typeof input !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.orchestrationInvalid,
      "input",
    );
  }

  const commercial = input.commercialInput;
  const commercialPosting = input.commercialPosting;
  if (
    !commercial
    || !commercialPosting
    || commercial.source.sourceType !== "sales-invoice"
    || commercialPosting.balanced !== true
    || commercialPosting.currency !== commercial.currency
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.orchestrationInvalid,
      "commercial",
    );
  }

  const path = classifyPath(commercial);

  if (path === "service-only") {
    orchestrateServiceOnlySalesInvoicePosting({
      commercialInput: commercial,
      commercialPosting,
    });

    return Object.freeze({
      status: "ready",
      path,
      sourceDocumentId: commercial.source.sourceDocumentId,
      companyId: commercial.companyId,
      commercial: commercialPosting,
      cost: null,
    });
  }

  const stocks = stockLineIds(commercial);
  const fulfillment = input.stockFulfillment;
  if (!fulfillment) {
    return pending(commercial, path, "waiting-for-issue", stocks);
  }

  assertScope(commercial, fulfillment, "stockFulfillment");

  const waitingForIssue = fulfillment.lines
    .filter((line) => line.lineKind === "stock-product" && line.status === "waiting-for-issue")
    .map((line) => line.salesLineId);
  if (waitingForIssue.length > 0) {
    return pending(commercial, path, "waiting-for-issue", waitingForIssue);
  }

  const waitingForConfirmation = fulfillment.lines
    .filter((line) =>
      line.lineKind === "stock-product"
      && line.status === "waiting-for-confirmation"
    )
    .map((line) => line.salesLineId);
  if (waitingForConfirmation.length > 0) {
    return pending(
      commercial,
      path,
      "waiting-for-confirmation",
      waitingForConfirmation,
    );
  }

  if (!fulfillment.cogsEligible) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.orchestrationMismatch,
      "stockFulfillment.cogsEligible",
    );
  }

  const issue = input.issueLineage;
  if (!issue) {
    return pending(commercial, path, "waiting-for-movement", stocks);
  }
  assertScope(commercial, issue, "issueLineage");

  const issueLines = new Set(issue.lines.map((line) => line.salesLineId));
  const issueMissing = stocks.filter((lineId) => !issueLines.has(lineId));
  if (issueMissing.length > 0) {
    return pending(commercial, path, "waiting-for-movement", issueMissing);
  }

  const movement = input.movementLineage;
  if (!movement) {
    return pending(commercial, path, "waiting-for-movement", stocks);
  }
  assertScope(commercial, movement, "movementLineage");

  const movementLines = new Set(movement.lines.map((line) => line.salesLineId));
  const movementMissing = stocks.filter((lineId) => !movementLines.has(lineId));
  if (movementMissing.length > 0) {
    return pending(commercial, path, "waiting-for-movement", movementMissing);
  }

  const valuation = input.valuation;
  if (!valuation) {
    return pending(commercial, path, "waiting-for-valuation", stocks);
  }
  assertScope(commercial, valuation, "valuation");

  const valuationLines = new Set(valuation.lines.map((line) => line.salesLineId));
  const valuationMissing = stocks.filter((lineId) => !valuationLines.has(lineId));
  if (!valuation.ready || valuationMissing.length > 0) {
    return pending(
      commercial,
      path,
      "waiting-for-valuation",
      valuationMissing.length > 0 ? valuationMissing : stocks,
    );
  }

  const costPosting = input.costPosting;
  if (!costPosting || costPosting.balanced !== true) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.orchestrationMismatch,
      "costPosting",
    );
  }

  if (path === "mixed") {
    orchestrateMixedSalesInvoicePosting({
      commercialInput: commercial,
      commercialPosting,
      costPosting,
    });
  }

  return Object.freeze({
    status: "ready",
    path,
    sourceDocumentId: commercial.source.sourceDocumentId,
    companyId: commercial.companyId,
    commercial: commercialPosting,
    cost: costPosting,
  });
}
