import type { InventoryDocumentStatus } from "@argin/inventory";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type {
  SalesCommercialPostingInput,
  SalesCommercialPostingLineInput,
} from "./sales-commercial-posting-input.ts";

export interface SalesStockFulfillmentEvidence {
  readonly companyId: string;
  readonly inventoryDocumentId: string;
  readonly inventoryDocumentStatus: InventoryDocumentStatus;
  readonly inventoryLineId: string;
  readonly sourceSystem: "sales";
  readonly sourceDocumentType: "sales-invoice";
  readonly sourceDocumentId: string;
  readonly sourceLineId: string;
  readonly productId: string;
}

export type SalesStockFulfillmentLineStatus =
  | "not-required"
  | "waiting-for-issue"
  | "waiting-for-confirmation"
  | "eligible";

export interface SalesStockFulfillmentLinePrerequisite {
  readonly salesLineId: string;
  readonly productId: string;
  readonly lineKind: SalesCommercialPostingLineInput["lineKind"];
  readonly status: SalesStockFulfillmentLineStatus;
  readonly inventoryDocumentId: string | null;
  readonly inventoryLineId: string | null;
  readonly inventoryDocumentStatus: InventoryDocumentStatus | null;
}

export interface SalesStockFulfillmentPrerequisiteResult {
  readonly sourceDocumentId: string;
  readonly companyId: string;
  readonly hasStockLines: boolean;
  readonly cogsEligible: boolean;
  readonly lines: readonly SalesStockFulfillmentLinePrerequisite[];
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function evidenceMap(
  entries: readonly SalesStockFulfillmentEvidence[],
): Map<string, SalesStockFulfillmentEvidence> {
  if (!Array.isArray(entries)) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentInvalid,
      "evidence",
    );
  }

  const map = new Map<string, SalesStockFulfillmentEvidence>();
  for (const entry of entries) {
    const sourceLineId = required(entry.sourceLineId, "evidence.sourceLineId");
    if (map.has(sourceLineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentInvalid,
        "evidence.sourceLineId",
      );
    }
    map.set(sourceLineId, entry);
  }
  return map;
}

function validateEvidence(
  commercial: SalesCommercialPostingInput,
  line: SalesCommercialPostingLineInput,
  evidence: SalesStockFulfillmentEvidence,
): void {
  if (
    evidence.companyId !== commercial.companyId
    || evidence.sourceSystem !== "sales"
    || evidence.sourceDocumentType !== "sales-invoice"
    || evidence.sourceDocumentId !== commercial.source.sourceDocumentId
    || evidence.sourceLineId !== line.lineId
    || evidence.productId !== line.productId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentInvalid,
      "evidence.lineage",
    );
  }

  required(evidence.inventoryDocumentId, "evidence.inventoryDocumentId");
  required(evidence.inventoryLineId, "evidence.inventoryLineId");
}

function statusFor(
  evidence: SalesStockFulfillmentEvidence | undefined,
): SalesStockFulfillmentLineStatus {
  if (!evidence) return "waiting-for-issue";
  if (evidence.inventoryDocumentStatus === "confirmed") return "eligible";
  return "waiting-for-confirmation";
}

export function evaluateSalesStockFulfillmentPrerequisite(
  commercial: SalesCommercialPostingInput,
  evidence: readonly SalesStockFulfillmentEvidence[],
): SalesStockFulfillmentPrerequisiteResult {
  if (!commercial || typeof commercial !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentInvalid,
      "commercial",
    );
  }

  const bySourceLine = evidenceMap(evidence);
  const salesLineIds = new Set(commercial.lines.map((line) => line.lineId));

  for (const sourceLineId of bySourceLine.keys()) {
    if (!salesLineIds.has(sourceLineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentInvalid,
        "evidence.sourceLineId",
      );
    }
  }

  const lines = commercial.lines.map((line): SalesStockFulfillmentLinePrerequisite => {
    if (line.lineKind !== "stock-product") {
      if (bySourceLine.has(line.lineId)) {
        return fail(
          SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentInvalid,
          "evidence.nonStockLine",
        );
      }

      return Object.freeze({
        salesLineId: line.lineId,
        productId: line.productId,
        lineKind: line.lineKind,
        status: "not-required",
        inventoryDocumentId: null,
        inventoryLineId: null,
        inventoryDocumentStatus: null,
      });
    }

    const linked = bySourceLine.get(line.lineId);
    if (linked) validateEvidence(commercial, line, linked);

    return Object.freeze({
      salesLineId: line.lineId,
      productId: line.productId,
      lineKind: line.lineKind,
      status: statusFor(linked),
      inventoryDocumentId: linked?.inventoryDocumentId ?? null,
      inventoryLineId: linked?.inventoryLineId ?? null,
      inventoryDocumentStatus: linked?.inventoryDocumentStatus ?? null,
    });
  });

  const stockLines = lines.filter((line) => line.lineKind === "stock-product");
  const cogsEligible =
    stockLines.length === 0
    || stockLines.every((line) => line.status === "eligible");

  return Object.freeze({
    sourceDocumentId: commercial.source.sourceDocumentId,
    companyId: commercial.companyId,
    hasStockLines: stockLines.length > 0,
    cogsEligible,
    lines: Object.freeze(lines),
  });
}

export function assertSalesStockFulfillmentEligible(
  result: SalesStockFulfillmentPrerequisiteResult,
): void {
  if (!result.cogsEligible) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentBlocked,
      "stockFulfillment",
    );
  }
}
