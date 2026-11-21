import type { InventoryDocumentSnapshot } from "@argin/inventory";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type {
  SalesCommercialPostingInput,
  SalesCommercialPostingLineInput,
} from "./sales-commercial-posting-input.ts";
import type {
  SalesStockFulfillmentPrerequisiteResult,
} from "./sales-stock-fulfillment-prerequisite.ts";

export interface SalesInventoryIssueDocumentReader {
  findById(
    companyId: string,
    inventoryDocumentId: string,
  ): Promise<InventoryDocumentSnapshot | null>;
}

export interface SalesInventoryIssueLineage {
  readonly salesLineId: string;
  readonly productId: string;
  readonly inventoryDocumentId: string;
  readonly inventoryDocumentVersion: number;
  readonly inventoryLineId: string;
  readonly confirmedAt: string;
}

export interface SalesInventoryIssueLineageResult {
  readonly sourceDocumentId: string;
  readonly companyId: string;
  readonly lines: readonly SalesInventoryIssueLineage[];
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

function stockLines(
  commercial: SalesCommercialPostingInput,
): readonly SalesCommercialPostingLineInput[] {
  return commercial.lines.filter((line) => line.lineKind === "stock-product");
}

function confirmedAt(document: InventoryDocumentSnapshot): string {
  const transition = [...document.lifecycleHistory]
    .reverse()
    .find((item) => item.toStatus === "confirmed");
  if (!transition) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid,
      "inventoryDocument.lifecycleHistory",
    );
  }
  return transition.occurredAt;
}

function assertIssueDocument(
  commercial: SalesCommercialPostingInput,
  document: InventoryDocumentSnapshot,
): void {
  if (
    document.companyId !== commercial.companyId
    || document.documentType !== "issue"
    || document.status !== "confirmed"
    || document.sourceReference?.companyId !== commercial.companyId
    || document.sourceReference?.sourceSystem !== "sales"
    || document.sourceReference?.documentType !== "sales-invoice"
    || document.sourceReference?.documentId !== commercial.source.sourceDocumentId
    || document.sourceReference?.lineId !== null
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid,
      "inventoryDocument",
    );
  }

  if (!Number.isSafeInteger(document.version) || document.version < 1) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid,
      "inventoryDocument.version",
    );
  }
}

function resolveDocumentLine(
  commercial: SalesCommercialPostingInput,
  salesLine: SalesCommercialPostingLineInput,
  document: InventoryDocumentSnapshot,
): SalesInventoryIssueLineage {
  const candidates = document.lines.filter((line) =>
    line.sourceReference?.companyId === commercial.companyId
    && line.sourceReference?.sourceSystem === "sales"
    && line.sourceReference?.documentType === "sales-invoice"
    && line.sourceReference?.documentId === commercial.source.sourceDocumentId
    && line.sourceReference?.lineId === salesLine.lineId
  );

  if (candidates.length === 0) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageMissing,
      "inventoryDocument.lines",
    );
  }
  if (candidates.length > 1) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageAmbiguous,
      "inventoryDocument.lines",
    );
  }

  const line = candidates[0]!;
  if (line.productId !== salesLine.productId) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid,
      "inventoryDocument.lines.productId",
    );
  }

  return Object.freeze({
    salesLineId: salesLine.lineId,
    productId: salesLine.productId,
    inventoryDocumentId: required(
      document.documentId,
      "inventoryDocument.documentId",
    ),
    inventoryDocumentVersion: document.version,
    inventoryLineId: required(line.lineId, "inventoryDocument.lines.lineId"),
    confirmedAt: confirmedAt(document),
  });
}

export async function resolveSalesInventoryIssueLineage(
  commercial: SalesCommercialPostingInput,
  prerequisite: SalesStockFulfillmentPrerequisiteResult,
  reader: SalesInventoryIssueDocumentReader,
): Promise<SalesInventoryIssueLineageResult> {
  if (!commercial || typeof commercial !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid,
      "commercial",
    );
  }
  if (!prerequisite || typeof prerequisite !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid,
      "prerequisite",
    );
  }
  if (!reader || typeof reader.findById !== "function") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid,
      "reader",
    );
  }
  if (
    prerequisite.companyId !== commercial.companyId
    || prerequisite.sourceDocumentId !== commercial.source.sourceDocumentId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid,
      "prerequisite.lineage",
    );
  }

  const stocks = stockLines(commercial);
  if (stocks.length === 0) {
    return Object.freeze({
      sourceDocumentId: commercial.source.sourceDocumentId,
      companyId: commercial.companyId,
      lines: Object.freeze([]),
    });
  }

  if (!prerequisite.cogsEligible) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.stockFulfillmentBlocked,
      "stockFulfillment",
    );
  }

  const prerequisiteByLine = new Map(
    prerequisite.lines.map((line) => [line.salesLineId, line] as const),
  );
  const documentCache = new Map<string, InventoryDocumentSnapshot>();

  for (const line of stocks) {
    const prerequisiteLine = prerequisiteByLine.get(line.lineId);
    if (
      !prerequisiteLine
      || prerequisiteLine.status !== "eligible"
      || prerequisiteLine.inventoryDocumentId === null
      || prerequisiteLine.inventoryLineId === null
      || prerequisiteLine.inventoryDocumentStatus !== "confirmed"
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageMissing,
        "prerequisite.lines",
      );
    }

    if (!documentCache.has(prerequisiteLine.inventoryDocumentId)) {
      const document = await reader.findById(
        commercial.companyId,
        prerequisiteLine.inventoryDocumentId,
      );
      if (!document) {
        return fail(
          SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageMissing,
          "inventoryDocument",
        );
      }
      assertIssueDocument(commercial, document);
      documentCache.set(prerequisiteLine.inventoryDocumentId, document);
    }
  }

  const resolved = stocks.map((line) => {
    const prerequisiteLine = prerequisiteByLine.get(line.lineId)!;
    const document = documentCache.get(prerequisiteLine.inventoryDocumentId!)!;
    const lineage = resolveDocumentLine(commercial, line, document);

    if (lineage.inventoryLineId !== prerequisiteLine.inventoryLineId) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageInvalid,
        "prerequisite.inventoryLineId",
      );
    }

    return lineage;
  });

  const inventoryLineIds = new Set<string>();
  for (const line of resolved) {
    if (inventoryLineIds.has(line.inventoryLineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.inventoryIssueLineageAmbiguous,
        "inventoryLineId",
      );
    }
    inventoryLineIds.add(line.inventoryLineId);
  }

  return Object.freeze({
    sourceDocumentId: commercial.source.sourceDocumentId,
    companyId: commercial.companyId,
    lines: Object.freeze(resolved),
  });
}
