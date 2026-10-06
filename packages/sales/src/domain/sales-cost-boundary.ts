import type { InventoryValuationEntrySnapshot } from "@argin/inventory";
import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import type { SalesCommercialSnapshot } from "./sales-commercial-snapshot.ts";

export interface SalesCommercialAmountFact {
  readonly source: "sales-commercial";
  readonly salesDocumentId: string;
  readonly salesLineId: string;
  readonly currency: string;
  readonly quantity: number;
  readonly unitSellingPrice: number;
  readonly grossAmount: number;
  readonly discountAmount: number;
  readonly chargeAmount: number;
  readonly taxAmount: number;
  readonly grandTotal: number;
}

export interface SalesInventoryCostFact {
  readonly source: "inventory-valuation";
  readonly salesDocumentId: string;
  readonly salesLineId: string;
  readonly inventoryMovementId: string;
  readonly valuationEntryId: string;
  readonly currency: string;
  readonly quantity: string;
  readonly unitCost: string;
  readonly totalCost: number;
  readonly valuationMethod: InventoryValuationEntrySnapshot["method"];
  readonly valuationRevision: number;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}
function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}

export function createSalesCommercialAmountFact(
  salesDocumentId: string,
  snapshot: SalesCommercialSnapshot,
): SalesCommercialAmountFact {
  return Object.freeze({
    source: "sales-commercial",
    salesDocumentId: required(salesDocumentId, "commercialAmount.salesDocumentId"),
    salesLineId: snapshot.lineId,
    currency: snapshot.totals.currency,
    quantity: snapshot.terms.quantity,
    unitSellingPrice: snapshot.terms.unitPrice,
    grossAmount: snapshot.totals.grossAmount,
    discountAmount: snapshot.totals.discountAmount,
    chargeAmount: snapshot.totals.chargeAmount,
    taxAmount: snapshot.totals.taxAmount,
    grandTotal: snapshot.totals.grandTotal,
  });
}

export function createSalesInventoryCostFact(input: {
  readonly salesDocumentId: string;
  readonly salesLineId: string;
  readonly valuation: InventoryValuationEntrySnapshot;
}): SalesInventoryCostFact {
  const valuation = input.valuation;
  if (!valuation || valuation.kind !== "outbound" || valuation.costState !== "resolved" ||
      valuation.unitCost === null || valuation.totalCost === null) {
    return fail(SALES_DOMAIN_ERROR_CODES.inventoryCostResolvedOutboundRequired, "inventoryCost.valuation");
  }
  if (valuation.source.lineId !== input.salesLineId) {
    return fail(SALES_DOMAIN_ERROR_CODES.inventoryCostLineageMismatch, "inventoryCost.salesLineId");
  }
  return Object.freeze({
    source: "inventory-valuation",
    salesDocumentId: required(input.salesDocumentId, "inventoryCost.salesDocumentId"),
    salesLineId: required(input.salesLineId, "inventoryCost.salesLineId"),
    inventoryMovementId: valuation.source.movementId,
    valuationEntryId: valuation.valuationEntryId,
    currency: valuation.currency,
    quantity: valuation.quantity,
    unitCost: valuation.unitCost,
    totalCost: valuation.totalCost,
    valuationMethod: valuation.method,
    valuationRevision: valuation.revision,
  });
}
