import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import type { SalesPriceList, SalesPriceListItem, SalesPriceListKind } from "./sales-price-list.ts";
import { isSalesPriceRevisionEffective, type SalesPriceRevision } from "./sales-price-revision.ts";
import { isSalesPriceListTargetEligible, type SalesPricingContext } from "./sales-price-target.ts";

export const SALES_PRICE_LIST_RESOLUTION_PRIORITY = Object.freeze([
  "customer",
  "segment",
  "wholesale",
  "base",
] as const satisfies readonly SalesPriceListKind[]);

export interface SalesPriceListResolutionCandidate {
  readonly priceList: SalesPriceList;
  readonly eligible?: boolean;
}

export interface SalesResolvedPrice {
  readonly priceListId: string;
  readonly priceListItemId: string;
  readonly kind: SalesPriceListKind;
  readonly productId: string;
  readonly priceRevisionId: string;
  readonly revision: number;
  readonly currency: string;
  readonly unitPrice: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}

export function resolveSalesPriceList(
  companyId: string,
  productId: string,
  candidates: readonly SalesPriceListResolutionCandidate[],
  businessDate = "9999-12-31",
  currency = "IRR",
  pricingContext?: SalesPricingContext,
): SalesResolvedPrice | null {
  const company = companyId.trim();
  const product = productId.trim();
  if (!company) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, "resolution.companyId");
  if (!product) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, "resolution.productId");
  // Validate at runtime without narrowing the readonly candidates to any[].
  if (!Array.isArray(candidates as unknown)) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "resolution.candidates");

  const eligible = candidates.filter(({ priceList }) => {
    if (priceList.companyId !== company) return fail(SALES_DOMAIN_ERROR_CODES.scopeMismatch, "resolution.companyId");
    return priceList.isActive;
  }).filter((candidate) => {
    if (candidate.eligible === false) return false;
    return pricingContext ? isSalesPriceListTargetEligible(candidate.priceList.target, pricingContext) : candidate.eligible === true;
  });

  for (const kind of SALES_PRICE_LIST_RESOLUTION_PRIORITY) {
    const matches: Array<{ priceList: SalesPriceList; item: SalesPriceListItem; revision: SalesPriceRevision }> = [];
    for (const candidate of eligible) {
      if (candidate.priceList.kind !== kind) continue;
      const item = candidate.priceList.items.find((entry) => entry.productId === product);
      if (!item) continue;
      const effective = item.revisions.filter((entry) => isSalesPriceRevisionEffective(entry, businessDate, currency));
      if (effective.length > 1) return fail(SALES_DOMAIN_ERROR_CODES.priceResolutionAmbiguous, "resolution.revisions");
      if (effective[0]) matches.push({ priceList: candidate.priceList, item, revision: effective[0] });
    }
    if (matches.length > 1) return fail(SALES_DOMAIN_ERROR_CODES.priceResolutionAmbiguous, "resolution.candidates");
    const match = matches[0];
    if (match) {
      return Object.freeze({
        priceListId: match.priceList.priceListId,
        priceListItemId: match.item.priceListItemId,
        kind: match.priceList.kind,
        productId: match.item.productId,
        priceRevisionId: match.revision.priceRevisionId,
        revision: match.revision.revision,
        currency: match.revision.currency,
        unitPrice: match.revision.unitPrice,
        effectiveFrom: match.revision.effectiveFrom,
        effectiveTo: match.revision.effectiveTo,
      });
    }
  }
  return null;
}
