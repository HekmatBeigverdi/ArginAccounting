import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import type { SalesPriceListKind } from "./sales-price-list.ts";

export type SalesPriceListTarget =
  | Readonly<{ kind: "base" }>
  | Readonly<{ kind: "wholesale" }>
  | Readonly<{ kind: "customer"; customerPartyId: string }>
  | Readonly<{ kind: "segment"; customerSegmentId: string }>;

export interface SalesPricingContext {
  readonly customerPartyId: string;
  readonly customerSegmentIds?: readonly string[];
  readonly wholesale?: boolean;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}
function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}

export function createSalesPriceListTarget(
  kind: SalesPriceListKind,
  target?: { customerPartyId?: string | null; customerSegmentId?: string | null },
): SalesPriceListTarget {
  switch (kind) {
    case "base":
    case "wholesale":
      if (target?.customerPartyId || target?.customerSegmentId) return fail(SALES_DOMAIN_ERROR_CODES.priceListTargetInvalid, "priceList.target");
      return Object.freeze({ kind });
    case "customer":
      if (target?.customerSegmentId) return fail(SALES_DOMAIN_ERROR_CODES.priceListTargetInvalid, "priceList.target.customerSegmentId");
      return Object.freeze({ kind, customerPartyId: required(target?.customerPartyId ?? "", "priceList.target.customerPartyId") });
    case "segment":
      if (target?.customerPartyId) return fail(SALES_DOMAIN_ERROR_CODES.priceListTargetInvalid, "priceList.target.customerPartyId");
      return Object.freeze({ kind, customerSegmentId: required(target?.customerSegmentId ?? "", "priceList.target.customerSegmentId") });
  }
}

export function isSalesPriceListTargetEligible(target: SalesPriceListTarget, context: SalesPricingContext): boolean {
  const partyId = required(context.customerPartyId, "pricingContext.customerPartyId");
  switch (target.kind) {
    case "base": return true;
    case "wholesale": return context.wholesale === true;
    case "customer": return target.customerPartyId === partyId;
    case "segment": return (context.customerSegmentIds ?? []).includes(target.customerSegmentId);
  }
}
