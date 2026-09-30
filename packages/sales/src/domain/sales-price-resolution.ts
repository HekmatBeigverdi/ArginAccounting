import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import type { SalesPriceList, SalesPriceListItem, SalesPriceListKind } from "./sales-price-list.ts";

export const SALES_PRICE_LIST_RESOLUTION_PRIORITY = Object.freeze([
  "customer",
  "segment",
  "wholesale",
  "base",
] as const satisfies readonly SalesPriceListKind[]);

export interface SalesPriceListResolutionCandidate {
  readonly priceList: SalesPriceList;
  readonly eligible: boolean;
}

export interface SalesResolvedPrice {
  readonly priceListId: string;
  readonly priceListItemId: string;
  readonly kind: SalesPriceListKind;
  readonly productId: string;
  readonly unitPrice: number;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}

export function resolveSalesPriceList(
  companyId: string,
  productId: string,
  candidates: readonly SalesPriceListResolutionCandidate[],
): SalesResolvedPrice | null {
  const company = companyId.trim();
  const product = productId.trim();
  if (!company) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, "resolution.companyId");
  if (!product) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, "resolution.productId");
  if (!Array.isArray(candidates)) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "resolution.candidates");

  const eligible = candidates.filter(({ priceList }) => {
    if (priceList.companyId !== company) return fail(SALES_DOMAIN_ERROR_CODES.scopeMismatch, "resolution.companyId");
    return priceList.isActive;
  }).filter((candidate) => candidate.eligible);

  for (const kind of SALES_PRICE_LIST_RESOLUTION_PRIORITY) {
    const matches: Array<{ priceList: SalesPriceList; item: SalesPriceListItem }> = [];
    for (const candidate of eligible) {
      if (candidate.priceList.kind !== kind) continue;
      const item = candidate.priceList.items.find((entry) => entry.productId === product);
      if (item) matches.push({ priceList: candidate.priceList, item });
    }
    if (matches.length > 1) return fail(SALES_DOMAIN_ERROR_CODES.priceResolutionAmbiguous, "resolution.candidates");
    const match = matches[0];
    if (match) {
      return Object.freeze({
        priceListId: match.priceList.priceListId,
        priceListItemId: match.item.priceListItemId,
        kind: match.priceList.kind,
        productId: match.item.productId,
        unitPrice: match.item.unitPrice,
      });
    }
  }
  return null;
}
