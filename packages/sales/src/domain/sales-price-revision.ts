import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";

export interface SalesPriceRevision {
  readonly priceRevisionId: string;
  readonly revision: number;
  readonly currency: string;
  readonly unitPrice: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
}

export interface CreateSalesPriceRevisionInput {
  readonly priceRevisionId: string;
  readonly revision: number;
  readonly currency: string;
  readonly unitPrice: number;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string | null;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}
function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}
function date(value: string, field: string): string {
  const v = required(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + "T00:00:00Z"))) return fail(SALES_DOMAIN_ERROR_CODES.priceEffectiveDateInvalid, field);
  return v;
}
function currency(value: string): string {
  const v = required(value, "priceRevision.currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(v)) return fail(SALES_DOMAIN_ERROR_CODES.priceCurrencyInvalid, "priceRevision.currency");
  return v;
}

export function createSalesPriceRevision(input: CreateSalesPriceRevisionInput): SalesPriceRevision {
  if (typeof input !== "object" || input === null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "priceRevision");
  if (!Number.isInteger(input.revision) || input.revision < 1) return fail(SALES_DOMAIN_ERROR_CODES.priceRevisionInvalid, "priceRevision.revision");
  if (!Number.isSafeInteger(input.unitPrice) || input.unitPrice < 0) return fail(SALES_DOMAIN_ERROR_CODES.priceInvalid, "priceRevision.unitPrice");
  const from = date(input.effectiveFrom, "priceRevision.effectiveFrom");
  const to = input.effectiveTo == null ? null : date(input.effectiveTo, "priceRevision.effectiveTo");
  if (to !== null && to < from) return fail(SALES_DOMAIN_ERROR_CODES.priceEffectiveDateInvalid, "priceRevision.effectiveTo");
  return Object.freeze({
    priceRevisionId: required(input.priceRevisionId, "priceRevision.priceRevisionId"),
    revision: input.revision,
    currency: currency(input.currency),
    unitPrice: input.unitPrice,
    effectiveFrom: from,
    effectiveTo: to,
  });
}

export function isSalesPriceRevisionEffective(revision: SalesPriceRevision, businessDate: string, requestedCurrency: string): boolean {
  const day = date(businessDate, "resolution.businessDate");
  const curr = currency(requestedCurrency);
  return revision.currency === curr && revision.effectiveFrom <= day && (revision.effectiveTo === null || day <= revision.effectiveTo);
}
