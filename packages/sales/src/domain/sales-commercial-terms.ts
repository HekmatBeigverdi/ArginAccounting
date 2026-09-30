import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import type { SalesResolvedPrice } from "./sales-price-resolution.ts";

export type SalesPriceOrigin = "price-list" | "manual";

export interface SalesCommercialTerms {
  readonly quantity: number;
  readonly currency: string;
  readonly unitPrice: number;
  readonly priceOrigin: SalesPriceOrigin;
  readonly priceListId: string | null;
  readonly priceListItemId: string | null;
  readonly priceRevisionId: string | null;
  readonly priceRevision: number | null;
}

export interface CreateSalesCommercialTermsInput {
  readonly quantity: number;
  readonly currency: string;
  readonly unitPrice: number;
  readonly priceOrigin: SalesPriceOrigin;
  readonly priceListId?: string | null;
  readonly priceListItemId?: string | null;
  readonly priceRevisionId?: string | null;
  readonly priceRevision?: number | null;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}
function optionalId(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !value.trim()) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}
function currency(value: string): string {
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value.trim())) return fail(SALES_DOMAIN_ERROR_CODES.priceCurrencyInvalid, "commercialTerms.currency");
  return value.trim().toUpperCase();
}

export function createSalesCommercialTerms(input: CreateSalesCommercialTermsInput): SalesCommercialTerms {
  if (typeof input !== "object" || input === null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "commercialTerms");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return fail(SALES_DOMAIN_ERROR_CODES.salesQuantityInvalid, "commercialTerms.quantity");
  if (!Number.isSafeInteger(input.unitPrice) || input.unitPrice < 0) return fail(SALES_DOMAIN_ERROR_CODES.priceInvalid, "commercialTerms.unitPrice");
  if (input.priceOrigin !== "price-list" && input.priceOrigin !== "manual") return fail(SALES_DOMAIN_ERROR_CODES.priceOriginInvalid, "commercialTerms.priceOrigin");

  const priceListId = optionalId(input.priceListId, "commercialTerms.priceListId");
  const priceListItemId = optionalId(input.priceListItemId, "commercialTerms.priceListItemId");
  const priceRevisionId = optionalId(input.priceRevisionId, "commercialTerms.priceRevisionId");
  const revision = input.priceRevision ?? null;

  if (input.priceOrigin === "price-list") {
    if (priceListId === null || priceListItemId === null || priceRevisionId === null || !Number.isInteger(revision) || revision! < 1) {
      return fail(SALES_DOMAIN_ERROR_CODES.priceOriginInvalid, "commercialTerms.priceOrigin");
    }
  } else if (priceListId !== null || priceListItemId !== null || priceRevisionId !== null || revision !== null) {
    return fail(SALES_DOMAIN_ERROR_CODES.priceOriginInvalid, "commercialTerms.priceOrigin");
  }

  return Object.freeze({
    quantity: input.quantity,
    currency: currency(input.currency),
    unitPrice: input.unitPrice,
    priceOrigin: input.priceOrigin,
    priceListId,
    priceListItemId,
    priceRevisionId,
    priceRevision: revision,
  });
}

export function createSalesCommercialTermsFromResolvedPrice(
  quantity: number,
  resolved: SalesResolvedPrice,
): SalesCommercialTerms {
  return createSalesCommercialTerms({
    quantity,
    currency: resolved.currency,
    unitPrice: resolved.unitPrice,
    priceOrigin: "price-list",
    priceListId: resolved.priceListId,
    priceListItemId: resolved.priceListItemId,
    priceRevisionId: resolved.priceRevisionId,
    priceRevision: resolved.revision,
  });
}
