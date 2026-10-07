import type { InventoryValuationEntrySnapshot } from "@argin/inventory";
import type { InventoryValuationEntryRepository } from "@argin/inventory/valuation-contracts";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type { SalesCommercialPostingInput } from "./sales-commercial-posting-input.ts";
import type {
  SalesOutboundInventoryMovementLineageResult,
} from "./sales-inventory-movement-lineage.ts";

export interface SalesResolvedValuationLineage {
  readonly salesLineId: string;
  readonly productId: string;
  readonly movementId: string;
  readonly valuationEntryId: string;
  readonly method: InventoryValuationEntrySnapshot["method"];
  readonly strategyVersion: number;
  readonly currency: InventoryValuationEntrySnapshot["currency"];
  readonly quantity: string;
  readonly unitCost: string;
  readonly totalCost: number;
  readonly valuedAt: string;
  readonly revision: number;
}

export interface SalesResolvedValuationPrerequisiteResult {
  readonly sourceDocumentId: string;
  readonly companyId: string;
  readonly ready: boolean;
  readonly lines: readonly SalesResolvedValuationLineage[];
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function assertResolvedEntry(
  commercial: SalesCommercialPostingInput,
  movement: SalesOutboundInventoryMovementLineageResult["lines"][number],
  entry: InventoryValuationEntrySnapshot,
): SalesResolvedValuationLineage {
  if (
    entry.companyId !== commercial.companyId
    || entry.productId !== movement.productId
    || entry.source.movementId !== movement.movementId
    || entry.source.documentId !== movement.inventoryDocumentId
    || entry.source.lineId !== movement.inventoryLineId
    || entry.source.reversalOfMovementId !== null
    || entry.source.transferId !== null
    || entry.kind !== "outbound"
    || entry.businessDate !== movement.businessDate
    || entry.businessOrder !== movement.businessOrder
    || entry.stockKey.companyId !== commercial.companyId
    || entry.stockKey.productId !== movement.productId
    || entry.stockKey.warehouseId !== movement.warehouseId
    || entry.stockKey.zoneId !== movement.zoneId
    || entry.stockKey.locationId !== movement.locationId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid,
      "valuation",
    );
  }

  if (entry.costState !== "resolved") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteUnresolved,
      "valuation.costState",
    );
  }
  if (
    entry.unitCost === null
    || entry.totalCost === null
    || entry.valuedAt === null
    || entry.unresolvedReason !== null
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteUnresolved,
      "valuation.amount",
    );
  }
  if (entry.totalCost > 0) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid,
      "valuation.totalCost",
    );
  }
  if (!Number.isSafeInteger(entry.strategyVersion) || entry.strategyVersion < 1) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid,
      "valuation.strategyVersion",
    );
  }
  if (!Number.isSafeInteger(entry.revision) || entry.revision < 1) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid,
      "valuation.revision",
    );
  }

  return Object.freeze({
    salesLineId: movement.salesLineId,
    productId: movement.productId,
    movementId: movement.movementId,
    valuationEntryId: entry.valuationEntryId,
    method: entry.method,
    strategyVersion: entry.strategyVersion,
    currency: entry.currency,
    quantity: entry.quantity,
    unitCost: entry.unitCost,
    totalCost: entry.totalCost,
    valuedAt: entry.valuedAt,
    revision: entry.revision,
  });
}

export async function resolveSalesResolvedValuationPrerequisite(
  commercial: SalesCommercialPostingInput,
  movementLineage: SalesOutboundInventoryMovementLineageResult,
  repository: Pick<InventoryValuationEntryRepository, "findByMovement">,
): Promise<SalesResolvedValuationPrerequisiteResult> {
  if (!commercial || typeof commercial !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid,
      "commercial",
    );
  }
  if (!movementLineage || typeof movementLineage !== "object") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid,
      "movementLineage",
    );
  }
  if (!repository || typeof repository.findByMovement !== "function") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid,
      "repository",
    );
  }
  if (
    movementLineage.companyId !== commercial.companyId
    || movementLineage.sourceDocumentId !== commercial.source.sourceDocumentId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid,
      "movementLineage.source",
    );
  }

  if (movementLineage.lines.length === 0) {
    return Object.freeze({
      sourceDocumentId: commercial.source.sourceDocumentId,
      companyId: commercial.companyId,
      ready: true,
      lines: Object.freeze([]),
    });
  }

  const resolved: SalesResolvedValuationLineage[] = [];
  const valuationIds = new Set<string>();

  for (const movement of movementLineage.lines) {
    const entry = await repository.findByMovement(
      commercial.companyId,
      movement.movementId,
    );
    if (!entry) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteMissing,
        "valuation",
      );
    }

    const lineage = assertResolvedEntry(commercial, movement, entry);
    if (valuationIds.has(lineage.valuationEntryId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid,
        "valuation.valuationEntryId",
      );
    }
    valuationIds.add(lineage.valuationEntryId);
    resolved.push(lineage);
  }

  return Object.freeze({
    sourceDocumentId: commercial.source.sourceDocumentId,
    companyId: commercial.companyId,
    ready: true,
    lines: Object.freeze(resolved),
  });
}
