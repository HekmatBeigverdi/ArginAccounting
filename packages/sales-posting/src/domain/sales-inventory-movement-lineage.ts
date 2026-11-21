import {
  normalizeInventoryQuantity,
} from "@argin/inventory";
import type {
  InventoryStockMovementSnapshot,
} from "@argin/inventory";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type {
  SalesCommercialPostingInput,
} from "./sales-commercial-posting-input.ts";
import type {
  SalesInventoryIssueLineageResult,
} from "./sales-inventory-issue-lineage.ts";

export interface SalesInventoryMovementReader {
  listByDocument(
    companyId: string,
    inventoryDocumentId: string,
  ): Promise<readonly InventoryStockMovementSnapshot[]>;
}

export interface SalesOutboundInventoryMovementLineage {
  readonly salesLineId: string;
  readonly productId: string;
  readonly inventoryDocumentId: string;
  readonly inventoryLineId: string;
  readonly movementId: string;
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly recordedAt: string;
  readonly quantityDelta: string;
  readonly warehouseId: string;
  readonly zoneId: string | null;
  readonly locationId: string | null;
}

export interface SalesOutboundInventoryMovementLineageResult {
  readonly sourceDocumentId: string;
  readonly companyId: string;
  readonly lines: readonly SalesOutboundInventoryMovementLineage[];
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

function assertOutboundQuantity(value: string): string {
  const normalized = normalizeInventoryQuantity(value);
  if (normalized === "0" || !normalized.startsWith("-")) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid,
      "movement.quantityDelta",
    );
  }
  return normalized;
}

function assertMovement(
  commercial: SalesCommercialPostingInput,
  issueLine: SalesInventoryIssueLineageResult["lines"][number],
  movement: InventoryStockMovementSnapshot,
): SalesOutboundInventoryMovementLineage {
  if (
    movement.companyId !== commercial.companyId
    || movement.documentId !== issueLine.inventoryDocumentId
    || movement.lineId !== issueLine.inventoryLineId
    || movement.stockKey.companyId !== commercial.companyId
    || movement.stockKey.productId !== issueLine.productId
    || movement.transferId !== null
    || movement.reversalOfMovementId !== null
    || movement.businessDate !== commercial.businessDate
    || movement.recordedAt !== issueLine.confirmedAt
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid,
      "movement",
    );
  }

  if (!Number.isSafeInteger(movement.businessOrder) || movement.businessOrder < 1) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid,
      "movement.businessOrder",
    );
  }

  return Object.freeze({
    salesLineId: issueLine.salesLineId,
    productId: issueLine.productId,
    inventoryDocumentId: issueLine.inventoryDocumentId,
    inventoryLineId: issueLine.inventoryLineId,
    movementId: required(movement.movementId, "movement.movementId"),
    businessDate: movement.businessDate,
    businessOrder: movement.businessOrder,
    recordedAt: movement.recordedAt,
    quantityDelta: assertOutboundQuantity(movement.quantityDelta),
    warehouseId: required(movement.stockKey.warehouseId, "movement.stockKey.warehouseId"),
    zoneId: movement.stockKey.zoneId,
    locationId: movement.stockKey.locationId,
  });
}

export async function resolveSalesOutboundInventoryMovementLineage(
  commercial: SalesCommercialPostingInput,
  issueLineage: SalesInventoryIssueLineageResult,
  reader: SalesInventoryMovementReader,
): Promise<SalesOutboundInventoryMovementLineageResult> {
  if (!commercial || typeof commercial !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid,
      "commercial",
    );
  }
  if (!issueLineage || typeof issueLineage !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid,
      "issueLineage",
    );
  }
  if (!reader || typeof reader.listByDocument !== "function") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid,
      "reader",
    );
  }
  if (
    issueLineage.companyId !== commercial.companyId
    || issueLineage.sourceDocumentId !== commercial.source.sourceDocumentId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid,
      "issueLineage.source",
    );
  }

  if (issueLineage.lines.length === 0) {
    return Object.freeze({
      sourceDocumentId: commercial.source.sourceDocumentId,
      companyId: commercial.companyId,
      lines: Object.freeze([]),
    });
  }

  const byDocument = new Map<string, readonly InventoryStockMovementSnapshot[]>();
  for (const issueLine of issueLineage.lines) {
    if (!byDocument.has(issueLine.inventoryDocumentId)) {
      const movements = await reader.listByDocument(
        commercial.companyId,
        issueLine.inventoryDocumentId,
      );
      if (!Array.isArray(movements)) {
        return fail(
          SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid,
          "movements",
        );
      }
      byDocument.set(issueLine.inventoryDocumentId, movements);
    }
  }

  const resolved = issueLineage.lines.map((issueLine) => {
    const movements = byDocument.get(issueLine.inventoryDocumentId)!;
    const candidates = movements.filter((movement) =>
      movement.companyId === commercial.companyId
      && movement.documentId === issueLine.inventoryDocumentId
      && movement.lineId === issueLine.inventoryLineId
    );

    if (candidates.length === 0) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageMissing,
        "movement",
      );
    }
    if (candidates.length > 1) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageAmbiguous,
        "movement",
      );
    }

    return assertMovement(commercial, issueLine, candidates[0]!);
  });

  const movementIds = new Set<string>();
  for (const item of resolved) {
    if (movementIds.has(item.movementId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageAmbiguous,
        "movementId",
      );
    }
    movementIds.add(item.movementId);
  }

  return Object.freeze({
    sourceDocumentId: commercial.source.sourceDocumentId,
    companyId: commercial.companyId,
    lines: Object.freeze(resolved),
  });
}
