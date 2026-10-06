import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import { createSalesCommercialTerms, type SalesCommercialTerms } from "./sales-commercial-terms.ts";
import { calculateSalesLineTotals, type SalesLineTotals } from "./sales-pricing.ts";
import type { SalesDocumentLineSnapshot } from "./sales-document.ts";

export interface SalesCommercialSnapshot {
  readonly snapshotId: string;
  readonly lineId: string;
  readonly productId: string;
  readonly lineKind: SalesDocumentLineSnapshot["lineKind"];
  readonly capturedAt: string;
  readonly terms: SalesCommercialTerms;
  readonly totals: SalesLineTotals;
}

export interface CreateSalesCommercialSnapshotInput {
  readonly snapshotId: string;
  readonly line: SalesDocumentLineSnapshot;
  readonly capturedAt: string;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}
function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}
function timestamp(value: string): string {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) {
    return fail(SALES_DOMAIN_ERROR_CODES.commercialSnapshotInvalid, "commercialSnapshot.capturedAt");
  }
  return value;
}
function cloneTerms(terms: SalesCommercialTerms): SalesCommercialTerms {
  return createSalesCommercialTerms({
    quantity: terms.quantity, currency: terms.currency, unitPrice: terms.unitPrice, priceOrigin: terms.priceOrigin,
    priceListId: terms.priceListId, priceListItemId: terms.priceListItemId, priceRevisionId: terms.priceRevisionId, priceRevision: terms.priceRevision,
    discounts: terms.discounts.map((x) => ({ id: x.discountId, mode: x.mode, value: x.value, reason: x.reason })),
    charges: terms.charges.map((x) => ({ id: x.chargeId, mode: x.mode, value: x.value, reason: x.reason })),
    taxes: terms.taxes.map((x) => ({ taxId: x.taxId, rateBasisPoints: x.rateBasisPoints, taxCode: x.taxCode })),
  });
}

export function createSalesCommercialSnapshot(input: CreateSalesCommercialSnapshotInput): SalesCommercialSnapshot {
  if (typeof input !== "object" || input === null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "commercialSnapshot");
  if (!input.line?.commercialTerms) return fail(SALES_DOMAIN_ERROR_CODES.commercialTermsRequired, "commercialSnapshot.line.commercialTerms");
  const terms = cloneTerms(input.line.commercialTerms);
  const totals = calculateSalesLineTotals(terms);
  return Object.freeze({
    snapshotId: required(input.snapshotId, "commercialSnapshot.snapshotId"),
    lineId: required(input.line.lineId, "commercialSnapshot.lineId"),
    productId: required(input.line.item.productId, "commercialSnapshot.productId"),
    lineKind: input.line.lineKind,
    capturedAt: timestamp(input.capturedAt),
    terms,
    totals: Object.freeze({ ...totals }),
  });
}

export function verifySalesCommercialSnapshot(snapshot: SalesCommercialSnapshot): boolean {
  const calculated = calculateSalesLineTotals(snapshot.terms);
  return calculated.currency === snapshot.totals.currency
    && calculated.grossAmount === snapshot.totals.grossAmount
    && calculated.discountAmount === snapshot.totals.discountAmount
    && calculated.netAfterDiscount === snapshot.totals.netAfterDiscount
    && calculated.chargeAmount === snapshot.totals.chargeAmount
    && calculated.taxBaseAmount === snapshot.totals.taxBaseAmount
    && calculated.taxAmount === snapshot.totals.taxAmount
    && calculated.grandTotal === snapshot.totals.grandTotal;
}
